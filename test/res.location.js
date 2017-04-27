
var express = require('../')
  , request = require('supertest');

describe('res', function(){
  describe('.location(url)', function(){
    it('should set the header', function(done){
      var app = express();

      app.use(function(req, res){
        res.location('http://google.com').end();
      });

      request(app)
      .get('/')
      .expect('Location', 'http://google.com')
      .expect(200, done)
    })

    it('should encode "url"', function (done) {
      var app = express()

      app.use(function (req, res) {
        res.location('https://google.com?q=\u2603 §10').end()
      })

      request(app)
      .get('/')
      .expect('Location', 'https://google.com?q=%E2%98%83%20%C2%A710')
      .expect(200, done)
    })

    it('should not touch already-encoded sequences in "url"', function (done) {
      var app = express()

      app.use(function (req, res) {
        res.location('https://google.com?q=%A710').end()
      })

      request(app)
      .get('/')
      .expect('Location', 'https://google.com?q=%A710')
      .expect(200, done)
    })

    it('should set the header to "/" on back', function (done) {
      var app = express()

      app.use(function (req, res) {
        res.location('back').end()
      })

      request(app)
      .get('/')
      .expect('Location', '/')
      .expect(200, done)
    })

    it('should set the header to "next" on back', function (done) {
      var app = express()

      app.use(function (req, res) {
        res.location('back').end()
      })

      request(app)
      .get('/')
      .set('Referrer', '/next')
      .expect('Location', '/next')
      .expect(200, done)
    })
  })
})
