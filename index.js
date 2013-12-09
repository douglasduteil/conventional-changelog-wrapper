'use strict';

var child = require('child_process');
var es = require('event-stream');
var util = require('util');

var GIT_LOG_CMD = 'git log --grep="%s" -E --format=%s %s..HEAD';
var GIT_TAG_CMD = 'git describe --tags --abbrev=0';

var EMPTY_COMPONENT = '$$';
var MAX_SUBJECT_LENGTH = 80;

var PATTERN = /^(\w*)(\(([\w\$\.\-\*]*)\))?\: (.*)$/;

var warn = function() {
  console.log('WARNING:', util.format.apply(null, arguments));
};

var log = function() {
  console.log(util.format.apply(null, arguments));
};


var parseRawCommit = function(raw) {
  if (!raw) {
    return null;
  }

  var lines = raw.split('\n');
  var msg = {}, match;

  msg.hash = lines.shift();
  msg.subject = lines.shift();
  msg.closes = [];
  msg.breaks = [];

  msg.subject = msg.subject.replace(/\s*(?:Closes|Fixes)\s#(\d+)/, function(_, i) {
    msg.closes.push(parseInt(i, 10));
    return '';
  });


  lines.forEach(function(line) {
    match = line.match(/(?:Closes|Fixes)\s((?:#\d+(?:\,\s)?)+)/);

    if (match) {
      match[1].replace(/[\s#]/g, '').split(',').forEach(function(i) {
        msg.closes.push(parseInt(i, 10));
      });
    }
  });

  match = raw.match(/BREAKING CHANGE:\s([\s\S]*)/);
  if (match) {
    msg.breaks.push(match[1]);
  }


  msg.body = lines.join('\n');
  match = msg.subject.match(PATTERN);

  if (!match || !match[1] || !match[4]) {
    warn('Incorrect message: %s %s', msg.hash, msg.subject);
    return null;
  }

  if (match[4].length > MAX_SUBJECT_LENGTH) {
    warn('Too long subject: %s %s', msg.hash, msg.subject);
    match[4] = match[4].substr(0, MAX_SUBJECT_LENGTH);
  }

  msg.type = match[1];
  msg.component = match[3];
  msg.subject = match[4];

  return msg;
};


var currentDate = function() {
  var now = new Date();
  var pad = function(i) {
    return ('0' + i).substr(-2);
  };

  return util.format('%d-%s-%s', now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate()));
};


var PATCH_HEADER_TPL = '<a name="%s"></a>\n### %s (%s)\n\n';
var MINOR_HEADER_TPL = '<a name="%s"></a>\n## %s (%s)\n\n';
var LINK_ISSUE = '[#%s](%s/issues/%s)';
var LINK_COMMIT = '[%s](%s/commit/%s)';

var Writer = function(stream, githubRepo) {

  var linkToIssue = function(issue) {
    return util.format(LINK_ISSUE, issue, githubRepo, issue);
  };

  var linkToCommit = function(hash) {
    return util.format(LINK_COMMIT, hash.substr(0, 8), githubRepo, hash);
  };

  this.header = function(version) {
    var header = version.split('.')[2] === '0' ? MINOR_HEADER_TPL : PATCH_HEADER_TPL;
    stream.write(util.format(header, version, version, currentDate()));
  };

  this.section = function(title, section) {
    var components = Object.getOwnPropertyNames(section).sort();

    if (!components.length) {
      return;
    }

    stream.write(util.format('\n#### %s\n\n', title));

    components.forEach(function(name) {
      var prefix = '*';
      var nested = section[name].length > 1;

      if (name !== EMPTY_COMPONENT) {
        if (nested) {
          stream.write(util.format('* **%s:**\n', name));
          prefix = '  *';
        } else {
          prefix = util.format('* **%s:**', name);
        }
      }

      section[name].forEach(function(commit) {
        stream.write(util.format('%s %s (%s', prefix, commit.subject, linkToCommit(commit.hash)));
        if (commit.closes.length) {
          stream.write(', closes ' + commit.closes.map(linkToIssue).join(', '));
        }
        stream.write(')\n');
      });
    });

    stream.write('\n');
  };
};

var writeChangelog = function(writer, commits, version) {
  var sections = {
    fix: {},
    feat: {},
    breaks: {}
  };

  commits.forEach(function(commit) {
    var section = sections[commit.type];
    var component = commit.component || EMPTY_COMPONENT;

    if (section) {
      section[component] = section[component] || [];
      section[component].push(commit);
    }

    commit.breaks.forEach(function(breakMsg) {
      sections.breaks[EMPTY_COMPONENT] = sections.breaks[EMPTY_COMPONENT] || [];

      sections.breaks[EMPTY_COMPONENT].push({
        subject: breakMsg,
        hash: commit.hash,
        closes: []
      });
    });
  });

  writer.header(version);
  writer.section('Bug Fixes', sections.fix);
  writer.section('Features', sections.feat);
  writer.section('Breaking Changes', sections.breaks);
};

var _getPreviousTag = function() {
  return es.map(function (tags, cb) {
    cb(null, tags.trim() );
  });
};

var _readGitLog = function(grep) {
  return es.map(function (from, cb) {
    log('Reading git log since', from);

    child.exec(util.format(GIT_LOG_CMD, grep, '%H%n%s%n%b%n==END==', from), function(code, stdout) {
      var commits = [];

      stdout.split('\n==END==\n').forEach(function(rawCommit) {
        var commit = parseRawCommit(rawCommit);
        if (commit) {
          commits.push(commit);
        }
      });

      log('Parsed %s commits', commits.length);

      cb(null, commits);
    });

  });
};

var _writeChangelog = function(githubRepo, version) {
  return es.map(function (commits, cb) {
    var buffer = {
      data: '',
      write: function(str) {
        this.data += str;
      }
    };

    var writer = new Writer(buffer, githubRepo);
    writeChangelog(writer, commits, version);

    cb(null, buffer.data );
  });
};

// PUBLIC API
exports.generate = function(githubRepo, version) {

  var pkg = {};
  try{
    pkg = require('./package.json');
  } catch (err) {}

  githubRepo = githubRepo || pkg.homepage || '';
  version = version || pkg.version || '';

  return es.child(child.exec(GIT_TAG_CMD)) // return the tag
    .pipe(_getPreviousTag()) // return the trimmed tag
    .pipe(_readGitLog('^fix|^feat|BREAKING')) // return all the last commits
    .pipe(_writeChangelog(githubRepo, version)); // return the final text
};


// publish for testing
exports.parseRawCommit = parseRawCommit;
