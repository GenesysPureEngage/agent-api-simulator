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
const workbins = require('./workbins');

let snapshots = utils.requireAndMonitor('../../../data/open-media/media-management.yaml', updated => { snapshots = updated });

exports.getSnapshotByCondition = (condition) => {
  return _.find(snapshots, (snapshot) => {
		return condition === snapshot.condition;
	});
}

exports.getSnapshotById = (id) => {
  return _.find(snapshots, (snapshot) => {
		return id === snapshot.snapshotId;
	});
}

exports.getInteraction = (interactionId) => {
	return _.reduce(snapshots, (result, snapshot) => {
		return result || _.find(snapshot.interactions, interaction => {
			return interaction.id === interactionId;
		});
	}, null);
}

exports.updateInteraction = (interactionToUpdate) => {
  _.each(snapshots, (snapshot) => {
    var interactionFound =_.find(snapshot.interactions, interaction => {
			return interaction.id === interactionToUpdate.id;
		})
    if (interactionFound) {
      snapshot.interactions = _.without(snapshot.interactions, interactionFound);
      snapshot.interactions.push(interactionToUpdate);
    }
  });
}

exports.removeFromSnapshots = (interactionId) => {
  _.each(snapshots, (snapshot) => {
    var interaction =_.find(snapshot.interactions, interaction => {
			return interaction.id === interactionId;
		})
    if (interaction) {
      snapshot.interactions = _.without(snapshot.interactions, interaction);
    }
  });
}

exports.updateInteractionUserData = (interaction, updatedUserData) => {
  _.each(updatedUserData, (data) => {
    var el = _.find(interaction.userData, (kvp) => { return kvp.key === data.key; });
    if (el) {
      el.value = data.value;
    } else {
      interaction.userData.push(data);
    }
  });
}

exports.handleMediaManagementFunction = (req, res) => {
  res.set({ 'Content-type': 'application/json' });
	if (req.params.fn === 'get-snapshot') {
    var snapshot = this.getSnapshotByCondition(req.body.data.condition);
		if (snapshot) {
      utils.sendOkStatus(req, res);
      this.publishMediaManagementEvent(req, 'SnapshotContent', snapshot);
    } else {
      utils.sendFailureStatus(res, 500);
    }
  } else 	if (req.params.fn === 'manage-user-data') {
    utils.sendOkStatus(req, res);
    _.each(req.body.data.interactions, (id) => {
      var snapshotInteraction = this.getInteraction(id);
      if (snapshotInteraction) {
        this.updateInteractionUserData(snapshotInteraction, req.body.data.updatedUserData);
      }
      var wbInteraction = workbins.getInteraction(id);
      if (wbInteraction) {
        this.updateInteractionUserData(wbInteraction, req.body.data.updatedUserData);
      }
		});
    this.publishMediaManagementEvent(req, 'ManageUserData');
  } else if (req.params.fn === 'cancel' || req.params.fn === 'complete') {
    utils.sendOkStatus(req, res);
    _.each(req.body.data.interactions, (id) => {
      workbins.removeFromWorkbinId(req, id);
		});
    this.publishMediaManagementEvent(req, req.params.fn);
  } else if (req.params.fn === 'move-to-workbin') {
    utils.sendOkStatus(req, res);
    _.each(req.body.data.interactions, (id) => {
      workbins.moveToWorkbin(req, id, req.body.data.workbinId, req.body.data.ownerId);
		});
    this.publishMediaManagementEvent(req, 'MoveToWorkbin');
  } else if (req.params.fn === 'move-to-queue') {
    utils.sendOkStatus(req, res);
    _.each(req.body.data.interactions, (id) => {
      workbins.moveToQueue(req, id, req.body.data.queue);
		});
    this.publishMediaManagementEvent(req, 'MoveToQueue');
  } else {
    utils.sendFailureStatus(res, 501);
	}
}

exports.handleMediaManagementFunctionWithId = (req, res) => {
	res.set({ 'Content-type': 'application/json' });
  if (req.params.fn === 'get-snapshot-content') {
    var snapshot = this.getSnapshotById(req.params.id);
		if (snapshot) {
      utils.sendOkStatus(req, res);
      this.publishMediaManagementEvent(req, 'SnapshotContent', snapshot);
    } else {
      utils.sendFailureStatus(res, 500);
    }
	} else if (req.params.fn === 'release-snapshot') {
    utils.sendOkStatus(req, res);
    this.publishMediaManagementEvent(req, 'SnapshotReleased', { snapshotId: req.params.id });
  } else {
		utils.sendFailureStatus(res, 501);
	}
}

exports.publishMediaManagementEvent = (req, eventName, opts) => {
	var operationId = req.body.operationId ? req.body.operationId : conf.id();
	var msg = {
		notificationType: eventName,
		operationId: operationId,
		messageType: 'SnapshotMessage'
	}
	_.each(_.keys(opts), (opt) => {
		msg[opt] = opts[opt];
	});
	messaging.publish(req, '/workspace/v3/media-management', msg);
}