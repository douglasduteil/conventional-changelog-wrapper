var changelogWrapper = require('../');
var es = require('event-stream');
var should = require('should');
require('mocha');

describe('conventional-changelog-wrapper', function() {
  describe('generate()', function() {

    it('should return a stream', function(done) {
      var stream = changelogWrapper.generate('repo', 'version');
      should.exist(stream);
      should.exist(stream.on);
      done();
    });

    it('should return a output stream with some content', function(done) {
      changelogWrapper.generate('repo', 'version').pipe(
        es.map(function(content){
          should.exist(content);
          content.substr(0, content.indexOf('\n')).should.eql('<a name="version"></a>');
          done();
        })
      );
    });

  });
});
