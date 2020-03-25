/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

const _ = require("underscore");
const auth = require("./auth");
const conf = require("./conf");
const log = require("../common/log");
const messaging = require("./messaging");
const rmm = require("../common/rmm");
const reporting = require("./reporting");
const utils = require("../common/utils");

var attachedData = utils.requireAndMonitor(
  "../../../data/media/attached-data.yaml",
  updated => {
    attachedData = updated;
  }
);

var extensions = utils.requireAndMonitor(
  "../../../data/voice/extensions.yaml",
  updated => {
    extensions = updated;
  }
);
var capabilitiesDefinitions = utils.requireAndMonitor(
  "../../../data/voice/capabilities.yaml",
  updated => {
    capabilitiesDefinitions = updated;
  }
);

var calls = {};

exports.initializeDnData = user => {
  //If user has an active session return their current DN state
  if (user.activeSession && user.activeSession.dn) {
    return user.activeSession.dn;
  } else {
    //Return default DN state for initialization
    reporting.setSubject(user.userName, "DN", { state: "Ready" });
    reporting.setSubject(user.userName, "Calls");
    return {
      number: user.agentLogin,
      switchName: "SIP_Switch",
      agentId: user.agentLogin,
      capabilities: [
        "ready",
        "not-ready",
        "dnd-on",
        "set-forward",
        "start-monitoring"
      ],
      agentState: "Ready",
      agentWorkMode: "Unknown",
      timestamp: Date.now()
    };
  }
};

exports.makeCall = call => {
  exports.publishCallEvent(call);

  //Wait 5 seconds (5000ms) after making call for answer
  setTimeout(() => {
    /**
     * If call hasn't been answered and entered 'Established' state then set state to
     * 'Established' to simulate answering of call by recpient/destination party.
     */
    if (
      calls[call.id].state &&
      ["Ringing", "Dialing"].includes(calls[call.id].state)
    ) {
      call.state = "Established";
      reportCallState(call);
      exports.publishCallEvent(call);
    }
  }, 5000);
  return call;
};

reportCallState = call => {
  if (call.originUser) {
    reportCallStateForAgent(call.originUserName, call.originCall);
  }
  if (call.destUser) {
    reportCallStateForAgent(call.destUserName, call.destCall);
  }
};

reportCallStateForAgent = (userName, call) => {
  reporting.setSubject(userName, "Calls", { id: call.id, state: call.state });
};

exports.changeState = (req, state, options) => {
  var userName = typeof req === 'string' ? req : auth.userByCode(req);
  if (userName) {
    var user = conf.userByName(userName);
    if (user.activeSession && user.activeSession.dn) {
      var dn = user.activeSession.dn;
      dn.agentState = state;
      if (options) {
        dn.agentWorkMode = options.agentWorkMode;
        dn.dnd = options.dnd;
        if (options.reasonCode) {
          dn.reasons = [
            { key: "ReasonCode", type: "str", value: options.reasonCode }
          ];
        } else {
          dn.reasons = [];
        }
      }
      var msg = {
        dn: user.activeSession.dn,
        messageType: "DnStateChanged"
      };
      user.activeSession.dn.timestamp = Date.now();
      reporting.setSubject(userName, "DN", { state: state });
      messaging.publish(req, "/workspace/v3/voice", msg);
      return true;
    }
  }
  return false;
};

exports.handleCall = (req, res) => {
  res.set({ "Content-type": "application/json" });
  var userName = auth.userByCode(req);
  var call = calls[req.params.callid];
  var agentCall;
  if (call){
    agentCall = call.getCallByUserName(userName);
  }
  if (!call) {
    log.error(
      "Call with " + req.params.callid + " id does not exist for " + userName
    );
    utils.sendFailureStatus(res, 500);
  } else if (req.params.fn === "answer") {
    call.state = "Established";
    reportCallState(call);
    utils.sendOkStatus(req, res);
    exports.publishCallEvent(call);
  } else if (req.params.fn === "hold") {
    agentCall.state = "Held";
    reportCallState(call);
    utils.sendOkStatus(req, res);
    exports.publishAgentCallEvent(userName, agentCall);
  } else if (req.params.fn === "retrieve") {
    agentCall.state = "Established";
    reportCallStateForAgent(userName, agentCall);
    utils.sendOkStatus(req, res);
    exports.publishAgentCallEvent(userName, agentCall);
  } else if (req.params.fn === "initiate-transfer") {
    agentCall.state = "Held";
    reportCallStateForAgent(userName, agentCall);
    utils.sendOkStatus(req, res);
    exports.publishCallEvent(agentCall, userName);

    if (req.body.data && req.body.data.destination) {
      var destUser = conf.userByDestination(req.body.data.destination);
      var destUserName = destUser ? destUser.userName : null;

      var consultCall = exports.createCall(
        "Consult",
        userName,
        destUserName,
        null,
        req.body.data.destination
      );
      consultCall.parentConnId = call.id; //associate consult with the parent call
      exports.makeCall(consultCall); //make the Consult call
      reportCallState(consultCall);
    }
  } else if (req.params.fn === "single-step-conference") {
    call.state = "Established";

    var participantAdded = {};
    if (destUser) {
      participantAdded.number = destUser.activeSession.dn.number;
    } else {
      participantAdded.number = req.body.data.destination;
    }
    participantAdded.role = "RoleNewParty";
    call.addParticipant(participantAdded);

    reportCallState(call);
    utils.sendOkStatus(req, res);
    exports.publishCallEvent(call, userName);
  } else if (req.params.fn === "single-step-transfer") {
    /**
     * Not actually transferring a call. For now just complete the call so that
     * it appears to be transferred from this agent's perspective.
     */
    call.state = "Completed";
    reportCallState(call);
    rmm.recordInteractionComplete(userName, agentCall.id);
    utils.sendOkStatus(req, res);
    exports.publishCallEvent(call, userName);
  } else if (req.params.fn === "release") {
    call.state = "Released";
    reportCallState(call);
    utils.sendOkStatus(req, res);
    exports.publishCallEvent(call);
  } else if (req.params.fn === "complete") {
    agentCall.state = "Completed";
    reportCallStateForAgent(userName, agentCall);
    rmm.recordInteractionComplete(userName, agentCall.id);
    utils.sendOkStatus(req, res);
    exports.publishAgentCallEvent(userName, agentCall);
  } else if (
    req.params.fn === "start-recording" ||
    req.params.fn === "resume-recording"
  ) {
    agentCall.recordingState = "Recording";
    utils.sendOkStatus(req, res);
    exports.publishAgentCallEvent(userName, agentCall, 'CallRecordingStateChange');
  } else if (req.params.fn === "stop-recording") {
    agentCall.recordingState = "Stopped";
    utils.sendOkStatus(req, res);
    exports.publishAgentCallEvent(userName, agentCall, 'CallRecordingStateChange');
  } else if (req.params.fn === "pause-recording") {
    agentCall.recordingState = "Paused";
    utils.sendOkStatus(req, res);
    exports.publishAgentCallEvent(userName, agentCall, 'CallRecordingStateChange');
  } else if (req.params.fn === "update-user-data") {
    var entries = req.body.data.userData;
    for (var entry of entries) {
      //If updating an entry with multiple instances of the same key, consolidate the keys first
      call.userData = consolidateKey(call.userData, entry);
      //Add/update the entry
      utils.createOrUpdate(call.userData, entry);
    }
    utils.sendOkStatus(req, res);
    exports.publishAttachedDataChangeEvent(call);
    rmm.updateUserData(call.id, call.userData);
  } else if (req.params.fn === "attach-user-data") {
    var entries = req.body.data.userData;
    for (var entry of entries) {
      //Push to array regardless of if the key already exists
      call.userData.push(entry);
    }
    utils.sendOkStatus(req, res);
    exports.publishAttachedDataChangeEvent(call);
    rmm.updateUserData(call.id, call.userData);
  } else if (req.params.fn === "delete-user-data-pair") {
    var key = req.body.key;
    var index = call.userData.findIndex(e => e.key === key);
    call.userData.splice(index, 1);
    utils.sendOkStatus(req, res);
    exports.publishAttachedDataChangeEvent(call);
  } else if (req.params.fn === "send-dtmf") {
    utils.sendOkStatus(req, res);
    exports.publishAgentCallEvent(userName, agentCall);
  } else if (req.params.fn === 'set-comment') {
    utils.sendOkStatus(req, res);
  } else {
    utils.sendFailureStatus(res, 501);
  }
};

consolidateKey = (array, property) => {
  var key = property.key;
  return _.uniq(array, function(p) {
    return p.key === key ? p.key : p;
  });
};

exports.publishCallEvent = call => {
  if (call.originUser) {
    exports.publishAgentCallEvent(call.originUser.userName, call.originCall);
  }
  if (call.destUser) {
    exports.publishAgentCallEvent(call.destUser.userName, call.destCall);
  }
};

exports.publishAttachedDataChangeEvent = call => {
  if (call.originUser) {
    exports.publishAgentCallEvent(
      call.originUser.userName,
      call.originCall,
      "AttachedDataChanged"
    );
  }
  if (call.destUser) {
    exports.publishAgentCallEvent(
      call.destUser.userName,
      call.destCall,
      "AttachedDataChanged"
    );
  }
};

exports.publishAgentCallEvent = (agent, call, notificationType) => {
  var msg = {
    notificationType: notificationType ? notificationType : "StateChange",
    call: call,
    messageType: "CallStateChanged"
  };
  messaging.publish(agent, "/workspace/v3/voice", msg);
  return msg;
};

/**
 * This class wraps both the origin and destination call information.
 * It provides some methods for updating both calls at once (eg. changing state to Established).
 * The calls can also be referenced individually if only one side needs to be changed: originCall and destCall
 */
class Call {
  constructor(callType, originUser, destUser, originNumber, destNumber, defaultAttachedData) {
    this.id = conf.id();
    this.callUuid = conf.id();
    this.callType = callType;
    if (callType === 'Inbound') {
      this._userData = _.clone(attachedData);
    } else {
      this._userData = defaultAttachedData ? defaultAttachedData : [];
    }

    if (defaultAttachedData && callType === "Inbound"){
      // add each default attached data
      defaultAttachedData.forEach((data) => {
        let el = this._userData.find((d) => {d.key === data.key})
        if (el){
          el.value = data.value
          el.type = data.type
        }else{
          this._userData.push(data)
        }
      })
    }
    this._parentConnId;
    this._state = "Dialing";
    this.startedAt = new Date();

    //Populate origin/dest usernames and numbers based on provided info
    this.destNumber = destNumber;
    this.originNumber = originNumber;
    this.originUser = originUser;
    this.destUser = destUser;
    this.originUserName = originUser ? originUser.userName : null;
    this.destUserName = destUser ? destUser.userName : null;

    this.originCall = {
      id: this.id,
      phoneNumber: this.originNumber,
      connId: this.id,
      callUuid: this.callUuid,
      userData: this._userData,
      extensions: extensions,
      dnis: this.destNumber,
      capabilities: [],
      callType: this.callType,
      _state: "Dialing",
      participants: [
        {
          number: this.destNumber,
          role: "RoleDestination"
        }
      ],
      _recordingState: "Stopped",
      duration: 0,
      startedAt: this.startedAt,

      //Update capabilities when state is changed
      set state(state) {
        this._state = state;
        //Special capabilities for some states for originating caller on Consult call
        if (
          this.callType === "Consult" &&
          capabilitiesDefinitions.ConsultOrigin[state]
        ) {
          this.capabilities = _.clone(
            capabilitiesDefinitions.ConsultOrigin[state]
          );
        } else if (capabilitiesDefinitions.Standard[state]) {
          this.capabilities = _.clone(capabilitiesDefinitions.Standard[state]);
        } else if (state === "Held") {
          this.capabilities.splice(this.capabilities.indexOf("hold"), 1);
          this.capabilities.push("retrieve");
        }
      },
      get state() {
        return this._state;
      },
      //Update capabilities when recording state is changed
      set recordingState(state) {
        this._recordingState = state;
        if (state === "Recording") {
          this.capabilities.splice(
            this.capabilities.indexOf("start-recording"),
            1
          );
          this.capabilities.push("stop-recording");
          this.capabilities.push("pause-recording");
        } else if (state === "Stopped") {
          this.capabilities.splice(
            this.capabilities.indexOf("pause-recording"),
            1
          );
          this.capabilities.splice(
            this.capabilities.indexOf("stop-recording"),
            1
          );
          this.capabilities.push("start-recording");
        } else if (state === "Paused") {
          this.capabilities.splice(
            this.capabilities.indexOf("pause-recording"),
            1
          );
          this.capabilities.push("resume-recording");
        }
      },
      get recordingState() {
        return this._recordingState;
      },
      updateDuration() {
        this.duration = Math.round(
          (new Date().getTime() - this.startedAt.getTime()) / 1000
        );
      }
    };
    this.originCall.state = "Dialing";
    if (originUser) {
      this.originCall.userData.push(this.getInitialUserData(originUser));
    }
    if (destUser) {
      this.originCall.userData.push(this.getInitialUserData(destUser));
    }

    //Same as origin call, but with some fields/methods overridden for the destination user
    this.destCall = {
      phoneNumber: this.destNumber,
      _state: "Ringing",
      participants: [
        {
          number: this.originNumber,
          role: "RoleOrigination"
        }
      ],

      set state(state) {
        this._state = state;
        if (capabilitiesDefinitions.Standard[state]) {
          this.capabilities = _.clone(capabilitiesDefinitions.Standard[state]);
        } else if (state === "Held") {
          this.capabilities.splice(this.capabilities.indexOf("hold"), 1);
          this.capabilities.push("retrieve");
        }
      },
      get state() {
        return this._state;
      }
    };
    this.destCall = Object.assign(this.destCall, this.originCall);
    this.destCall.state = "Ringing";
    this.destCall.dnis = this.destNumber;
    this.destCall.participants = [
      {
        number: this.originNumber,
        role: "RoleOrigination"
      }
    ];

    //Index the calls by username and number
    this.callByUserName = {};
    this.callByUserName[this.originUserName] = this.originCall;
    this.callByUserName[this.destUserName] = this.destCall;
    this.callByUser = {};
    this.callByUser[this.originUser] = this.originCall;
    this.callByUser[this.destUser] = this.destCall;

    this.callByNumber = {};
    this.callByNumber[this.originNumber] = this.originCall;
    this.callByNumber[this.destNumber] = this.destCall;
  }

  getCallByUserName(userName) {
    return this.callByUserName[userName];
  }

  getCallByUser(user) {
    return this.callByUser[user];
  }

  getCallByNumber(number) {
    return this.callByNumber[number];
  }

  updateState(state) {
    this.state = state;
  }

  get state() {
    return this._state;
  }

  set state(state) {
    this._state = state;
    var origin = this.originCall;
    var dest = this.destCall;
    origin.state = state;
    dest.state = state;
  }

  get parentConnId() {
    return _parentConnId;
  }

  set parentConnId(connId) {
    this._parentConnId = connId;
    var origin = this.originCall;
    var dest = this.destCall;
    origin.parentConnId = connId;
    dest.parentConnId = connId;
  }

  addParticipant(participant) {
    var origin = this.originCall;
    var dest = this.destCall;
    origin.participants.push(participant);
    dest.participants.push(participant);
  }

  get userData() {
    return this._userData;
  }

  set userData(userData) {
    this._userData = userData;
    this.originCall.userData = userData;
    this.destCall.userData = userData;
  }

  getInitialUserData(user) {
    return {
      key: `WWE_PARTY_${user.agentLogin}`,
      type: "kvlist",
      value: [
        {
          key: "username",
          type: "str",
          value: `${user.userName}`
        },
        {
          key: "firstname",
          type: "str",
          value: `${user.firstName}`
        },
        {
          key: "lastname",
          type: "str",
          value: `${user.lastName}`
        },
        {
          key: "dbid",
          type: "int",
          value: user.DBID
        }
      ]
    };
  }
}

exports.createCall = (
  callType,
  originUserName,
  destUserName,
  originNumber,
  destNumber,
  defaultAttachedData,
  defaultExtensions
) => {
  //Determine origin/dest usernames and numbers based on provided info
  var originUser = originUserName
    ? conf.userByName(originUserName)
    : conf.userByDestination(originNumber);
  var originNumber = originUser ? originUser.agentLogin : originNumber;
  var destUser = destUserName
    ? conf.userByName(destUserName)
    : conf.userByDestination(destNumber);
  var destNumber = destUser ? destUser.agentLogin : destNumber;

  var call = new Call(callType, originUser, destUser, originNumber, destNumber, defaultAttachedData);
  calls[call.id] = call;

  if (originUser) {
    reporting.setSubject(originUserName, "Calls", {
      id: call.id,
      callType: callType,
      state: call.originCall.state
    });
    rmm.recordInteraction(originUserName, call.originCall);
    
    if (originUser.userName && defaultExtensions) {
      const gvmMailboxExtension = defaultExtensions.find((extension) => {
        return (extension && extension.key === 'gvm_mailbox');
      });
      if (gvmMailboxExtension && gvmMailboxExtension.value) {
        cleanMailbox(originUser.userName, gvmMailboxExtension.value);
      }
    }
  }
  if (destUser) {
    reporting.setSubject(destUserName, "Calls", {
      id: call.id,
      callType: callType,
      state: call.destCallstate
    });
    rmm.recordInteraction(destUserName, call.destCall);
  }

  return call;
};

cleanMailbox = (agent, destNumber) => {
  const matchingAgentGroup = agentGroups.find((agentGroup) => {
    return agentGroup.settings && agentGroup.settings.TServer && agentGroup.settings.TServer.gvm_mailbox === destNumber
  });
  this.createVoiceMail(agent, 0, 0, matchingAgentGroup ? matchingAgentGroup.name : '')
}

const agentGroups = utils.requireAndMonitor(
  "../../../data/agent-groups.yaml",
  updated => {
    agentGroups = updated;
  }
);

exports.createVoiceMail = (agent, newmessages, oldmessages, groupName) => {
  var mailbox;
  var user = conf.userByName(agent);
  //If no group selected, personal mailbox; else group mailbox
  if (!groupName) {
    mailbox = user.agentLogin;
  } else {
    var matchingAgentGroups = agentGroups.filter(
      agentGroup => agentGroup.name === groupName
    );
    if (matchingAgentGroups && matchingAgentGroups.length) {
      mailbox = matchingAgentGroups[0].settings.TServer.gvm_mailbox;
    }
  }
  var msg = {
    userData: [
      {
        key: "gsipmwi",
        type: "kvlist",
        value: [
          {
            key: "Mailbox",
            type: "str",
            value: mailbox
          },
          {
            key: "Messages-Waiting",
            type: "str",
            value: "True"
          },
          {
            key: "NewMessages",
            type: "int",
            value: newmessages
          },
          {
            key: "OldMessages",
            type: "int",
            value: oldmessages
          },
          {
            key: "Voice-Message",
            type: "str",
            value: newmessages + "/" + oldmessages + "(0/1))"
          }
        ]
      }
    ],
    messageType: "EventUserEvent"
  };
  messaging.publish(agent, "/workspace/v3/voice", msg);
};

exports.getCallById = callid => {
  return calls[callid];
};

exports.getCallsForAgent = agentUserName => {
  var agentCalls = [];
  _.forEach(Object.values(calls), call => {
    var agentCall = call.getCallByUserName(agentUserName);
    if (agentCall && agentCall.state !== "Completed") {
      agentCall.updateDuration();
      agentCalls.push(agentCall);
    }
  });
  return agentCalls;
};
