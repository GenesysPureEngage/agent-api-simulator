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

const cometdServer = cometd.createCometDServer();

var sessions = {}; // user name -> session

exports.start = () => {
	cometdServer.addListener('sessionAdded', sessionAdded);
}

exports.handle = (req, res) => {
	cometdServer.handle(req, res);
}

exports.getCurrentSession = (req, res) => {
	var userName = auth.userByCode(req);
	if (userName) {
		var session = sessions[userName];
		var configuration = conf.conf();
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
				user: user
			}
		};
		res.send(JSON.stringify(data));
		setTimeout(function() { publishInitialMediaMessage(session, user); }, 100);
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
	publish2(session, '/workspace/v3/voice', {
		dn: dnData,
		messageType: 'DnStateChanged'
	});
	var mediaData = media.initializeMediaData(user);
	publish2(session, '/workspace/v3/media', {
		media: mediaData,
		messageType: 'ChannelStateChanged'
	});
	user.activeSession = {
		dn: dnData,
		media: mediaData
	};
}

sessionAdded = (session, timeout) => {
	var req = cometdServer.context.request;
	var userName = auth.userByCode(req, req.cookies.WWE_CODE);
	if (userName) {
    sessions[userName] = session;
    var configuration = conf.conf();
    var user = conf.userByName(userName);
    publishWorkspaceInitializationProgress(session, 50);
    publishWorkspaceInitializationProgress(session, 100, user, configuration);
    publishWorkspaceInitializationComplete(session, user, configuration);
    // /!\ Now that CometD messages are replayed at login, should be removed soon
    setTimeout(() => {
      publishInitialMediaMessage(session, user);
    }, 1000);
    session.addListener('removed', sessionClosed);
	} else {
		session.addListener('removed', sessionClosed);
		session.disconnect();
	}

}

exports.removeSession = (code) => {
	var userName = auth.userByCode(null, code);
	if (userName) {
		delete sessions[userName];
	}
}

sessionClosed = (session, req) => {
	var userName = auth.userByCode(req);
	if (userName) {
		delete sessions[userName];
		reporting.unsubscribe(userName);
	}
}

