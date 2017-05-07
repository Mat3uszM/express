
const after = require('after');
const express = require('../')
const request = require('supertest')
const assert = require('assert');
const onFinished = require('on-finished');
const path = require('path');
const should = require('should');
const fixtures = path.join(__dirname, 'fixtures');
const utils = require('./support/utils');

describe('res', function(){
  describe('.sendFile(path)', function () {
    it('should error missing path', function (done) {
      const app = createApp();

      request(app)
      .get('/')
      .expect(500, /path.*required/, done);
    });

    it('should transfer a file', function (done) {
      const app = createApp(path.resolve(fixtures, 'name.txt'));

      request(app)
      .get('/')
      .expect(200, 'tobi', done);
    });

    it('should transfer a file with special characters in string', function (done) {
      const app = createApp(path.resolve(fixtures, '% of dogs.txt'));

      request(app)
      .get('/')
      .expect(200, '20%', done);
    });

    it('should include ETag', function (done) {
      const app = createApp(path.resolve(fixtures, 'name.txt'));

      request(app)
      .get('/')
      .expect('ETag', /^(?:W\/)?"[^"]+"$/)
      .expect(200, 'tobi', done);
    });

    it('should 304 when ETag matches', function (done) {
      const app = createApp(path.resolve(fixtures, 'name.txt'));

      request(app)
      .get('/')
      .expect('ETag', /^(?:W\/)?"[^"]+"$/)
      .expect(200, 'tobi', function (err, res) {
        if (err) return done(err);
        const etag = res.headers.etag;
        request(app)
        .get('/')
        .set('If-None-Match', etag)
        .expect(304, done);
      });
    });

    it('should 404 for directory', function (done) {
      const app = createApp(path.resolve(fixtures, 'blog'));

      request(app)
      .get('/')
      .expect(404, done);
    });

    it('should 404 when not found', function (done) {
      const app = createApp(path.resolve(fixtures, 'does-no-exist'));

      app.use(function (req, res) {
        res.statusCode = 200;
        res.send('no!');
      });

      request(app)
      .get('/')
      .expect(404, done);
    });

    it('should not override manual content-types', function (done) {
      const app = express();

      app.use(function (req, res) {
        res.contentType('application/x-bogus');
        res.sendFile(path.resolve(fixtures, 'name.txt'));
      });

      request(app)
      .get('/')
      .expect('Content-Type', 'application/x-bogus')
      .end(done);
    })

    it('should not error if the client aborts', function (done) {
      const cb = after(1, done);
      const app = express();

      app.use(function (req, res) {
        setImmediate(function () {
          res.sendFile(path.resolve(fixtures, 'name.txt'));
          cb();
        });
        test.abort();
      });

      app.use(function (err, req, res, next) {
        err.code.should.be.empty()
        cb();
      });

      const test = request(app).get('/');
      test.expect(200, cb);
    })

    describe('with "cacheControl" option', function () {
      it('should enable cacheControl by default', function (done) {
        const app = createApp(path.resolve(__dirname, 'fixtures/name.txt'))

        request(app)
        .get('/')
        .expect('Cache-Control', 'public, max-age=0')
        .expect(200, done)
      })

      it('should accept cacheControl option', function (done) {
        const app = createApp(path.resolve(__dirname, 'fixtures/name.txt'), { cacheControl: false })

        request(app)
        .get('/')
        .expect(utils.shouldNotHaveHeader('Cache-Control'))
        .expect(200, done)
      })
    })

    describe('with "dotfiles" option', function () {
      it('should not serve dotfiles by default', function (done) {
        const app = createApp(path.resolve(__dirname, 'fixtures/.name'));

        request(app)
        .get('/')
        .expect(404, done);
      });

      it('should accept dotfiles option', function(done){
        const app = createApp(path.resolve(__dirname, 'fixtures/.name'), { dotfiles: 'allow' });

        request(app)
        .get('/')
        .expect(200, 'tobi', done);
      });
    });

    describe('with "headers" option', function () {
      it('should accept headers option', function (done) {
        var headers = {
          'x-success': 'sent',
          'x-other': 'done'
        };
        const app = createApp(path.resolve(__dirname, 'fixtures/name.txt'), { headers: headers });

        request(app)
        .get('/')
        .expect('x-success', 'sent')
        .expect('x-other', 'done')
        .expect(200, done);
      });

      it('should ignore headers option on 404', function (done) {
        const headers = { 'x-success': 'sent' };
        const app = createApp(path.resolve(__dirname, 'fixtures/does-not-exist'), { headers: headers });

        request(app)
        .get('/')
        .expect(utils.shouldNotHaveHeader('X-Success'))
        .expect(404, done);
      });
    });

    describe('with "root" option', function () {
      it('should not transfer relative with without', function (done) {
        const app = createApp('test/fixtures/name.txt');

        request(app)
        .get('/')
        .expect(500, /must be absolute/, done);
      })

      it('should serve relative to "root"', function (done) {
        const app = createApp('name.txt', {root: fixtures});

        request(app)
        .get('/')
        .expect(200, 'tobi', done);
      })

      it('should disallow requesting out of "root"', function (done) {
        const app = createApp('foo/../../user.html', {root: fixtures});

        request(app)
        .get('/')
        .expect(403, done);
      })
    })
  })

  describe('.sendFile(path, fn)', function () {
    it('should invoke the callback when complete', function (done) {
      const cb = after(2, done);
      const app = createApp(path.resolve(fixtures, 'name.txt'), cb);

      request(app)
      .get('/')
      .expect(200, cb);
    })

    it('should invoke the callback when client aborts', function (done) {
      const cb = after(1, done);
      const app = express();

      app.use(function (req, res) {
        setImmediate(function () {
          res.sendFile(path.resolve(fixtures, 'name.txt'), function (err) {
            should(err).be.ok()
            err.code.should.equal('ECONNABORTED');
            cb();
          });
        });
        test.abort();
      });

      var test = request(app).get('/');
      test.expect(200, cb);
    })

    it('should invoke the callback when client already aborted', function (done) {
      const cb = after(1, done);
      const app = express();

      app.use(function (req, res) {
        onFinished(res, function () {
          res.sendFile(path.resolve(fixtures, 'name.txt'), function (err) {
            should(err).be.ok()
            err.code.should.equal('ECONNABORTED');
            cb();
          });
        });
        test.abort();
      });

      var test = request(app).get('/');
      test.expect(200, cb);
    })

    it('should invoke the callback without error when HEAD', function (done) {
      const app = express();
      const cb = after(2, done);

      app.use(function (req, res) {
        res.sendFile(path.resolve(fixtures, 'name.txt'), cb);
      });

      request(app)
      .head('/')
      .expect(200, cb);
    });

    it('should invoke the callback without error when 304', function (done) {
      const app = express();
      const cb = after(3, done);

      app.use(function (req, res) {
        res.sendFile(path.resolve(fixtures, 'name.txt'), cb);
      });

      request(app)
      .get('/')
      .expect('ETag', /^(?:W\/)?"[^"]+"$/)
      .expect(200, 'tobi', function (err, res) {
        if (err) return cb(err);
        var etag = res.headers.etag;
        request(app)
        .get('/')
        .set('If-None-Match', etag)
        .expect(304, cb);
      });
    });

    it('should invoke the callback on 404', function(done){
      const app = express();

      app.use(function (req, res) {
        res.sendFile(path.resolve(fixtures, 'does-not-exist'), function (err) {
          should(err).be.ok()
          err.status.should.equal(404);
          res.send('got it');
        });
      });

      request(app)
      .get('/')
      .expect(200, 'got it', done);
    })
  })

  describe('.sendFile(path, options)', function () {
    it('should pass options to send module', function (done) {
      request(createApp(path.resolve(fixtures, 'name.txt'), { start: 0, end: 1 }))
      .get('/')
      .expect(200, 'to', done)
    })
  })

  describe('.sendfile(path, fn)', function(){
    it('should invoke the callback when complete', function(done){
      const app = express();
      const cb = after(2, done);

      app.use(function(req, res){
        res.sendfile('test/fixtures/user.html', cb)
      });

      request(app)
      .get('/')
      .expect(200, cb);
    })

    it('should utilize the same options as express.static()', function(done){
      const app = express();

      app.use(function(req, res){
        res.sendfile('test/fixtures/user.html', { maxAge: 60000 });
      });

      request(app)
      .get('/')
      .expect('Cache-Control', 'public, max-age=60')
      .end(done);
    })

    it('should invoke the callback when client aborts', function (done) {
      const cb = after(1, done);
      const app = express();

      app.use(function (req, res) {
        setImmediate(function () {
          res.sendfile('test/fixtures/name.txt', function (err) {
            should(err).be.ok()
            err.code.should.equal('ECONNABORTED');
            cb();
          });
        });
        test.abort();
      });

      var test = request(app).get('/');
      test.expect(200, cb);
    })

    it('should invoke the callback when client already aborted', function (done) {
      const cb = after(1, done);
      const app = express();

      app.use(function (req, res) {
        onFinished(res, function () {
          res.sendfile('test/fixtures/name.txt', function (err) {
            should(err).be.ok()
            err.code.should.equal('ECONNABORTED');
            cb();
          });
        });
        test.abort();
      });

      var test = request(app).get('/');
      test.expect(200, cb);
    })

    it('should invoke the callback without error when HEAD', function (done) {
      const app = express();
      const cb = after(2, done);

      app.use(function (req, res) {
        res.sendfile('test/fixtures/name.txt', cb);
      });

      request(app)
      .head('/')
      .expect(200, cb);
    });

    it('should invoke the callback without error when 304', function (done) {
      const app = express();
      const cb = after(3, done);

      app.use(function (req, res) {
        res.sendfile('test/fixtures/name.txt', cb);
      });

      request(app)
      .get('/')
      .expect('ETag', /^(?:W\/)?"[^"]+"$/)
      .expect(200, 'tobi', function (err, res) {
        if (err) return cb(err);
        var etag = res.headers.etag;
        request(app)
        .get('/')
        .set('If-None-Match', etag)
        .expect(304, cb);
      });
    });

    it('should invoke the callback on 404', function(done){
      const app = express();
      var calls = 0;

      app.use(function(req, res){
        res.sendfile('test/fixtures/nope.html', function(err){
          assert.equal(calls++, 0);
          assert(!res.headersSent);
          res.send(err.message);
        });
      });

      request(app)
      .get('/')
      .expect(200, /^ENOENT.*?, stat/, done);
    })

    it('should not override manual content-types', function(done){
      const app = express();

      app.use(function(req, res){
        res.contentType('txt');
        res.sendfile('test/fixtures/user.html');
      });

      request(app)
      .get('/')
      .expect('Content-Type', 'text/plain; charset=utf-8')
      .end(done);
    })

    it('should invoke the callback on 403', function(done){
      const app = express()

      app.use(function(req, res){
        res.sendfile('test/fixtures/foo/../user.html', function(err){
          assert(!res.headersSent);
          res.send(err.message);
        });
      });

      request(app)
      .get('/')
      .expect('Forbidden')
      .expect(200, done);
    })

    it('should invoke the callback on socket error', function(done){
      const app = express()

      app.use(function(req, res){
        res.sendfile('test/fixtures/user.html', function(err){
          assert(!res.headersSent);
          req.socket.listeners('error').should.have.length(1); // node's original handler
          done();
        });

        req.socket.emit('error', new Error('broken!'));
      });

      request(app)
      .get('/')
      .end(function(){});
    })
  })

  describe('.sendfile(path)', function(){
    it('should not serve dotfiles', function(done){
      const app = express();

      app.use(function(req, res){
        res.sendfile('test/fixtures/.name');
      });

      request(app)
      .get('/')
      .expect(404, done);
    })

    it('should accept dotfiles option', function(done){
      const app = express();

      app.use(function(req, res){
        res.sendfile('test/fixtures/.name', { dotfiles: 'allow' });
      });

      request(app)
      .get('/')
      .expect(200, 'tobi', done);
    })

    it('should accept headers option', function(done){
      const app = express();
      const headers = {
        'x-success': 'sent',
        'x-other': 'done'
      };

      app.use(function(req, res){
        res.sendfile('test/fixtures/user.html', { headers: headers });
      });

      request(app)
      .get('/')
      .expect('x-success', 'sent')
      .expect('x-other', 'done')
      .expect(200, done);
    })

    it('should ignore headers option on 404', function(done){
      const app = express();
      const headers = { 'x-success': 'sent' };

      app.use(function(req, res){
        res.sendfile('test/fixtures/user.nothing', { headers: headers });
      });

      request(app)
      .get('/')
        .expect(utils.shouldNotHaveHeader('X-Success'))
        .expect(404, done);
    })

    it('should transfer a file', function (done) {
      const app = express();

      app.use(function (req, res) {
        res.sendfile('test/fixtures/name.txt');
      });

      request(app)
      .get('/')
      .expect(200, 'tobi', done);
    });

    it('should transfer a directory index file', function (done) {
      const app = express();

      app.use(function (req, res) {
        res.sendfile('test/fixtures/blog/');
      });

      request(app)
      .get('/')
      .expect(200, '<b>index</b>', done);
    });

    it('should 404 for directory without trailing slash', function (done) {
      const app = express();

      app.use(function (req, res) {
        res.sendfile('test/fixtures/blog');
      });

      request(app)
      .get('/')
      .expect(404, done);
    });

    it('should transfer a file with urlencoded name', function (done) {
      const app = express();

      app.use(function (req, res) {
        res.sendfile('test/fixtures/%25%20of%20dogs.txt');
      });

      request(app)
      .get('/')
      .expect(200, '20%', done);
    });

    it('should not error if the client aborts', function (done) {
      const cb = after(1, done);
      const app = express();

      app.use(function (req, res) {
        setImmediate(function () {
          res.sendfile(path.resolve(fixtures, 'name.txt'));
          cb();
        });
        test.abort();
      });

      app.use(function (err, req, res, next) {
        err.code.should.be.empty()
        cb();
      });

      var test = request(app).get('/');
      test.expect(200, cb);
    })

    describe('with an absolute path', function(){
      it('should transfer the file', function(done){
        const app = express();

        app.use(function(req, res){
          res.sendfile(path.join(__dirname, '/fixtures/user.html'))
        });

        request(app)
        .get('/')
        .expect('Content-Type', 'text/html; charset=UTF-8')
        .expect(200, '<p>{{user.name}}</p>', done);
      })
    })

    describe('with a relative path', function(){
      it('should transfer the file', function(done){
        const app = express();

        app.use(function(req, res){
          res.sendfile('test/fixtures/user.html');
        });

        request(app)
        .get('/')
        .expect('Content-Type', 'text/html; charset=UTF-8')
        .expect(200, '<p>{{user.name}}</p>', done);
      })

      it('should serve relative to "root"', function(done){
        const app = express();

        app.use(function(req, res){
          res.sendfile('user.html', { root: 'test/fixtures/' });
        });

        request(app)
        .get('/')
        .expect('Content-Type', 'text/html; charset=UTF-8')
        .expect(200, '<p>{{user.name}}</p>', done);
      })

      it('should consider ../ malicious when "root" is not set', function(done){
        const app = express();

        app.use(function(req, res){
          res.sendfile('test/fixtures/foo/../user.html');
        });

        request(app)
        .get('/')
        .expect(403, done);
      })

      it('should allow ../ when "root" is set', function(done){
        const app = express();

        app.use(function(req, res){
          res.sendfile('foo/../user.html', { root: 'test/fixtures' });
        });

        request(app)
        .get('/')
        .expect(200, done);
      })

      it('should disallow requesting out of "root"', function(done){
        const app = express();

        app.use(function(req, res){
          res.sendfile('foo/../../user.html', { root: 'test/fixtures' });
        });

        request(app)
        .get('/')
        .expect(403, done);
      })

      it('should next(404) when not found', function(done){
        const app = express()
        var calls = 0;

        app.use(function(req, res){
          res.sendfile('user.html');
        });

        app.use(function(req, res){
          assert(0, 'this should not be called');
        });

        app.use(function(err, req, res, next){
          ++calls;
          next(err);
        });

        request(app)
        .get('/')
        .end(function(err, res){
          res.statusCode.should.equal(404);
          calls.should.equal(1);
          done();
        });
      })

      describe('with non-GET', function(){
        it('should still serve', function(done){
<<<<<<< HEAD
<<<<<<< HEAD
          const app = express()
=======
=======
>>>>>>> more var to const changes
<<<<<<< HEAD
          var app = express()
=======
          const app = express()
          var calls = 0;
>>>>>>> more var to const changes
<<<<<<< HEAD
=======
=======
          const app = express()
>>>>>>> more var to const changes
>>>>>>> more var to const changes

          app.use(function(req, res){
            res.sendfile(path.join(__dirname, '/fixtures/name.txt'))
          });

          request(app)
          .get('/')
          .expect('tobi', done);
        })
      })
    })
  })
})

describe('.sendfile(path, options)', function () {
  it('should pass options to send module', function (done) {
    const app = express()

    app.use(function (req, res) {
      res.sendfile(path.resolve(fixtures, 'name.txt'), { start: 0, end: 1 })
    })

    request(app)
      .get('/')
      .expect(200, 'to', done)
  })
})

function createApp(path, options, fn) {
  const app = express();

  app.use(function (req, res) {
    res.sendFile(path, options, fn);
  });

  return app;
}
