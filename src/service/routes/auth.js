const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth');

router.get('/workspace/v3/security/pure-cloud-token', (req, res) => {
  auth.pcToken(req, res);
});

router.get('/workspace/v3/security/exchange-token', (req, res) => {
  auth.jwToken(req, res);
});

router.get('/auth/v3/oauth/authorize', (req, res) => {
  auth.authorize(req, res);
});

router.post('/auth/v3/oauth/token', (req, res) => {
  auth.validateToken(req, res);
});

router.post('/auth/v3/auth-scheme', (req, res) => {
  auth.authenticate(req, res);
});

router.post('/auth/v3/sign-in', (req, res) => {
  auth.signin(req, res);
});

router.post('/auth/v3/token', (req, res) => {
  auth.token(req, res);
});

router.use('/auth/v3/userinfo', (req, res) => {
  auth.userinfo(req, res);
});

router.use('/workspace/v3/auth-keep-alive', (req, res) => {
  res.status(200).end();
});

router.use('/workspace/v3/logout', (req, res) => {
  auth.logout(req, res);
});

module.exports = router;