/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const _ = require('underscore');
const path = require('path');
const fs = require('fs');

const auth = require('./auth');
const conf = require('./conf');
const log = require('../common/log');
const messaging = require('./messaging');
const rmm = require('../common/rmm');
const utils = require('../common/utils');
const notifications = require('../common/notifications');
const workbins = require('./workbins');

var emailAttachedData = utils.requireAndMonitor('../../../data/media/attached-data.yaml', (updated) => { emailAttachedData = updated; });
var workitemAttachedData = utils.requireAndMonitor('../../../data/media/attached-data.yaml', (updated) => { workitemAttachedData = updated; });
var pushPreviewAttachedData = utils.requireAndMonitor('../../../data/media/attached-data.yaml', (updated) => { pushPreviewAttachedData = updated; });

var interactions = {};
var interactionsByAgent = {};

exports.getInteraction = (ixnId) => {
  return interactions[ixnId];
}

exports.activateChannels = (req, res) => {
  res.set({ 'Content-type': 'application/json' });
  var data = {
    status: {
      code: 0
    },
    data: {
      channels: [
        'voice',
        'email',
        'workitem',
        'outboundpreview'
      ]
    }
  };
  res.send(JSON.stringify(data));
}

exports.initializeMediaData = (user) => {
  //Return user's current media state if they have one
  if (user.activeSession && user.activeSession.media) {
    return user.activeSession.media;
  } else {
    //Return default media state for logged off agents
    return {
      channels: [{
        name: 'email',
        state: 'NotReady',
        dnd: false,
        reasons: [],
        timestamp: Date.now()
      }, {
        name: 'workitem',
        state: 'NotReady',
        dnd: false,
        reasons: [],
        timestamp: Date.now()
      }, {
        name: 'outboundpreview',
        state: 'NotReady',
        dnd: false,
        reasons: [],
        timestamp: Date.now()
      }]
    };
  }
}

exports.handle = (req, res) => {
  res.set({ 'Content-type': 'application/json' });
  if (req.params.fn === 'ready') {
    exports.changeState(req, 'Ready');
    utils.sendOkStatus(req, res);
  } else if (req.params.fn === 'not-ready') {
    exports.changeState(req, 'NotReady', req.body ? req.body.data : null);
    utils.sendOkStatus(req, res);
  } else if (req.params.fn === 'dnd-on') {
    req.params.media = 'email';
    exports.changeState(req, 'NotReady', { dnd: true });
    req.params.media = 'workitem';
    exports.changeState(req, 'NotReady', { dnd: true });
    req.params.media = 'outboundpreview';
    exports.changeState(req, 'NotReady', { dnd: true });
    utils.sendOkStatus(req, res);
  } else if (req.params.fn === 'dnd-off') {
    req.params.media = 'email';
    exports.changeState(req, 'NotReady', { dnd: false });
    req.params.media = 'workitem';
    exports.changeState(req, 'NotReady', { dnd: false });
    req.params.media = 'outboundpreview';
    exports.changeState(req, 'NotReady', { dnd: false });
    utils.sendOkStatus(req, res);
  } else if (req.params.fn === 'logout') {
    exports.changeState(req, 'LoggedOut', { dnd: false });
    utils.sendOkStatus(req, res);
  } else {
    utils.sendFailureStatus(res, 501);
  }
}

exports.handleInteraction = (req, res) => {
  res.set({ 'Content-type': 'application/json' });
  var userName = auth.userByCode(req);
  var interaction = interactions[req.params.id];
  if (!interaction) {
    log.error('Interaction with ' + req.params.id + ' id does not exist for ' + userName);
  } else if (req.params.fn === 'complete' || req.params.fn === 'reject') {
    interaction.state = 'Completed';
    interaction.capabilities = [];
    utils.sendOkStatus(req, res);
    exports.publishInteractionEvent(req, interaction.mediatype, interaction);
    delete interaction[interaction.id];
    rmm.recordInteractionComplete(userName, interaction.id);
  } else if (req.params.fn === 'save') {
    exports.handleInteractionSave(req, res, interaction);
  } else if (req.params.fn === 'cancel') {
    interaction.state = 'Canceled';
    utils.sendOkStatus(req, res);
    exports.publishInteractionEvent(req, interaction.mediatype, interaction);
  } else if (req.params.fn === 'send') {
    interaction.state = 'Sent';
    utils.sendOkStatus(req, res);
    exports.publishInteractionEvent(req, interaction.mediatype, interaction);
  } else if (req.params.fn === 'reply') {
    exports.handleInteractionReply(req, res, interaction);
  } else if (req.params.fn === 'forward') {
    exports.handleInteractionForward(req, res, interaction);
  } else if (req.params.fn === 'update-user-data') {
    exports.handleInteractionUpdateUserdata(req, res, interaction);
  } else if (req.params.fn === 'set-comment') {
    utils.sendOkStatus(req, res);
    interaction.comment = req.body.data.comment;
    exports.publishInteractionEvent(req, interaction.mediatype, interaction);
  } else if (req.params.fn === 'pull') {
    utils.sendOkStatus(req, res);
    workbins.pull(req, res);
  } else if (req.params.fn === 'place-in-queue') {
    utils.sendOkStatus(req, res);
    workbins.placeInQueue(req, res);
  } else if (req.params.media === 'workitem') {
    exports.handleWorkitemInteraction(req, res, interaction);
  } else if (req.params.media === 'outboundpreview' || req.params.fn === 'publish') {
    exports.handleOutboundPreviewInteraction(req, res, interaction);
  } else {
    utils.sendFailureStatus(res, 501);
  }
}

exports.handleTopics = (req, res) => {
  res.set({ 'Content-type': 'application/json' });
  exports.handleOutboundPreviewInteraction(req, res);
}

exports.handleInteractionWithoutId = (req, res) => {
  res.set({ 'Content-type': 'application/json' });
  if (req.params.media === 'email') {
    if (req.params.fn === 'create') {
      exports.createOutboundEmail(req);
    }
    utils.sendOkStatus(req, res);
  } else {
    utils.sendFailureStatus(res, 501);
  }
}

exports.handleInteractionSave = (req, res, interaction) => {
  if (req.body.data.subject) {
    interaction.subject = req.body.data.subject;
    var el = _.find(interaction.userData, (ktv2) => { return ktv2.key === 'Subject'; });
    if (el) {
      el.value = interaction.subject;
    } else {
      interaction.userData.push({ key: 'Subject', type: 'str', value: interaction.subject });
    }
  }
  if (req.body.data.to) {
    interaction.email.to = req.body.data.to;
  }
  if (req.body.data.cc) {
    interaction.email.cc = req.body.data.cc;
  }
  if (req.body.data.bcc) {
    interaction.email.bcc = req.body.data.bcc;
  }
  if (req.body.data.bodyAsPlainText) {
    interaction.email.bodyAsPlainText = req.body.data.bodyAsPlainText;
  }
  if (req.body.data.body) {
    interaction.email.body = req.body.data.body;
  }
  utils.sendOkStatus(req, res);
  exports.publishInteractionEvent(req, interaction.mediatype, interaction, 'EmailSaved');
}

exports.handleInteractionReply = (req, res, interaction) => {
  utils.sendOkStatus(req, res);
  req.body.parentInteractionId = interaction.id;
  exports.createOutboundEmail(req);
}

exports.handleInteractionForward = (req, res, interaction) => {
  utils.sendOkStatus(req, res);
  req.body.parentInteractionId = interaction.id;
  exports.createOutboundEmail(req);
}

exports.handleInteractionUpdateUserdata = (req, res, interaction) => {
  _.each(req.body.data.userData, (ktv) => {
    var el = _.find(interaction.userData, (ktv2) => { return ktv2.key === ktv.key; });
    if (el) {
      el.value = ktv.value;
    } else {
      interaction.userData.push(ktv);
    }
    if (ktv.key === 'Subject') {
      interaction.subject = ktv.value;
    }
  });
  utils.sendOkStatus(req, res);
  exports.publishInteractionEvent(req, interaction.mediatype, interaction, 'PropertiesUpdated');
}

exports.handleWorkitemInteraction = (req, res, interaction) => {
  if (req.params.fn === 'accept') {
    interaction.state = 'Processing';
    interaction.capabilities = [
      "attach-user-data",
      "delete-user-data",
      "update-user-data",
      "place-in-queue",
      "transfer",
      "complete"
    ];
    utils.sendOkStatus(req, res);
    exports.publishInteractionEvent(req, interaction.mediatype, interaction);
  }
}

exports.handleOutboundPreviewInteraction = (req, res, interaction) => {
  if (req.params.fn === 'accept') {
    interaction.state = 'Processing';
    interaction.capabilities = [
      "attach-user-data",
      "delete-user-data",
      "update-user-data",
      "place-in-queue",
      "transfer",
      "complete"
    ];
    utils.sendOkStatus(req, res);
    exports.publishInteractionEvent(req, interaction.mediatype, interaction);
  } else if (req.body.data.eventContent) {
    request = _.find(req.body.data.eventContent, evt => {
      return evt.key === 'GSW_AGENT_REQ_TYPE';
    });
    recordHandle = _.find(req.body.data.eventContent, evt => {
      return evt.key === 'GSW_RECORD_HANDLE';
    });
    var userEvent;
    if (request.value === 'RecordReject') {
      userEvent = 'RecordRejectAcknowledge';
    } else if (request.value === 'RecordProcessed') {
      userEvent = 'RecordProcessedAcknowledge';
      //delete interaction[recordHandle.value];
    } else {
      userEvent = 'RecordCancelAcknowledge';
    }

    const filteredContent = _.filter(req.body.data.eventContent, evt => {
      return evt.key !== 'GSW_AGENT_REQ_TYPE';
    });
    filteredContent.push({
      'key': 'GSW_USER_EVENT',
      'type': 'str',
      'value': userEvent
    });
    const msg = {
      eventContent: filteredContent,
      messageType: 'EventUserEvent'
    };
    utils.sendOkStatus(req, res);
    messaging.publish(req, '/workspace/v3/media/topics', msg);
  }
}

changeMediState = (req, media, state, options) => {
  if (media) {
    media.state = state;
    if (options) {
      media.dnd = options.dnd;
      if (options.reasonCode) {
        media.reasons = [{ key: 'ReasonCode', type: 'str', value: options.reasonCode }];
      } else {
        media.reasons = [];
      }
    }
    var msg = {
      media: {
        channels: [media]
      },
      messageType: 'ChannelStateChanged'
    };
    media.timestamp = Date.now()
    messaging.publish(req, '/workspace/v3/media', msg);
    return true;
  }
}
exports.changeState = (req, state, options) => {
  var userName = typeof req === 'string' ? req : auth.userByCode(req);
  if (userName) {
    var user = conf.userByName(userName);
    if (user.activeSession && user.activeSession.media && user.activeSession.media.channels) {
      const mediaName = req && req.params ? req.params.media : (options ? options.media : null);
      if (mediaName) {
        const media = _.find(user.activeSession.media.channels, function (m) { return m.name === mediaName; });
        changeMediState(req, media, state, options);
      } else {
        _.each(user.activeSession.media.channels, (m) => {
          changeMediState(req, m, state, options);
        });
      }
    }
  }
  return false;
}

exports.publishInteractionEvent = (agent, media, interaction, notificationType) => {
  var msg = {
    notificationType: notificationType ? notificationType : 'StatusChange',
    interaction: interaction,
    messageType: 'InteractionStateChanged'
  }
  if(agent.body && agent.body.operationId)
    msg.operationId = agent.body.operationId;
  messaging.publish(agent, '/workspace/v3/media/' + media, msg);
  changeAgentMediaStatus(agent, media, interaction);
}

interactionsHandled = (agent, media) => {
  return interactionsByAgent[agent.userName] && interactionsByAgent[agent.userName][media] ? interactionsByAgent[agent.userName][media].length : 0;
}

isMediaCapacityFilled = (agent, media) => {
  return (agent.capacity ? agent.capacity : 1) <= interactionsHandled(agent, media);
}

changeAgentMediaStatus = (agent, media, interaction) => {
  const user = _.isString(agent) ? conf.userByName(agent) : conf.userByCode(agent);
  if (user && user.activeSession && user.activeSession.media && user.activeSession.media.channels) {
    const ch = _.find(user.activeSession.media.channels, ch => { return ch.name === media; });
    if (ch) {
      switch (interaction.state) {
        case 'Invited':
          ch.activity = 'DeliveringInteraction';
          ch.available = true;
          break;
        case 'Processing':
          switch(interaction.interactionType) {
            case 'Inbound': ch.activity = 'HandlingInboundInteraction'; break;
            case 'Internal': ch.activity = 'HandlingInternalInteraction'; break;
            case 'Outbound': ch.activity = 'HandlingOutboundInteraction'; break;
          }
          ch.available = !isMediaCapacityFilled(user, media);
          break;
        case 'Completed': case 'InWorkbin':
          deleteInteractionForAgent(user.userName, interaction.id, interaction.mediatype);
          if (interactionsHandled(user, media) === 0) {
            ch.activity = 'Idle';
            ch.available = true;
          } else {
            ch.available = !isMediaCapacityFilled(user, media);
          }
          break;
      }
    }
  }
}

var customerId = conf.id();
var systemId = conf.id();
var agentId = conf.id();

const mimeMapping = JSON.parse(conf.readDynConf('email/mime-mapping'));

exports.ext2mime = (ext) => {
  return mimeMapping[ext] ? mimeMapping[ext] : 'application/octet-stream';
}

exports.createEmail = (agent, from, to, subject, content) => {
  var emailid = conf.id();
  var now = '' + new Date();
  var email = {
    capabilities: [
      'attach-user-data', 'delete-user-data', 'update-user-data',
      'place-in-queue', 'transfer', 'complete',
      'reply', 'reply-all'
    ], //[ 'accept', 'reject' ],
    ticketId: 5,
    outQueues: [{
      'key': 'email-queue-for-qa-processing',
      'type': 'str',
      'value': ''
    }],
    proxyClientId: 11,
    submittedToRouterAt: '2019-01-21T10:42:26Z',
    inQueues: [{
      'key': '__STOP__',
      'type': 'str',
      'value': ''
    }, {
      'key': 'queue-for-inbound-email-postprocessing',
      'type': 'str',
      'value': ''
    }],
    interactionType: 'Inbound',
    id: emailid,
    receivedAt: now,
    isHeld: false,
    submittedBy: 'esv_esj',
    mediatype: 'email',
    tenantId: 1,
    queue: 'email-routing-queue-inbound',
    submitSeq: '50989059',
    movedToQueueAt: now,
    workflowState: 'Routing',
    submittedAt: now,
    placedInQueueAt: now,
    userData: emailAttachedData,
    interactionSubtype: 'InboundNew',
    isLocked: false,
    isOnline: false,
    placeInQueueSeq: '50989156',
    email: {
      from: from,
      to: [to]
    },
    subject: subject,
    state: 'Processing', // Invited
    isInWorkflow: true // false
  };
  var htmlBody = content || conf.readDynConf('email/html-body');
  var textBody = content || conf.readDynConf('email/text-body');
  if (htmlBody) {
    email.email.body = htmlBody;
    email.email.mime = 'text/html';
  } else if (textBody) {
    email.email.bodyAsPlainText = textBody;
    email.email.mime = 'text/plain';
  }
  var files = conf.readDynConfDir('email/att');
  var attachments = _.map(files, (fname) => {
    var attachmentId = conf.id();
    var fstat = conf.fstatDynConfDir('email/att', fname);
    var mime = exports.ext2mime(path.extname(fname));
    return {
      id: attachmentId,
      name: fname,
      mime: mime,
      size: fstat ? fstat.size : 0,
      path: 'media/email/interactions/' + emailid + '/attachments/' + attachmentId
    };
  });
  email.userData.push({
    key: 'Mailbox',
    type: 'str',
    value: 'a@a.com'
  });
  email.userData.push({
    key: '_AttachmentFileNames',
    type: 'str',
    value: attachments.join(',')
  });
  email.attachments = attachments;
  interactions[emailid] = email;
  addInteractionForAgent(agent, email);
  exports.publishInteractionEvent(agent, 'email', email);
}

exports.createOutboundEmail = (req) => {
  var userName = auth.userByCode(req);
  if (userName) {
    const isReply = req.body.data.operationName === 'Reply';
    var emailid = conf.id();
    var now = '' + new Date();
    var email = {
      id: emailid,
      mediatype: 'email',
      interactionType: 'Outbound',
      interactionSubtype: isReply ? 'OutboundReply' : 'OutboundNew',
      capabilities: [
        'attach-user-data', 'delete-user-data', 'update-user-data',
        'place-in-queue', 'transfer',
        'send', 'cancel', 'save', 'set-comment', 'assign-contact', 'add-attachment'
      ],
      email: {
        from: req.body.data.from,
        to: isReply ? req.body.data.to : [ req.body.data.to ]
      },
      userData: req.body.data.userData,
      queue: req.body.data.queue,
      state: 'Composing',
      isInWorkflow: true,
      ucsContent: 'available'
    };
    if (req.body.data.cc) {
      email.email.cc = req.body.data.cc;
    }
    if (req.body.data.mime) {
      email.email.mime = req.body.data.mime;
    }
    if (req.body.data.subject) {
      email.subject = req.body.data.subject;
    }
    if (req.body.data.body) {
      email.email.body = req.body.data.body;
    }
    if (req.body.data.bodyAsPlainText) {
      email.email.body = req.body.data.bodyAsPlainText;
    }
    if (req.body.parentInteractionId) {
      email.parentInteractionId = req.body.parentInteractionId;
    }
    interactions[emailid] = email;
    addInteractionForAgent(userName, email);
    exports.publishInteractionEvent(req, 'email', email);
  }
}

exports.createWorkitem = (agent, fn, ln, email, subject) => {
  var interactionId = conf.id();
  var now = '' + new Date();
  var interaction = {
    capabilities: ["accept", "reject"],
    ticketId: 5,
    outQueues: [{
			"key": "open-media-send-queue",
      'type': 'str',
      'value': ''
    }],
    proxyClientId: 11,
    submittedToRouterAt: '2019-01-21T10:42:26Z',
    inQueues: [{
      'key': '__STOP__',
      'type': 'str',
      'value': ''
    }, {
			"key": "queue-poubelle",
      'type': 'str',
      'value': ''
    }],
    interactionType: 'Inbound',
    id: interactionId,
    receivedAt: now,
    isHeld: false,
    submittedBy: 'OpenMediaSubmiter',
    mediatype: 'workitem',
    tenantId: 1,
    queue: 'workitem-routing-queue-inbound',
    submitSeq: '50989059',
    movedToQueueAt: now,
    workflowState: 'Routing',
    submittedAt: now,
    placedInQueueAt: now,
    userData: workitemAttachedData,
    interactionSubtype: 'InboundNew',
    isLocked: false,
    isOnline: false,
    placeInQueueSeq: '50989156',
    subject: subject,
    state: 'Invited',
    isInWorkflow: false
  };
  interaction.userData.push({
    "key": "Subject",
    "type": "str",
    "value": subject
  });
  interactions[interactionId] = interaction;
  addInteractionForAgent(agent, interaction);
  exports.publishInteractionEvent(agent, 'workitem', interaction);
}

exports.createOutboundPushPreview = (agent) => {
  var interactionId = conf.id();
  var now = '' + new Date();
  var interaction = {
    capabilities: ["accept", "reject"],
    ticketId: 5,
    proxyClientId: 11,
    submittedToRouterAt: '2019-01-21T10:42:26Z',
    inQueues: [],
    interactionType: 'Internal',
    id: interactionId,
    receivedAt: now,
    isHeld: false,
    submittedBy: 'OCS',
    mediatype: 'outboundpreview',
    tenantId: 1,
    queue: 'outboundpreview-queue',
    submitSeq: '203534919',
    movedToQueueAt: now,
    workflowState: 'Routing',
    submittedAt: now,
    placedInQueueAt: now,
    userData: pushPreviewAttachedData,
    interactionSubtype: 'OutboundNew',
    isLocked: false,
    isOnline: false,
    placeInQueueSeq: '203536922',
    state: 'Invited',
    isInWorkflow: false
  };

  interaction.userData.push({
    key: 'GSW_PHONE',
    type: 'str',
    value: '+33647000'
  }, {
    key: "GSW_FROM",
    type: "int",
    value: 0
  }, {
    key: "GSW_UNTIL",
    type: "int",
    value: 86340
  }, {
    key: "GSW_CALLING_LIST",
    type: "str",
    value: "Calling List SIP 2"
  }, {
    key: "GSW_CAMPAIGN_NAME",
    type: "str",
    value: "CampaignSIP2"
  }, {
    key: "GSW_RECORD_HANDLE",
    type: "int",
    value: interactionId
  }, {
    key: "GSW_APPLICATION_ID",
    type: "int",
    value: 139
  }, {
    key: "GSW_CHAIN_ID",
    type: "int",
    value: 2
  });

  interactions[interactionId] = interaction;
  addInteractionForAgent(agent, interaction);
  exports.publishInteractionEvent(agent, 'outboundpreview', interaction);
}

addInteractionForAgent = (agent, interaction) => {
  if (!interactionsByAgent[agent]) {
    interactionsByAgent[agent] = {};
  }
  if (!interactionsByAgent[agent][interaction.mediatype]) {
    interactionsByAgent[agent][interaction.mediatype] = [];
  }
  interactionsByAgent[agent][interaction.mediatype].push(interaction);
  rmm.recordInteraction(agent, interaction);
}

deleteInteractionForAgent = (agentName, interactionId, mediaType) => {
  if (interactionsByAgent[agentName] && interactionsByAgent[agentName][mediaType]) {
    const idx = _.findIndex(interactionsByAgent[agentName][mediaType], i => { return i.id === interactionId; });
    if (idx > -1) {
      interactionsByAgent[agentName][mediaType].splice(idx, 1);
    }
  }
}

exports.getInteractionsForAgent = (agentUserName, channel) => {
  var agentInteractions = [];

  if (channel && interactionsByAgent[agentUserName] && interactionsByAgent[agentUserName][channel]) {
    agentInteractions = interactionsByAgent[agentUserName][channel];
  } else {
    //Otherwise concatenate all interactions for agent if no channel specified
    if (interactionsByAgent[agentUserName]) {
      Object.values(interactionsByAgent[agentUserName]).forEach(function (ixns) {
        agentInteractions = agentInteractions.concat(ixns);
      });
    }
  }

  _.filter(agentInteractions, function (interaction) { return interaction.state !== 'Completed'; });

  return agentInteractions;
}