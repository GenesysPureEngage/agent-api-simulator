/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

/**
 * Handles sending notifications to the simulator.
 * Uses CometD implementation.
 * 
 * If new users log in, create or complete interactions, or update interaction user data, the simulator client UI is
 * notified so that these changes are reflected to the user(s) immediately. The client UI can subscribe to changes
 * in the users actively logged in, interactions for specific users, and interaction user data for specific
 * interactions.
 */
const cometd = require('cometd-nodejs-server');
const _ = require('underscore');

const rmm = require('./rmm');

const cometdServer = cometd.createCometDServer();

exports.start = () => {
	simulatorChannel = cometdServer.createServerChannel('/sessions');
	//Report sessions empty on startup
	exports.notifySessions([]);
}

exports.handle = (req, res) => {
  cometdServer.handle(req, res);
}

exports.notifySessions = (sessions) => {
	if(cometdServer.getServerChannel('/sessions')) {
		cometdServer.getServerChannel('/sessions').publish(null, Object.values(sessions));
	}
}

exports.notifyInteractions = (agent) => {
	if(agent !== null && cometdServer.getServerChannel(`/interactions/${agent}`)) {
		var interactions = rmm.getInteractionsSummary(agent);
		cometdServer.getServerChannel(`/interactions/${agent}`).publish(null, interactions);
	}
}

exports.notifyUserDataUpdate = (id, userData) => {
	if(cometdServer.getServerChannel(`/user-data/${id}`)) {
		cometdServer.getServerChannel(`/user-data/${id}`).publish(null, userData);
	}
}

