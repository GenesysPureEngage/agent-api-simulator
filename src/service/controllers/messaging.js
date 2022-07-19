/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const cometd = require('cometd-nodejs-server');
const _ = require('underscore');

const auth = require('./auth');
const conf = require('./conf');
const log = require('../common/log');
const media = require('./media');
const reporting = require('./reporting');
const voice = require('./voice');

const config = require('../config/agent-api-simulator.json');
const cometdOptions = {};
if (config.protocol === 'https') {
	cometdOptions.browserCookieSecure = true;
  cometdOptions.browserCookieSameSite = 'None';
}

const cometdServer = cometd.createCometDServer(cometdOptions);

var sessions = {}; // user name -> session
const secondaryTabsSessions = {}; //object with arrays of sessions to support multi-tabs

exports.start = () => {
	cometdServer.addListener('sessionAdded', sessionAdded);
}

exports.handle = (req, res) => {
	cometdServer.handle(req, res);
}

exports.getCurrentSession = (req, res) => {
	var userName = auth.userByCode(req);
	if (userName) {
		var session = sessions[userName] && sessions[userName].length && sessions[userName][0];
		var configuration = conf.conf(userName);
		var user = conf.userByName(userName);

    if (!user.activeSession) {
      return res.status(403).end();
    }

    // Populate list of calls
    user.activeSession.calls = voice.getCallsForAgent(userName);

    //  Populate media interactions
    for (var channel of user.activeSession.media.channels) {
      channel.interactions = media.getInteractionsForAgent(userName, channel.name);
    }

		//  Build response
		res.set({ 'Content-type': 'application/json' });
		var data = {
			status: {
				code: 0
			},
			data: {
				configuration: configuration,
				user: conf.flattenKVListDataIfOptimizeConfig(req, user)
			}
		};
		res.send(JSON.stringify(data));
		publishInitialMediaMessage(session, user);
	} else {
		res.status(403).end();
	}
}

exports.getSessions = (req, res) => {
	return _.keys(sessions);
}

exports.publish = (req, channel, msg) => {
	var userName = _.isString(req) ? req : auth.userByCode(req);
	var session = sessions[userName];
	if (session) {
		publish2(session, channel, msg);
	}else{
    log.error("Publish failed, session not found for user", userName)
  }
  	publishToSecondaryTabs(userName, channel, msg);
}

exports.publishToUserNameSession = (userName, channel, msg) => {
	var session = sessions[userName];
	if (session) {
		publish2(session, channel, msg);
	}else{
    log.error("Publish failed, session not found for user", userName)
  }
  	publishToSecondaryTabs(userName, channel, msg);
}

publishToSecondaryTabs = (userName, channel, msg) => {
	if(secondaryTabsSessions[userName]) {
		secondaryTabsSessions[userName].forEach(session => {
			if (session) {
				publish2(session, channel, msg);
			}else{
				log.error("Publish failed, session not found for user", userName)
			  }
		})
	  }
}

publish2 = (session, channel, msg) => {
	if (session) {
		session.deliver(null, channel, msg);
	}
}

publishWorkspaceInitializationProgress = (session, percentComplete, user, configuration) => {
	var msg = {
		state: 'Executing',
		submittedAt: new Date(),
		executionTime: 1,
		actualWaitTime: 1,
		progress: {
			percentComplete: percentComplete
		},
		messageType: 'WorkspaceInitializationProgress'
	};
	if (user) {
		msg.data = {
			user: user,
			configuration: configuration
		};
	}
	publish2(session, '/workspace/v3/initialization', msg);
}

publishWorkspaceInitializationComplete = (session, user, configuration) => {
	var msg = {
		state: 'Complete',
		submittedAt: new Date(),
		executionTime: 1,
		actualWaitTime: 1,
		data : {
			user: user,
			configuration: configuration
		},
		messageType: 'WorkspaceInitializationComplete'
	};
	publish2(session, '/workspace/v3/initialization', msg);
}

publishInitialMediaMessage = (session, user) => {
  var dnData = voice.initializeDnData(user);
  var mediaData = media.initializeMediaData(user);
  setTimeout(() => {
    publish2(session, '/workspace/v3/voice', {
      dn: dnData,
      messageType: 'DnStateChanged'
    });
    setTimeout(() => {
      publish2(session, '/workspace/v3/media', {
        media: mediaData,
        messageType: 'ChannelStateChanged'
      });
      user.activeSession = {
        dn: dnData,
        media: mediaData
      };
    }, 250);
  }, 1500);
}

sessionAdded = (session, timeout) => {
	var req = cometdServer.context.request;
	var userName = auth.userByCode(req, req.cookies.WWE_CODE);
	if (userName) {
		if (sessions[userName]) {
			if (!secondaryTabsSessions[userName]) {					
				secondaryTabsSessions[userName] = [];
			}
			secondaryTabsSessions[userName].push(sessions[userName]);
		}
    sessions[userName] = session;
    var configuration = conf.conf(userName);
    var user = conf.userByName(userName);
    var userForInitializeMsg = conf.flattenKVListDataIfOptimizeConfig(req, user);
    publishWorkspaceInitializationProgress(session, 50);
    publishWorkspaceInitializationProgress(session, 100, userForInitializeMsg, configuration);
    publishWorkspaceInitializationComplete(session, userForInitializeMsg, configuration);
    setTimeout(() => {
      publishInitialMediaMessage(session, user);
      session.addListener('removed', sessionClosed);
    }, 500);
	} else {
		session.addListener('removed', sessionClosed);
		session.disconnect();
	}
}

exports.removeSession = (code) => {
	var userName = auth.userByCode(null, code);
	if (userName) {
		delete sessions[userName];
		var user = conf.userByName(userName);
		delete user.activeSession;
	}
}

sessionClosed = (session, req) => {
	var userName = auth.userByCode(req);
	if (userName) {
		delete sessions[userName];
		secondaryTabsSessions[userName] = [];
		reporting.unsubscribe(userName);
	}
}

