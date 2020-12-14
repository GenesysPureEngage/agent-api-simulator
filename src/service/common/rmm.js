/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const _ = require('underscore');
const notifications = require('./notifications');

var interactionsByAgent = {};
var interactionsById = {};
var campaignsByAgent = {};

exports.updateUserData = (id, userData) => {
	notifications.notifyUserDataUpdate(id, userData);
}

exports.recordInteraction = (agent, interaction) => {
	if(!interactionsByAgent[agent]) {
		interactionsByAgent[agent] = [];
	}
	interactionsByAgent[agent].push(interaction);
	interactionsById[interaction.id] = interaction;
	notifications.notifyInteractions(agent);
}

exports.addCampaigns = (agent, campaigns) => {
	if(!campaignsByAgent[agent]) {
		campaignsByAgent[agent] = [];
	}
	_.each(campaigns, campaign => {
		campaignToUpdate = campaignsByAgent[agent].find(c => c.GSW_CAMPAIGN_NAME === campaign.GSW_CAMPAIGN_NAME);
		if (campaignToUpdate) {
			campaignToUpdate.GSW_CAMPAIGN_DESCRIPTION = campaign.GSW_CAMPAIGN_DESCRIPTION;
			campaignToUpdate.GSW_CAMPAIGN_NAME = campaign.GSW_CAMPAIGN_NAME;
			campaignToUpdate.GSW_CAMPAIGN_MODE = campaign.GSW_CAMPAIGN_MODE;
		} else {
			campaign.status = 'Running';
			campaignsByAgent[agent].push(campaign);
		}
	});
}

exports.updateCampaignStatus = (agent, campaignName, status) => {
	campaignToUpdate = campaignsByAgent[agent].find(c => c.GSW_CAMPAIGN_NAME === campaignName);
	campaignToUpdate.status = status;
}

exports.getCampaignsForAgent = agent => {
	return campaignsByAgent[agent] ? campaignsByAgent[agent] : [];
}

exports.getCampaignForAgent = (agent, campaignName) => {
	return campaignsByAgent[agent].find(c => c.GSW_CAMPAIGN_NAME === campaignName);;
}

/*
exports.removeCampaign = (agent, campaignName) => {
	campaignsByAgent[agent] = _.filter(campaignsByAgent[agent], campaign => campaign.GSW_CAMPAIGN_NAME !== campaignName);
}

exports.updateCampaign = (agent, campaign) => {
	campaignToUpdate = campaignsByAgent[agent].find(c => c.GSW_CAMPAIGN_NAME === campaign.GSW_CAMPAIGN_NAME);
	campaignToUpdate = campaign;
}
*/

exports.recordInteractionComplete = (agent, id) => {
	//Remove all interactions for the agent with the specified id
	interactionsByAgent[agent] = _.filter(interactionsByAgent[agent], (ixn) => { return ixn.id !== id; });
	delete interactionsById[id];
	notifications.notifyInteractions(agent);
}

exports.getInteractionUserData = (id) => {
	if(interactionsById[id]) {
		return interactionsById[id].userData;
  }
  else{
    return (null);
  }
}

exports.getInteractionsSummary = (agent) => {
	var agentInteractions = [];
	if(interactionsByAgent[agent]) {
		agentInteractions = _.map(interactionsByAgent[agent], (ixn) => {
			if(ixn.callType) {
				return { id: ixn.id, channelType: "voice", type: ixn.callType, displayName: ixn.participants[0].number };
			} else {
				return { id: ixn.id, channelType: "media", type: ixn.mediatype, displayName: ixn.subject};
			}
		});
  }
  else {
    return (null);
  }

	return agentInteractions;
}
