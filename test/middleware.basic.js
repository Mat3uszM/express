
var express = require('../');
var request = require('./support/supertest');

describe('middleware', function(){
  describe('.next()', function(){
    it('should behave like connect', function(done){
      var app = express()
        , calls = [];

      app.use(function(req, res, next){
        calls.push('one');
        next();
      });

      app.use(function(req, res, next){
        calls.push('two');
        next();
      });

      app.use(function(req, res){
        var buf = '';
        res.setHeader('Content-Type', 'application/json');
        req.setEncoding('utf8');
        req.on('data', function(chunk){ buf += chunk });
        req.on('end', function(){
          res.end(buf);
        });
      });

      request(app)
      .put('/')
      .set('Content-Type', 'application/json')
      .send('{"foo":"bar"}')
      .expect('Content-Type', 'application/json')
      .expect(200, '{"foo":"bar"}', done)
    })
  })
})
