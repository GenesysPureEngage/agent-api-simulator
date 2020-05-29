const express = require('express');
const router = express.Router();
const conf = require('../controllers/settings');

router.get('/configuration/v3/system/application', (req, res) => {
  conf.application(req, res);
});

router.get('/configuration/v3/objects/agent-groups', (req, res) => {
  conf.agentGroup(req, res);
});

router.get('/configuration/v3/objects/persons', (req, res) => {
  conf.person(req, res);
});

module.exports = router;