/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const auth = require('../controllers/auth');
const express = require('express');
const router = express.Router();
const conf = require('../controllers/conf');
const voice = require('../controllers/voice');

function defaultResponse(){
  return JSON.stringify({
    status: {
      code: 1
    },
    operationId: conf.id()
  })
}

router.use('/workspace/v3/voice/calls/:callid/:fn', (req, res) => {
  voice.handleCall(req, res);
});

// change state to ready
router.use('/workspace/v3/voice/ready', (req, res) => {
  voice.changeState(req, 'Ready');
  // respond with default response
  res.send(defaultResponse());
});

// change state to not ready
router.use('/workspace/v3/voice/not-ready', (req, res) => {
  voice.changeState(req, 'NotReady', req.body ? req.body.data : null);
  // respond with default response
  res.send(defaultResponse());
});

// change state to not ready with dnd true
router.use('/workspace/v3/voice/dnd-on', (req, res) => {
  voice.changeState(req, 'NotReady', { dnd: true });
  // respond with default response
  res.send(defaultResponse());
});

// change state to not ready with dnd false
router.use('/workspace/v3/voice/dnd-off', (req, res) => {
  voice.changeState(req, 'NotReady', { dnd: false });
  // respond with default response
  res.send(defaultResponse());
});

// change state to LoggedOut with dnd false
router.use('/workspace/v3/voice/logout', (req, res) => {
  voice.changeState(req, 'LoggedOut', { dnd: false });
  // respond with default response
  res.send(defaultResponse());
});

// send user event
router.use('/workspace/v3/voice/send-user-event', (req, res) => {
  // handle outbound request
  voice.handleOutboundRequest(req);
  // respond with default response
  res.send(defaultResponse());
});

// send user event
router.use('/workspace/v3/campaigns/:campaignName/configuration', (req, res) => {
  // send campaign configuration
  voice.sendCampaignConfiguration(req, res);
});

// make a call
router.use('/workspace/v3/voice/make-call', (req, res) => {
  // check for parameters
  if (!req.body.data || !req.body.data.destination) {
    res.status(400).json({ message: 'Missing parameters' });
    return;
  }
  // get username from request
  const userName = auth.userByCode(req);
  // get dest user
  const destUser = conf.userByDestination(req.body.data.destination);
  let call;
  if (destUser) {
    // create an internal call
    call = voice.createCall('Internal', userName, destUser.userName, null, null, req.body.data.userData, req.body.data.extensions);
  } else {
    // create an outbound call
    call = voice.createCall(
      'Outbound',
      userName,
      null,
      null,
      req.body.data.destination,
      req.body.data.userData,
      req.body.data.extensions
    );
  }
  voice.makeCall(call);
  // respond with default response
  res.send(defaultResponse());
});

router.use('/workspace/v3/voice/start-monitoring', (req, res) => {
  voice.startMonitoring(req);
  // respond with default response
  res.send(defaultResponse());
});

router.use('/workspace/v3/voice/stop-monitoring', (req, res) => {
  voice.stopMonitoring(req);
  // respond with default response
  res.send(defaultResponse());
});

module.exports = router;