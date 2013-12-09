# conventional-changelog-wrapper [![Build Status](https://travis-ci.org/douglasduteil/conventional-changelog-wrapper.png?branch=master)](https://travis-ci.org/douglasduteil/conventional-changelog-wrapper)

Generate a changelog from git metadata, using [these](https://docs.google.com/document/d/1QrDFcIiPjSLDn3EL15IJygNPiHORgU1_OOAqWjiDU5Y/) conventions. Fork of [grunt-conventional-changelog](https://github.com/btford/grunt-conventional-changelog)

## Example output
- https://github.com/btford/conventional-changelog-wrapper/blob/master/CHANGELOG.md
- https://github.com/karma-runner/karma/blob/master/CHANGELOG.md

## Usage

```javascript
var changelogWrapper = require('conventional-changelog-wrapper');

changelogWrapper.generate(
  'https://github.com/douglasduteil/conventional-changelog-wrapper',
  'v1.0.0'
).pipe(process.stdout);

```

## API

Just one fonction to generate a changelog

#### changelogWrapper.generate(githubRepo, version)
 * githubRepo : the github repository to use to link to commits in the changelog.
 * version : a string which contains the value of the version which is used by the generator.

## Gulp friendly

```javascript
var pkg = require('./package.json');
var gulp = require('gulp');
var gulp_util = require('gulp-util');
var es = require('event-stream');

changelogWrapper.generate(pkg.homepage, 'v' + pkg.version)
  .pipe(
    es.map(function fakeFile(content, cb){
      return cb(null, new gulp_util.File({
        path: './changelog.md', cwd: './', base: './',
        contents: new Buffer(content)
      }));
    })
  )
  .pipe(gulp.dest('./'));
```



## License
BSD
