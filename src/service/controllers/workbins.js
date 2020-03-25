/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const _ = require('underscore');

const auth = require('./auth');
const conf = require('./conf');
const messaging = require('./messaging');
const media = require('./media');
const utils = require('../common/utils');

let workbins = utils.requireAndMonitor('../../../data/ucs/workbins.yaml', updated => { workbins = updated });

exports.getWorkbinById = (workbinId) => {
	return _.find(workbins, (workbin) => {
		return workbinId === workbin.id;
	});
}

exports.getWorkbinByName = (workbinName) => {
	return _.find(workbins, (workbin) => {
		return workbinName === workbin.workbinName;
	});
}

exports.addToWorkbin = (req, workbinId, interactionId) => {
	const workbin = exports.getWorkbinById(workbinId);
	const interaction = media.getInteraction(interactionId);
	if (workbin && interaction) {
		const userName = auth.userByCode(req);
		workbin.interactions.push(exports.adjustInteraction(interaction));
		interaction.queue = workbin.workbinName;
		this.publishWorkbinEvent(req, 'EventWorkbinContentChanged', {
			workbin: { id: workbin.id, owner: userName },
			interaction: interaction,
			operation: 'PlaceInWorkbin',
			workbinContentOperation: 'Add'
		});
		interaction.state = 'InWorkbin';
		media.publishInteractionEvent(req, interaction.mediatype, interaction);
	}
}

exports.removeFromWorkbin = (req, workbinId, interactionId) => {
	const workbin = workbinId ? exports.getWorkbinById(workbinId) : exports.getWorkbinByInteraction(interactionId);
	const interaction = media.getInteraction(interactionId);
	if (workbin && interaction) {
		const userName = auth.userByCode(req);
		const idx = workbin.interactions.indexOf(interaction);
		if (idx !== -1) {
			workbin.interactions.splice(idx, 1);
		}
		this.publishWorkbinEvent(req, 'EventWorkbinContentChanged', {
			workbin: { id: workbin.id, owner: userName },
			interaction: interaction,
			operation: 'Pull',
			workbinContentOperation: 'Remove'
		});
		interaction.state = interaction.interactionType === 'Inbound' ? 'Processing' : 'Composing';
		media.publishInteractionEvent(req, interaction.mediatype, interaction);
	}
}

exports.getInteraction = (interactionId) => {
	return _.reduce(workbins, (result, workbin) => {
		return result || _.find(workbin.interactions, interaction => {
			return interaction.id === interactionId;
		});
	}, null);
}

exports.getWorkbinByInteraction = (interactionId) => {
	return _.reduce(workbins, (result, workbin) => {
		return result || _.reduce(workbin.interactions, (resulti, interaction) => {
			return interaction.id === interactionId ? workbin : resulti;
		}, null);
	}, null);
}

exports.adjustInteraction = (interaction) => {
	if (interaction) {
		if (!interaction.mediaType) {
			interaction.mediaType = interaction.mediatype;
		}
	}
	return interaction;
}

exports.pull = (req, res) => {
	exports.removeFromWorkbin(req, req.body.data.sourceId, req.params.id);
}

exports.placeInQueue = (req, res) => {
	var workbin; 
	if (req.body.data.queue === '__BACK__') {
		const interaction = media.getInteraction(req.params.id);
		if (interaction) {
			workbin = exports.getWorkbinByName(interaction.queue);
		}
	} else {
		workbin = exports.getWorkbinByName(req.body.data.queue);
	}
	if (workbin) {
		exports.addToWorkbin(req, workbin.id, req.params.id);
	}
}

exports.handleWorkbins = (req, res) => {
	res.set({ 'Content-type': 'application/json' });
	if (req.params.fn === 'get-workbins') {
		utils.sendOkStatus(req, res);
		this.publishWorkbinEvent(req, 'EventWorkbins', { workbins: workbins });
	} else if (req.params.fn === 'get-contents') {
		var workbins2 = {};
		if (req.body.workbinIds) {
			_.each(workbins, (workbin) => {
				if (req.body.workbinIds.indexOf(workbin.id) !== -1) {
					workbins2[workbin.id] = workbin;
				}
			});
		}
		utils.sendOkStatus(req, res);
		this.publishWorkbinEvent(req, 'EventWorkbinsContent', { workbins: workbins2 });
	} else {
		utils.sendFailureStatus(res, 501);
	}
}

exports.handleWorkbin = (req, res) => {
	res.set({ 'Content-type': 'application/json' });
	if (req.params.fn === 'subscribe' || req.params.fn === 'unsubscribe') {
		utils.sendOkStatus(req, res);
		this.publishWorkbinEvent(req, 'EventAck', { operation: 'SubscribeWorkbinEvents', workbinId: req.params.id });
	} else if (req.params.fn === 'get-content') {
		_.each(workbins, (workbin) => {
			if (req.params.id === workbin.id) {
				utils.sendOkStatus(req, res);
				this.publishWorkbinEvent(req, 'EventWorkbinContent', { workbin: workbin });
			}
		});
	} else if (req.params.fn === 'add-interaction') {
		utils.sendOkStatus(req, res);
		exports.addToWorkbin(req, req.params.id, req.body.data.interactionId);
	} else {
		utils.sendFailureStatus(res, 501);
	}
}

exports.handleWorkbinInteraction = (req, res) => {
	res.set({ 'Content-type': 'application/json' });
	if (req.params.fn === 'get-details') {
		utils.sendOkStatus(req, res);
		this.publishWorkbinEvent(req, 'EventGetInteractionDetails', { interaction: exports.getInteraction(req.params.id) });
	}
}

exports.publishWorkbinEvent = (req, eventName, opts) => {
	var operationId = req.body.operationId ? req.body.operationId : conf.id();
	var msg = {
		name: eventName,
		operationId: operationId,
		messageType: 'WorkbinsMessage'
	}
	_.each(_.keys(opts), (opt) => {
		msg[opt] = opts[opt];
	});
	messaging.publish(req, '/workspace/v3/workbins', msg);
}