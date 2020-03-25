/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const _ = require('underscore');

const auth = require('./auth');
const conf = require('./conf');
const utils = require('../common/utils');

var stats = {};
var subscriptions = {};
var subscriptionsByUserName = {};
var subjects = {};

var statProfiles = utils.requireAndMonitor('../../../data/statistic-profiles.yaml', (updated) => { statProfiles = updated; });

createStatFromProfile = (objectId, statName, profile) => {
	var stat = setStat(objectId, statName);
	//initialize value
	stat.value = _.random(profile.min, profile.max);
	stat.timestamp = new Date().getTime();
	return stat;
}

getStat = (objectId, statName) => {
	if(stats[objectId] && stats[objectId][statName]) {
		return stats[objectId][statName];
	} else if(statProfiles.statistics[statName]) {
		var profile = statProfiles.statistics[statName].defaultProfile;
		//If we have a stat profile defined for the statName then create a new stat for the object from the profile
		return createStatFromProfile(objectId, statName, profile);
	} else {
		return null;
	}
}

exports.setSubject = (objectId, subjectName, value) => {
	if (!subjects[objectId]) {
		subjects[objectId] = {};
	}
	if (!subjects[objectId][subjectName]) {
		subjects[objectId][subjectName] = null;
	}
	if (subjectName === 'DN') {
		setStat(objectId, 'ReadyDuration', subjects[objectId][subjectName], value, setReadyDuration);
		subjects[objectId][subjectName] = value;
	} else if (subjectName === 'Calls') {
		setStat(objectId, 'InboundCalls', subjects[objectId][subjectName], value, setCalls('Inbound'));
		setStat(objectId, 'OutboundCalls', subjects[objectId][subjectName], value, setCalls('Outbound'));
		setStat(objectId, 'InternalCalls', subjects[objectId][subjectName], value, setCalls('Internal'));
		setStat(objectId, 'TalkDuration', subjects[objectId][subjectName], value, setTalkDuration);
		setStat(objectId, 'HoldDuration', subjects[objectId][subjectName], value, setHoldDuration);
		setStat(objectId, 'AverageHandlingTime', subjects[objectId][subjectName], value, setAverageHandlingTime);
		if (subjects[objectId][subjectName] === null) {
			subjects[objectId][subjectName] = { total: { count: 0, handlingTime: 0 } };	
		}
		if (value) {
			if (subjects[objectId][subjectName][value.id]) {
				/**
				 * Increment total # of calls if a call is in established state and it was previously:
				 * Dialing waiting to be established
				 * Ringing waiting to be established
				 * No status (inbound call established as soon as user answers)
				 */
				var prevState = subjects[objectId][subjectName][value.id].state;
				if (value.state === 'Established' && (!prevState || prevState === 'Ringing' || prevState === 'Dialing')) {
					subjects[objectId][subjectName].total.count++;
				}
				subjects[objectId][subjectName][value.id].state = value.state;
			} else {
				subjects[objectId][subjectName][value.id] = value;
			}
			if (value.state === 'Completed') {
				delete subjects[objectId][subjectName][value.id];
			}
		}
	}
}

setStat = (objectId, statName, subject, value, cb) => {
	var statsAtObj = stats[objectId];
	if (!statsAtObj) {
		statsAtObj = {};
		stats[objectId] = statsAtObj;
	}
	var stat = statsAtObj[statName];
	if (!stat) {
		stat = {
			objectId: objectId,
			name: statName,
			timestamp: new Date(),
			value: null
		};
		statsAtObj[statName] = stat;
	}
	if (cb) {
		cb(stat, subject, value);
	}
	return stat;
}

/** 
 * Gets a random updated value according to the parameters of its defined profile and type.
 * Growing values increase by some value up to the provided delta
 * Range values increase or decrease up to/down to the provided max/min by the provided delta
 * Max values increase only when a random value between min/max is greater than the current value
 */
getRandomUpdatedValue = (currentValue, delta, type, min, max) => {
	switch(type) {
		case "growing":
			//No upper limit on growing values
			return _.random(currentValue, currentValue + delta);
		case "max":
			//Select a new value if greater than the current value
			return Math.max(currentValue, _.random(min, max));
		case "range":
		default:
			//Select lower bound never lower than the min value
			var lowerBound = Math.max(min, currentValue - delta);
			//Select upper bound never higher than the max value
			var upperBound = Math.min(max, currentValue + delta);

			return _.random(lowerBound, upperBound);
	}
}

updateStateFromProfile = (stat, statName) => {
	var profile = statProfiles.statistics[statName].defaultProfile;

	//Check for reset interval/time profile
	if(profile.interval) {
		var now = new Date();
		var elapsed = Math.round((now.getTime() - stat.timestamp) / 1000);
		if(elapsed >= profile.interval) {
			stat.timestamp = new Date().getTime();
			stat.value = _.random(profile.min, profile.max);
		}
	}

	stat.value = getRandomUpdatedValue(stat.value, profile.delta, profile.type, profile.min, profile.max);
}

updateStat = (objectId, statName) => {
	var stat = stats[objectId][statName];
	var subject = subjects[objectId];
	if (statName === 'ReadyDuration') {
		updateReadyDuration(stat, subject['DN']);
	} else if (statName === 'TalkDuration') {
		updateTalkDuration(stat, subject['Calls']);
	} else if (statName === 'HoldDuration') {
		updateHoldDuration(stat, subject['Calls']);
	} else if (statName === 'AverageHandlingTime') {
		updateAverageHandlingTime(stat, subject['Calls']);
	} else if (statProfiles.statistics[statName]) {
		updateStateFromProfile(stat, statName);
	}
}

setInterval(() => {
	_.each(_.keys(stats), (objectId) => {
		_.each(_.keys(stats[objectId]), (statName) => {
			updateStat(objectId, statName);
		});
	});
}, 10000);

setReadyDuration = (stat, subject, value) => {
	if (subject === null) {
		stat.value = 0;
		stat.timestamp = new Date().getTime();
	} else {
		if (value.state === 'Ready') {
			if (value.state !== subject.state) {
				stat.timestamp = new Date().getTime();
			}
		} else {
			if (value.state !== subject.state) {
				updateReadyDuration(stat, subject);
			}
		}
	}
}

updateReadyDuration = (stat, subject) => {
	if (subject.state === 'Ready') {
		var now = new Date();
		stat.value += Math.round((now.getTime() - stat.timestamp) / 1000);
		stat.timestamp = now.getTime();
	}
}

setCalls = (callType) => {
	return (stat, subject, value) => {
		if (value) {
			if (value.callType === callType) {
				if (stat.value) {
					stat.value++;
				} else {
					stat.value = 1;
				}
			}
		} else {
			if(!stat.value){
				stat.value = 0;
			}
		}
	}
}

setTalkDuration = (stat, subject, value) => {
	if (subject === null) {
		stat.value = 0;
		stat.timestamp = new Date().getTime();
	} else if (value && subject[value.id]) {
		if (value.state === 'Established') {
			if (value.state !== subject[value.id].state) {
				var now = new Date();
				stat.timestamp = now.getTime();
				subject[value.id].talkTimestamp = stat.timestamp;
			}
		} else {
			if (value.state !== subject[value.id].state) {
				updateTalkDuration(stat, subject, value.id);
			}
		}
	}
}

updateTalkDuration = (stat, subject, id) => {
	if (id) {
		if (subject[id].state === 'Established') {
			var now = new Date();
			stat.value += Math.round((now.getTime() - subject[id].talkTimestamp) / 1000);
			stat.timestamp = now.getTime();
			subject[id].talkTimestamp = stat.timestamp;
		}
	} else {
		_.each(_.keys(subject), (callId) => {
			if (callId !== 'total') {
				updateTalkDuration(stat, subject, callId);
			}
		});
	}
}

setHoldDuration = (stat, subject, value) => {
	if (subject === null) {
		stat.value = 0;
		stat.timestamp = new Date().getTime();
	} else if (value && subject[value.id]) {
		if (value.state === 'Held') {
			if (value.state !== subject[value.id].state) {
				var now = new Date();
				stat.timestamp = now.getTime();
				subject[value.id].holdTimestamp = stat.timestamp;
			}
		} else {
			if (value.state !== subject[value.id].state) {
				updateHoldDuration(stat, subject, value.id);
			}
		}
	}
}

updateHoldDuration = (stat, subject, id) => {
	if (id) {
		if (subject[id].state === 'Held') {
			var now = new Date();
			stat.value += Math.round((now.getTime() - subject[id].holdTimestamp) / 1000);
			stat.timestamp = now.getTime();
			subject[id].holdTimestamp = stat.timestamp;
		}
	} else {
		_.each(_.keys(subject), (callId) => {
			if (callId !== 'total') {
				updateHoldDuration(stat, subject, callId);
			}
		});
	}
}

setAverageHandlingTime = (stat, subject, value) => {
	if (subject === null) {
		stat.value = 0;
		stat.timestamp = new Date().getTime();
	} else if (value && subject[value.id]) {
		if (value.state === 'Established' && subject[value.id].state === 'Ringing') {
			var now = new Date();
			stat.timestamp = now.getTime();
			subject[value.id].handlingTimestamp = stat.timestamp;
		} else if (value.state === 'Completed') {
			if (value.state !== subject[value.id].state) {
				updateAverageHandlingTime(stat, subject, value.id);
			}
		}
	}
}

updateAverageHandlingTime = (stat, subject, id) => {
	if (id) {
		if (subject[id].state !== 'Ringing') {
			var now = new Date();
			subject.total.handlingTime += subject[id].handlingTimestamp ? Math.round((now.getTime() - subject[id].handlingTimestamp) / 1000) : 0;
			stat.value = subject.total.count === 0 ? 0 : Math.round(subject.total.handlingTime / subject.total.count);
			stat.timestamp = now.getTime();
			subject[id].handlingTimestamp = stat.timestamp;
		}
	} else {
		_.each(_.keys(subject), (callId) => {
			if (callId !== 'total') {
				updateAverageHandlingTime(stat, subject, callId);
			}
		});
	}
}

exports.getStats = (req, res) => {
	res.set({ 'Content-type': 'application/json' });
	var data = {
		status: {
			code: 0
		},
	};
	var id = req.params.id;
	if (id) {
		if (subscriptions[id]) {
			_.each(subscriptions[id], (s) => {
				var stat = getStat(s.objectId, s.name);
				if (stat) {
					s.value.intValue = stat.value || 0;
					s.value.stringValue = '' + (stat.value || 0);
					s.value.timestamp = stat.timestamp;
				}
			});
			data.data = {
				subscriptionId: id,
				operationId: id,
				statistics: subscriptions[id]
			}
		}
	}
	res.send(JSON.stringify(data));
}

exports.subscribe = (req, res) => {
	res.set({ 'Content-type': 'application/json' });
	var data = {
		status: {
			code: 0
		},
	};
	if (req.body && req.body.data && req.body.data.statistics) {
		var subscriptionId = conf.id();
		subscriptions[subscriptionId] = _.map(req.body.data.statistics, (statDef) => {
			var stat = getStat(statDef.objectId, statDef.name);
			var subscription = {
				value: {
					intervalLength: 0,
					tag: -1,
					stringValue: stat ? '' + stat.value : '0',
					timestamp: stat ? stat.timestamp : null,
					intValue: stat ? stat.value : 0
				},
				timestamp: new Date().getTime(),
				objectId: statDef.objectId,
				objectType: statDef.objectType,
				name: statDef.name,
				statisticId: conf.id()
			};
			return subscription;
		});
		var userName = auth.userByCode(req);
		if (!subscriptionsByUserName[userName]) {
			subscriptionsByUserName[userName] = [];
		}
		subscriptionsByUserName[userName].push(subscriptionId);
		data.data = {
			subscriptionId: subscriptionId,
			operationId: subscriptionId,
			statistics: subscriptions[subscriptionId]
		};
	}
	res.send(JSON.stringify(data));
}

exports.unsubscribe = (userName) => {
	_.each(subscriptionsByUserName[userName], function(s) {
		delete subscriptions[s];
	});
	delete subscriptionsByUserName[userName];
}