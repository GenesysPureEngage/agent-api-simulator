/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const _ = require("underscore");
const fs = require("fs");
const auth = require("./auth");
const utils = require("../common/utils");

var actionCodes = utils.requireAndMonitor(
  "../../../data/action-codes.yaml",
  updated => {
    actionCodes = updated;
  }
);
var agentGroups = utils.requireAndMonitor(
  "../../../data/agent-groups.yaml",
  updated => {
    agentGroups = updated;
  }
);
var agents = utils.requireAndMonitor(
  "../../../data/agents.yaml",
  updated => {
    exports.handleUserUpdate(agents, updated);
  }
);
var places = utils.requireAndMonitor(
  "../../../data/places.yaml",
  updated => {
    exports.handleUserUpdate(places, updated);
  }
);
var businessAttributes = utils.requireAndMonitor(
  "../../../data/business-attributes.yaml",
  updated => {
    businessAttributes = updated;
  }
);
var environment = utils.requireAndMonitor(
  "../../../data/environment.yaml",
  updated => {
    environment = updated;
  }
);
var routePoints = utils.requireAndMonitor(
  "../../../data/route-points.yaml",
  updated => {
    routePoints = updated;
  }
);
var interactionQueues = utils.requireAndMonitor(
  "../../../data/interaction-queues.yaml",
  updated => {
    interactionQueues = updated;
  }
);
var transactions = utils.requireAndMonitor(
  "../../../data/transactions.yaml",
  updated => {
    transactions = updated;
  }
);
var settings = utils.requireAndMonitor(
  "../../../data/cluster-options.yaml",
  updated => {
    settings = updated;
  }
);
var personalFavorites = utils.requireAndMonitor(
  "../../../data/personal-favorites.yaml",
  updated => {
    personalFavorites = updated;
  }
);

var optimizeConfigByUser = {};

exports.flattenKVListDataIfOptimizeConfig = (req, data) => {
  if (!isOptimizeConfig(req)) {
    return data;
  }
  return flattenUserPropertiesKVListData(data);
}

flattenUserPropertiesKVListData = (data) => {
  return Array.isArray(data) ? flattenUserPropertiesKVListArray(data) : flattenUserPropertiesKVListObject(data);
}

flattenUserPropertiesKVListArray = (array) => {
  var flatArray = [];
  _.each(array, (itemArray) => {
    flatArray.push(flattenUserPropertiesKVListData(itemArray));
  });
  return flatArray;
}

flattenUserPropertiesKVListObject = (object) => {
  var flatObject = {};
  for (let key in object) {
    if (key === 'userProperties') {
      flatObject[key] = utils.flattenKVListData(object[key]);
    } else if (Array.isArray(object[key])) {
      flatObject[key] = flattenUserPropertiesKVListArray(object[key]);
    } else {
      flatObject[key] = object[key];
    }
  };
  return flatObject;
}

exports.handleUserUpdate = (currUsers, updatedUsers) => {
  Object.keys(updatedUsers).forEach(user => {
    if (currUsers[user]) {
      //Merge changed properties with current user state. User may have activeSession info
      _.extend(currUsers[user], updatedUsers[user]);
    } else {
      //If there are new users then add them
      currUsers[user] = updatedUsers[user];
    }
  });
};

exports.s4 = () => {
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
};
exports.id = () => {
  return (
    exports.s4() +
    exports.s4() +
    exports.s4() +
    exports.s4()
  ).toLowerCase();
};

isOptimizeConfig = (req) => {
  return (optimizeConfigByUser[auth.userByCode(req)] === true);
};

exports.initialize = (req, res) => {
  optimizeConfigByUser[auth.userByCode(req)] = (req.url.indexOf("optimize_config=true") !== -1) ? true : false;

  res.cookie("WWE_CODE", req.query.code, {
    httpOnly: true,
    secure: req.protocol === 'https',
    sameSite: (req.protocol === 'https') ? 'none' : 'lax'
  });
  res.set({ "Content-type": "application/json" });
  var data = {
    status: {
      code: 1
    }
  };
  res.send(JSON.stringify(data));
};

exports.configurationSettings = (req, res) => {
  res.set({ "Content-type": "application/json" });
  res.send(JSON.stringify({
    status: {
      code: 0
    },
    data: isOptimizeConfig(req) ? utils.flattenKVListData(settings) : settings
  }));
};

exports.configurationActionCodes = (req, res) => {
  res.set({ "Content-type": "application/json" });
  res.send(JSON.stringify({
    status: {
      code: 0
    },
    data: this.flattenKVListDataIfOptimizeConfig(req, actionCodes)
  }));
};

exports.configurationBusinessAttributes = (req, res) => {
  res.set({ "Content-type": "application/json" });
  res.send(JSON.stringify( {
    status: {
      code: 0
    },
    data: this.flattenKVListDataIfOptimizeConfig(req, businessAttributes)
  }));
};

exports.configurationBusinessAttribute = (req, res) => {
  res.set({ "Content-type": "application/json" });
  var ba = _.find(businessAttributes, (a) => {
		return req.params.id === a.id;
  });
  if (ba) {
    res.send(JSON.stringify( {
      status: {
        code: 0
      },
      data: this.flattenKVListDataIfOptimizeConfig(req, ba)
    }));
  } else {
    utils.sendFailureStatus(res, 500);
  }
};

exports.configurationTransactions = (req, res) => {
  res.set({ "Content-type": "application/json" });
  res.send(JSON.stringify( {
    status: {
      code: 0
    },
    data: this.flattenKVListDataIfOptimizeConfig(req, transactions)
  }));
};

exports.configurationPlacesDnsWithId = (req, res) => {
  res.set({ "Content-type": "application/json" });
  var place = _.find(places, (p) => {
		return req.params.placename === p.name;
  });
  if (place) {
    res.send(JSON.stringify( {
      status: {
        code: 0
      },
      data: { devices: this.flattenKVListDataIfOptimizeConfig(req, place.devices) }
    }));
  } else {
    utils.sendFailureStatus(res, 500);
  }
};

exports.configuration = (req, res) => {
  res.set({ "Content-type": "application/json" });
  var configOptimize = isOptimizeConfig(req);

  var data = {};
  var types = req.query.types ? req.query.types.split(",") : [];
  if ( (types.length > 0) || (req.url === "/") ) {
    _.each(types, type => {
      if (type === "agentGroups") {
        data.agentGroups = agentGroups;
      } else if (type === "monitorableAgentGroups") {
        const user = exports.userByCode(req);
        data.monitorableAgentGroups =  _.filter(agentGroups, (agentGroup) => {
          return agentGroup.managerDBIDs && user ? agentGroup.managerDBIDs.indexOf(user.DBID) !== -1 : false;
        });
      } else if (!configOptimize) {
        if (type === "actionCodes") {
          data.actionCodes = actionCodes;
        } else if (type === "settings") {
          data.settings = settings;
        } else if (type === "workspaceTransactions") {
          data.workspaceTransactions = transactions;
        } else if (type === "businessAttributes") {
          data.businessAttributes = businessAttributes;
        }
      }
    });
  }

  data = {
    status: {
      code: 0
    },
    data: data
  };

  res.send(JSON.stringify(data));
};


exports.conf = (userName) => {
  if (optimizeConfigByUser[userName] === true) {
    var agtGrpsWithoutAgtDbids = [];
    _.each(agentGroups, (agtGrp) => {
      var agtGrpWithoutAgtDbids = {};
      for (let key in agtGrp) {
        if (key !== 'agentDBIDs') {
          agtGrpWithoutAgtDbids[key] = agtGrp[key];
        }
      };
      agtGrpsWithoutAgtDbids.push(agtGrpWithoutAgtDbids);
    });

    return {
      agentGroups: agtGrpsWithoutAgtDbids,
      environment: environment,
    };
  } else {
    return {
      actionCodes: actionCodes,
      agentGroups: agentGroups,
      businessAttributes: businessAttributes,
      environment: environment,
      settings: settings,
      transactions: transactions
    };
  }
};

exports.userByCode = (req) => {
  return agents[auth.userByCode(req)];
};

exports.userByName = (name) => {
  const agent = agents[name];
  agent.dbid = agent.DBID;
  return agent;
};

exports.userByDestination = dest => {
  return _.find(_.values(agents), user => {
    return user.agentLogin === dest;
  });
};

const agentStatuses = {};

exports.targets = function(req, res) {
  res.set({ "Content-type": "application/json" });
  var data = {
    status: {
      code: 0
    },
    data: {
      totalMatches: 0
    }
  };
  var targets = [];
  var types = req.query.types ? req.query.types.split(",") : [];
  var searchTerm = req.query.searchTerm ? req.query.searchTerm.split(",") : [];
  var searchAll = (searchTerm.length === 1 && searchTerm[0] === '*') ? true : false;
  var matchType = req.query.matchType;
  var restrictToGroup = req.query.restrictToGroup ? req.query.restrictToGroup.split(",") : [];
  var filterName = req.query.filterName;
  _.each(types, type => {
    if (type === "agent") {
      _.each(agents, user => {
        var u = _.clone(user);
        u.dbid = user.DBID;
        u.name = `${user.firstName} ${user.lastName}`;
        u.type = "agent";
        u.agentGroupsIds = [];
        u.agentGroupsList = [];
        delete u.activeSession;
        copyActiveSessionToAvailability(user, u);
        setMonitoringState(req, u);
        for (const ag of agentGroups) {
          if (ag.agentDBIDs.indexOf(u.DBID) !== -1) {
            u.agentGroupsIds.push(ag.DBID.toString());
            u.agentGroupsList.push(ag.name);
          }
        }
        targets.push(u);
      });

      if (restrictToGroup.length > 0) {
        var agentsOfGroups = [];
        _.each(restrictToGroup, (grp) => {
          _.each(agentGroups, (agtGp) => {
            if (agtGp.name === grp) {
              agentsOfGroups = _.union(agentsOfGroups, agtGp.agentDBIDs);
            }
          });
        });

        targets = _.filter(targets, target => {
          return agentsOfGroups.includes(target.DBID);
        })
      }

    } else if (type === "agent-group") {
      var tAgentGroups = _.map(agentGroups, (agentGroup) => {
        agentGroup.timestamp = Date.now();
        agentGroup.type = 'agent-group';
        agentGroup.availability = { readyAgents: 0 };
        agentGroup.isMonitored = true;
        return agentGroup;
      });
      targets = targets.concat(tAgentGroups);
    } else if (type === "route-point") {
      var tRoutePoints = _.map(routePoints, (routePoint) => {
        routePoint.timestamp = Date.now();
        routePoint.type = 'route-point';
        routePoint.availability = { waitingCalls: 0 };
        routePoint.isMonitored = false;
        return routePoint;
      });
      targets = targets.concat(tRoutePoints);
    } else if (type === "interaction-queue") {
      var tInteractionQueues = _.map(interactionQueues, (interactionQueue) => {
        interactionQueue.timestamp = Date.now();
        interactionQueue.type = 'interaction-queue';
        interactionQueue.availability = { waitingCalls: 0 };
        interactionQueue.isMonitored = false;
        return interactionQueue;
      });
      targets = targets.concat(tInteractionQueues);
    }
  });
  if (searchAll === false) {
    targets = _.filter(targets, target => {
      return (
        _.size(
          _.filter(searchTerm, term => {
            return matchType === "exact"
              ? term === target.name
              : target.name.toLowerCase().indexOf(term.toLowerCase()) !== -1 ||
                  (target.userName && target.userName.toLowerCase().indexOf(term.toLowerCase()) !== -1);
          })
        ) > 0
      );
    });
  }
  if (targets) {
    data.data = {
      targets: targets,
      totalMatches: targets.length
    };
  }
  res.send(JSON.stringify(data));
};

doesAgentBelongToGroup = (agent, groupId) => {
  return _.reduce(agentGroups, (result, group) => {
    return result || (("" + group.DBID) === ("" + groupId) && group.agentDBIDs.indexOf(agent.DBID) !== -1);
  }, false);
}

exports.users = (req, res) => {
  res.set({ "Content-type": "application/json" });
  var tAgents = _.filter(agents, agent => {
    var result = doesAgentBelongToGroup(agent, req.query.groupId);
    if (result && req.query.searchTerm) {
      result = agent.userName.indexOf(req.query.searchTerm) !== -1;
    }
    return result;
  });
  var totalMatches = tAgents.length;
  //Handle pagination
  var offset = Number(req.query.offset);
  var limit = Number(req.query.limit);
  tAgents = tAgents.slice(offset, offset - 1 + limit);

  tAgents = _.map(tAgents, agent => {
    var a = _.clone(agent);
    a.statistics = [];
    copyActiveSessionToAvailability(agent, a);
    return a;
  });
  if (req.query.states) {
    tAgents = _.filter(tAgents, agent => {
      var filteredStates = req.query.states.split(',');
      if (agent.availability) {
        return _.reduce(agent.availability.channels, (result, channel) => {
          return result || filteredStates.indexOf(channel.userState.state) !== -1;
        }, false);
      } else {
        return filteredStates.indexOf('LoggedOff') !== -1;
      }
    });
  }
  var data = {
    status: {
      code: 0
    },
    data: {
      users: tAgents,
      totalMatches: totalMatches
    }
  };
  res.send(JSON.stringify(data));
};

copyActiveSessionToAvailability = (agent, a) => {
  if (agent.activeSession) {
    a.availability = { channels: [] };
    if (agent.activeSession.dn) {
      var rec = {
        name: 'voice',
        activity: agent.activeSession.dn.activity ? agent.activeSession.dn.activity : 'Idle',
        available: _.isUndefined(agent.activeSession.dn.available) ? true : agent.activeSession.dn.available,
        userState: {
          state: agent.activeSession.dn.agentState,
        },
        timeInCurrentState: (Date.now() - agent.activeSession.dn.timestamp) / 1000,
        switchName: agent.activeSession.dn.switchName,
        phoneNumber: agent.activeSession.dn.number
      }
      if (agent.activeSession.dn.agentWorkMode) {
        rec.userState.workMode = agent.activeSession.dn.agentWorkMode;
      }
      if (agent.activeSession.dn.reasons && _.size(agent.activeSession.dn.reasons) > 0) {
        rec.userState.reason = agent.activeSession.dn.reasons[0].value;
      }
      if (rec.userState.state !== 'LoggedOut') {
        a.availability.channels.push(rec);
      }
      // agentWorkMode
    }
    if (agent.activeSession.media) {
      _.each(agent.activeSession.media.channels, (channel) => {
        var rec = {
          name: channel.name,
          activity: channel.activity ? channel.activity : 'Idle',
          available: _.isUndefined(channel.available) ? true : channel.available,
          userState: {
            state: channel.state
          },
          timeInCurrentState: (Date.now() - channel.timestamp) / 1000
        };
        if (channel.reasons && _.size(channel.reasons) > 0) {
          rec.userState.reason = channel.reasons[0].value;
        }
        if (rec.userState.state !== 'LoggedOut') {
          a.availability.channels.push(rec);
        }
        // dnd reasons
      });
    }
    if (!a.availability.channels.length) {
      delete a.availability;
    }
  }
};

setMonitoringState = (req, a) => {
  if (a.isMonitored) {
    return;
  }
  const user = exports.userByCode(req);
  const userDn = ((user || {}).activeSession || {}).dn || {};
  if (userDn.agentState !== 'Ready' || _.indexOf(userDn.capabilities, 'start-monitoring') === -1) {
    return;
  }
  const monitoredAG = _.find(agentGroups, ag => {
    return _.indexOf(ag.managerDBIDs, user.DBID) !== -1;
  });
  if (monitoredAG && _.indexOf(monitoredAG.agentDBIDs, a.DBID) !== -1) {
    const channels = a.availability ? a.availability.channels : [];
    a.isMonitorable = false;
    if (user.employeeId !== a.employeeId) {
      a.isMonitorable = _.some(channels, ch => { return ch.name === 'voice' && userDn.switchName === ch.switchName; });
    }
  }
};

getAgentTimeInCurrentState = (agent, channelName) => {
  if (!agentStatuses[agent]) {
    agentStatuses[agent] = {};
  }
  if (!agentStatuses[agent][channelName]) {
    agentStatuses[agent][channelName] = {
      timeInCurrentState: new Date().getTime() - _.random(20000)
    };
  }
  return Math.round(
    (new Date().getTime() -
      agentStatuses[agent][channelName].timeInCurrentState) /
      1000
  );
};

const dynConfDir = "./data/out/";
const dynConfFileExt = ".tmp.txt";

exports.readDynConf = name => {
  var fullpath = dynConfDir + name + dynConfFileExt;
  return fs.existsSync(fullpath) ? fs.readFileSync(fullpath, "utf8") : null;
};

exports.readDynConfDir = name => {
  var fullpath = dynConfDir + name;
  return fs.existsSync(fullpath)
    ? _.map(fs.readdirSync(fullpath, "utf8"), fname => {
        return fname.substring(0, fname.length - dynConfFileExt.length);
      })
    : null;
};

exports.fstatDynConfDir = (name, fname) => {
  var fullpath = dynConfDir + name + "/" + fname + dynConfFileExt;
  return fs.existsSync(fullpath) ? fs.statSync(fullpath) : null;
};

const media = require("./media");
const voice = require("./voice");

/**
 * Handle updating user status
 * Paths are either:
 * /users/{DBID}/media/{channel}/{state}
 * /users/{DBID}/voice/{state}
 */
exports.userUpdate = (req, res) => {
  //Map request states to state values used internally
  var states = { "not-ready": "NotReady", ready: "Ready", logout: "LoggedOut" };
  var userDBID = Number(req.params.fn1);
  var isMedia = req.params.fn2 === "media";
  var channel = isMedia ? (req.params.fn4 ? req.params.fn3 : null) : "voice";
  var stateParam = isMedia && req.params.fn4 ? req.params.fn4 : req.params.fn3;
  var state = states[stateParam];

  var updated = false;
  const agent = _.find(agents, a => {
    return ("" + a.DBID) === ("" + userDBID)
  });
  if (agent) {
    if (channel === 'voice') {
      if (voice.changeState(agent.userName, state)) {
        updated = true;
      }
    } else {
      if (media.changeState(agent.userName, state, { media: channel })) {
        updated = true;
      }
    }
  }

  res.send(JSON.stringify({
    status: {
      code: updated ? 1 : 0
    }
  }));
};

exports.handlePersonalFavorites = (req, res) => {
  res.set({ "Content-type": "application/json" });
  if (req.params.fn) {
    if (req.params.id) {
      const idx = _.findIndex(personalFavorites, fav => { return fav.id === req.params.id; });
      if (idx !== -1) {
        personalFavorites.splice(idx, 1);
      }
    } else {
      var f = _.find(personalFavorites, fav => { return fav.id === req.body.data.target.id; });
      if (!f) {
        f = {
          type: 'custom-contact',
          id: req.body.data.target.id
        };
        personalFavorites.push(f);
      }
      f.firstName = req.body.data.target.firstName;
      f.lastName = req.body.data.target.lastName;
      f.phoneNumbers = req.body.data.target.phoneNumbers;
      f.emailAddresses = req.body.data.target.emailAddresses;
      f.favoriteDisplayName = req.body.data.target.favoriteDisplayName;
      f.category = req.body.data.category;
    }
    utils.sendOkStatus(req, res);
  } else {
    var data = {
      status: {
        code: 0
      },
      data: {
        totalMatches: 0
      }
    };
    const targets = personalFavorites;
    if (targets) {
      data.data = {
        targets: targets,
        totalMatches: targets.length
      };
    }
    res.send(JSON.stringify(data));
  }
};

exports.submitFeedback = (req, res) => {
  res.set({ "Content-type": "application/json" });
  // input: req.body.text req.body.topic req.body.metadata
  utils.sendOkStatus(req, res);
};