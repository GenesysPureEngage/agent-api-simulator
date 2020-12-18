/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const _ = require('underscore');

const log = require('../common/log');
const auth = require('./auth');
const conf = require('./conf');
const messaging = require('./messaging');
const media = require('./media');
const utils = require('../common/utils');
const mediaManagement = require('./media-management');

let workbins = utils.requireAndMonitor('../../../data/open-media/workbins.yaml', updated => { workbins = updated });

var subscribersByWorkbins = {};


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

exports.getInteraction = (interactionId) => {
  var interaction = _.reduce(workbins, (result, workbin) => {
		return result || _.find(workbin.interactions, interaction => {
			return interaction.id === interactionId;
		});
  }, null);
  if (!interaction) {
    interaction = mediaManagement.getInteraction(interactionId);
  }
	return interaction;
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

exports.getReqOwnerId = (req) => {
  return req.body.data.ownerId ? req.body.data.ownerId : auth.userByCode(req);
}

exports.getWorkbinByIdAndOwnerId = (workbinId, ownerId) => {
  var wb = null;
  var foundWb = this.getWorkbinById(workbinId);
  if (foundWb) {
    wb = _.clone(foundWb);
    if (ownerId) {
      wb.interactions = _.filter(wb.interactions, iObj => {
        return iObj.agentId === ownerId;
      });
    }
  }
  return wb;
}

exports.addWorkbinSubscriber = (workbin, ownerId, subscriberId) => {
  if (!subscribersByWorkbins[workbin.workbinName]) {
    subscribersByWorkbins[workbin.workbinName] = {};
  }
  if (!subscribersByWorkbins[workbin.workbinName][ownerId]) {
    subscribersByWorkbins[workbin.workbinName][ownerId] = [];
  }
  subscribersByWorkbins[workbin.workbinName][ownerId].push(subscriberId);
}

exports.removeWorkbinSubscriber = (workbin, ownerId, subscriberId) => {
  if (subscribersByWorkbins[workbin.workbinName] && subscribersByWorkbins[workbin.workbinName][ownerId]) {
    subscribersByWorkbins[workbin.workbinName][ownerId] = _.without(subscribersByWorkbins[workbin.workbinName][ownerId], subscriberId);
  }
}

exports.pull = (req, res) => {
	this.removeFromWorkbinId(req, req.params.id, req.body.data.sourceId);
}

exports.placeInQueue = (req, res) => {
  var workbin, wbOwner;
	if (req.body.data.queue === '__BACK__') {
    const interaction = media.getInteraction(req.params.id);
    if (!interaction) {
      interaction = this.getInteraction(req.params.id);
    }
		if (interaction) {
      var wbName = (interaction.queue.indexOf('/PrivateQueue') === -1) ? interaction.queue : interaction.workbinTypeId;
      wbOwner = interaction.agentId ? interaction.agentId : auth.userByCode(req);
			workbin = this.getWorkbinByName(wbName);
		}
	} else {
		workbin = this.getWorkbinByName(req.body.data.queue);
    wbOwner = this.getReqOwnerId(req);
	}
	if (workbin) {
		this.addToWorkbinId(req, req.params.id, workbin.id, wbOwner);
	}
}

exports.updateInteractionWorkbinContainerProperties = (req, interaction, workbin, ownerId) => {
  interaction.queue = workbin.workbinName + '/PrivateQueue';
  interaction.workbinTypeId = workbin.workbinName;
  interaction.agentId = ownerId ? ownerId : this.getReqOwnerId(req);
  interaction.assignedTo = interaction.agentId;
  interaction.interactionState = 'Queued';
  interaction.workflowState = 'Queued';
  interaction.state = 'InWorkbin';
  mediaManagement.updateInteraction(interaction);
  return interaction;
}

exports.addToWorkbin = (req, interaction, workbin, ownerId) => {
  var userName = ownerId ? ownerId : this.getReqOwnerId(req);
  interaction = this.updateInteractionWorkbinContainerProperties(req, interaction, workbin, ownerId);
  workbin.interactions.push(this.adjustInteraction(interaction));
  this.publishEventWorkbinContentChangedToSubscribers('PlaceInWorkbin', 'Add', interaction, workbin, userName)
  media.publishInteractionEvent(req, interaction.mediatype, interaction);
}

exports.addToWorkbinId = (req, interactionId, workbinId, ownerId) => {
  var workbin = this.getWorkbinById(workbinId);
  if (workbin) {
    var interaction = media.getInteraction(interactionId);
    if (!interaction) {
      interaction = this.getInteraction(interactionId);
    }
    if (interaction) {
      this.addToWorkbin(req, interaction, workbin, ownerId);
    }
  }
}

exports.removeFromWorkbin = (req, interaction, workbin) => {
  workbin.interactions = _.without(workbin.interactions, interaction);
  this.publishEventWorkbinContentChangedToSubscribers('Pull', 'Remove', interaction, workbin, interaction.agentId)
}

exports.removeFromWorkbinId = (req, interactionId, workbinId) => {
  var workbin = workbinId ? this.getWorkbinById(workbinId) : this.getWorkbinByInteraction(interactionId);
  if (workbin) {
    var wbInteraction = this.getInteraction(interactionId);
    if (wbInteraction) {
      this.removeFromWorkbin(req, wbInteraction, workbin);
    }
  }
  mediaManagement.removeFromSnapshots(interactionId);
}

exports.moveToWorkbin = (req, interactionId, workbinId, ownerId) => {
  var wbTarget = this.getWorkbinById(workbinId);
  if (wbTarget) {
    var interaction = this.getInteraction(interactionId);
    if (interaction) {
      if (interaction.workbinTypeId) {
        // interaction is in a workbin
        var wbSource = this.getWorkbinByName(interaction.workbinTypeId);
        if (wbSource) {
          if (wbSource.workbinName !== wbTarget.workbinName) {
            // Workbin source != workbin target
            // => interaction should be removed from workbin source and then added to workbin target
            this.removeFromWorkbin(req, interaction, wbSource);
            this.addToWorkbin(req, interaction, wbTarget);
          } else {
            // Source and target workbin have same name not same owner
            // => only update OwnerId and publish WorkbinContentChanged events (removed + added)
            this.publishEventWorkbinContentChangedToSubscribers('Pull', 'Remove', interaction, wbSource, interaction.agentId)
            interaction = this.updateInteractionWorkbinContainerProperties(req, interaction, wbTarget, ownerId);
            this.publishEventWorkbinContentChangedToSubscribers('PlaceInWorkbin', 'Add', interaction, wbTarget, ownerId)
          }
        }
      } else {
        // interaction is in a queue (not a workbin)
        // => added it to workbin target
        this.addToWorkbin(req, interaction, wbTarget);
      }
    }
  }
}

exports.updateInteractionQueueContainerProperties = (interaction, queueName) => {
  interaction.queue = queueName;
  interaction.workbinTypeId = undefined;
  interaction.workflowState = 'Queued';
  interaction.interactionState = 'Cached';
  interaction.state = 'Queued';
  mediaManagement.updateInteraction(interaction);
  return interaction;
}

exports.moveToQueue = (req, interactionId, queue) => {
  var interaction = this.getInteraction(interactionId);
  if (interaction) {
    if (interaction.workbinTypeId) {
      // interaction is in a workbin
      var wbSource = this.getWorkbinByName(interaction.workbinTypeId);
      if (wbSource) {
        // => interaction should be removed from workbin source
        this.removeFromWorkbin(req, interaction, wbSource);
      }
    }
    // update interaction properties with queue target
    interaction = this.updateInteractionQueueContainerProperties(interaction, queue);
  }
}

exports.handleWorkbins = (req, res) => {
	res.set({ 'Content-type': 'application/json' });
	if (req.params.fn === 'get-workbins') {
    utils.sendOkStatus(req, res);
    var wbs = [];
    _.each(workbins, (workbin) => {
      wbs.push({
        workbinName: workbin.workbinName,
        id: workbin.id,
        displayName: workbin.displayName,
        type: workbin.type
      });
    });
    this.publishWorkbinEvent(req, 'EventWorkbins', { workbins: wbs });
	} else if (req.params.fn === 'get-contents') {
    var ownerId = this.getReqOwnerId(req);
		var wbs = {};
    var wbIds = req.body.data.workbinIds ? req.body.data.workbinIds.split(',') : [];
    _.each(wbIds, (wbId) => {
      var wb = this.getWorkbinByIdAndOwnerId(wbId, ownerId);
      if (wb) {
        wbs[wbId] = wb;
      }
		});
		utils.sendOkStatus(req, res);
		this.publishWorkbinEvent(req, 'EventWorkbinsContent', { workbins: wbs });
	} else {
		utils.sendFailureStatus(res, 501);
	}
}

exports.handleWorkbin = (req, res) => {
  res.set({ 'Content-type': 'application/json' });
	if (req.params.fn === 'subscribe' || req.params.fn === 'unsubscribe') {
    var ownerId = this.getReqOwnerId(req);
    var wb = this.getWorkbinByIdAndOwnerId(req.params.id, ownerId);
    if (wb) {
      utils.sendOkStatus(req, res);
      if (req.params.fn === 'subscribe') {
        this.addWorkbinSubscriber(wb, ownerId, auth.userByCode(req));
      } else {
        this.removeWorkbinSubscriber(wb, ownerId, auth.userByCode(req));
      }
      this.publishWorkbinEvent(req, 'EventAck', { operation: 'SubscribeWorkbinEvents', workbinId: req.params.id });
    } else {
      utils.sendFailureStatus(res, 500);
    }
	} else if (req.params.fn === 'get-content') {
    var ownerId = this.getReqOwnerId(req);
    var wb = this.getWorkbinByIdAndOwnerId(req.params.id, ownerId);
    if (wb) {
      utils.sendOkStatus(req, res);
      this.publishWorkbinEvent(req, 'EventWorkbinContent', { workbin: wb });
    } else {
      utils.sendFailureStatus(res, 500);
    }
	} else if (req.params.fn === 'add-interaction') {
		utils.sendOkStatus(req, res);
		this.addToWorkbinId(req, req.body.data.interactionId, req.params.id);
	} else {
		utils.sendFailureStatus(res, 501);
	}
}

exports.handleWorkbinInteraction = (req, res) => {
	res.set({ 'Content-type': 'application/json' });
	if (req.params.fn === 'get-details') {
    utils.sendOkStatus(req, res);
		this.publishWorkbinEvent(req, 'EventGetInteractionDetails', { interaction: this.getInteraction(req.params.id) });
	}
}

getWorkbinMessage = (eventName, opts, req) => {
	var msg = {
		name: eventName,
		messageType: 'WorkbinsMessage'
  }
  if (eventName != 'EventWorkbinContentChanged') {
		msg.operationId = req.body.operationId ? req.body.operationId : conf.id();
  }
	_.each(_.keys(opts), (opt) => {
		msg[opt] = opts[opt];
	});
  return msg;
}

exports.publishWorkbinEvent = (req, eventName, opts) => {
  messaging.publish(req, '/workspace/v3/workbins', getWorkbinMessage(eventName, opts, req));
}

exports.publishEventWorkbinContentChangedToSubscribers = (operationName, workbinContentOperationName, interaction, workbin, ownerId) => {
  if (subscribersByWorkbins[workbin.workbinName] && subscribersByWorkbins[workbin.workbinName][ownerId]) {
    _.each(subscribersByWorkbins[workbin.workbinName][ownerId], (userName) => {
      messaging.publishToUserNameSession(
        userName,
        '/workspace/v3/workbins',
        getWorkbinMessage('EventWorkbinContentChanged', {
          interaction: interaction,
          operation: operationName,
          workbin: { id: workbin.id, owner: ownerId },
          workbinContentOperation: workbinContentOperationName
        })
      );
    });
  }
}
