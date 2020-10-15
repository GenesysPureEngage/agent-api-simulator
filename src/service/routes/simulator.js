/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const express = require('express');
const router = express.Router();
const config = require('../config/agent-api-simulator.json');
const voice = require('../controllers/voice');
const rmm = require('../common/rmm');
const media = require('../controllers/media');
const messaging = require('../controllers/messaging');
const utils = require('../common/utils');
const notifications = require('../common/notifications');

// get agent groups
var agentGroups = utils.requireAndMonitor('../../../data/agent-groups.yaml', (updated) => { agentGroups = updated; });

// access workspace
router.get('/sim/workspace-ui', (req, res) => {
  res.redirect(req.protocol + `://${req.hostname}:${config.port}/ui/wwe/index.html`);
});

// check if the toolkit sample is hosted
router.get('/sim/is-toolkit-sample', (req, res) => {
  res.json({
    isToolkitSample: global.isToolkitSample
  });
});

// create a new call
router.post('/sim/manage/voice/create-call', (req, res) => {
  const call = voice.createCall(
    req.body.callType,
    null,
    req.body.agent,
    req.body.orig,
    null,
    req.body.defaultAttachedData
  );
  if (!call) {
    res.status(400).json({ message: 'Failed to create the call' });
    return
  }
  voice.publishAgentCallEvent(req.body.agent, call.destCall);
  res.status(200).json({ message: 'Success' });
});

// create a new voice mail
router.post('/sim/manage/voice/create-voice-mail', (req, res) => {
  voice.createVoiceMail(
    req.body.agent,
    req.body.newmessages,
    req.body.oldmessages,
    req.body.groupName
  );
  res.status(200).json({ message: 'Success' });
});

// create a new email
router.post('/sim/manage/email/create-email', (req, res) => {
  media.createEmail(req.body.agent, req.body.from, req.body.to, req.body.subject, req.body.content);
  res.status(200).json({ message: 'Success' });
});

// create a new workitem
router.post('/sim/manage/workitem/create-workitem', (req, res) => {
  media.createWorkitem(req.body.agent, req.body.fn, req.body.ln, req.body.email, req.body.subject);
  res.status(200).json({ message: 'Success' });
});

// get current sessions
router.get('/sim/monitor/get-sessions', (req, res) => {
  res.send(messaging.getSessions());
});

// get session interactions
router.get('/sim/monitor/get-interactions', (req, res) => {
  const interactions = rmm.getInteractionsSummary(req.query.agent);
  if (interactions === null){
    res.status(400).json({message: 'No interactions found for this agent.'});
  }else{
    res.status(200).send(interactions);
  }
});

// get interaction data
router.get('/sim/monitor/get-ixn-user-data', (req, res) => {
  const interactionData = rmm.getInteractionUserData(req.query.id);
  if (interactionData){
    res.status(200).send(interactionData);
  }else{
    res.status(400).send({message: 'No interaction found with this id.'});
  }
});

// get agent groups
router.get('/sim/monitor/get-agent-groups', (req, res) => {
  res.send(agentGroups);
});

// send a notification
router.post('/sim/manage/service-state-change-notification/create-notification', (req, res) => {
  const msg = {
    serviceName: req.body.serviceName,
    serviceState: req.body.serviceState,
    messageType: 'ServiceStateChanged'
  };

  switch (msg.serviceName) {
    case 'VOICE':
      messaging.publish(req.body.agent, '/workspace/v3/voice', msg);
      break;
    case 'IXN':
      messaging.publish(req.body.agent, '/workspace/v3/media', msg);
      break;
    case 'UCS':
      messaging.publish(req.body.agent, '/workspace/v3/contacts', msg);
      break;
    case 'STATS':
      messaging.publish(req.body.agent, '/workspace/v3/statistics', msg);
      break;
    default:
      res.status(400).send({ message: 'Service unknown' });
      return;
  }
  res.status(200).send({ message: 'Success' });
});


// Endpoint for cometd

router.use('/simulator/notifications', (req, res) => {
  if (req.method == 'OPTIONS'){
    res.end();
    return;
  }
  notifications.handle(req, res);
});

module.exports = router;