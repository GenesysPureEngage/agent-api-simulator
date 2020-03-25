/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

/* eslint-disable no-console */
import Vuex from 'vuex'
import Vue from 'vue'
import axios from 'axios'
import * as CometD from 'cometd'


function buildInteractionsList({ commit, state, dispatch }, data) {
  let list = []
  data.forEach((ixn) => {
    list.push({ value: ixn.id, text: `${ixn.type}: ${ixn.displayName}`, channelType: ixn.channelType })
  })
  commit('setInteractionList', list)
  if (list.length > 0 && state.selectedInteraction === null) {
    dispatch('selectInteraction', list[0])
  } else if (list.length === 0) {
    dispatch('selectInteraction', null)
  }
}

Vue.use(Vuex)
// Set the store
export default new Vuex.Store({
  state: {
    sessions: [],
    selectedSession: null,
    isToolkitSampleSet: false,
    cometd: null,
    cometdSubscriptions: {
      agentInteractions: null,
      userData: null
    },
    interactionList: [],
    selectedInteraction: null,
    userDataInteractions: [],
    defaultAttachedData: localStorage.getItem('genesys.gws-simulator.defaultAttachedData')
      ? JSON.parse(localStorage.getItem('genesys.gws-simulator.defaultAttachedData'))
      : []
  },
  getters: {
    sessions(state) {
      return (state.sessions)
    },
    isToolkitSampleSet(state) {
      return (state.isToolkitSampleSet)
    },
    selectedSession(state) {
      return (state.selectedSession)
    },
    cometd(state) {
      return (state.cometd)
    },
    interactionList(state) {
      return (state.interactionList)
    },
    cometdSubscriptions(state) {
      return (state.cometdSubscriptions)
    },
    selectedInteraction(state) {
      return (state.selectedInteraction)
    },
    userDataInteractions(state) {
      return (state.userDataInteractions)
    },
    defaultAttachedData(state) {
      return (state.defaultAttachedData)
    }
  },
  mutations: {
    setSelectedSession(state, session) {
      state.selectedSession = session
    },
    setIsToolkitSampleSet(state, status) {
      state.isToolkitSampleSet = status
    },
    setSessions(state, users) {
      // add the session
      state.sessions = users.map(user => { return ({ name: user }) })
    },
    setCometd(state, cometd) {
      state.cometd = cometd
    },
    setInteractionList(state, list) {
      state.interactionList = list
    },
    setSelectedInteraction(state, interaction) {
      state.selectedInteraction = interaction
    },
    setUserDataInteractions(state, interactions) {
      state.userDataInteractions = []
      if (!interactions) {
        return
      }
      interactions.forEach((interaction) => {
        state.userDataInteractions.push({
          key: interaction.key,
          type: interaction.type,
          value: interaction.type === 'kvlist' ? JSON.stringify(interaction.value) : interaction.value
        })
      })
    },
    setDefaultAttachedData(state, data) {
      state.defaultAttachedData = data
      localStorage.setItem('genesys.gws-simulator.defaultAttachedData', JSON.stringify(data))
    }
  },
  actions: {
    async changeSelectedSession({ state, commit, dispatch }, session) {
      commit('setSelectedSession', session)
      // init cometd
      await dispatch('initCometD', 'https://localhost:7777/simulator/notifications')
      // if cometd is not set, leave
      if (!state.cometd) {
        console.error("Trying to select a session without commetd")
        return
      }
      // subscribe to this agent notifications
      if (state.cometdSubscriptions.agentInteractions) {
        state.cometd.unsubscribe(state.cometdSubscriptions.agentInteractions)
      }
      // If session is null, leave
      if (!session) {
        return
      }
      // get the currnet interactions for this session
      axios.get('/sim/monitor/get-interactions?agent=' + session).then(function (data) {
        buildInteractionsList({ state: state, commit: commit, dispatch: dispatch }, data.data);
      }).catch(() => {});

      // set a callback using cometd to get the future interactions
      state.cometdSubscriptions.agentInteractions = state.cometd.subscribe(`/interactions/${session}`,
        (m) => buildInteractionsList({ state: state, commit: commit, dispatch: dispatch }, m.data));
    },
    selectInteraction({ state, getters, commit }, interaction) {
      commit('setSelectedInteraction', interaction)
      if (!getters.cometd || !interaction) {
        commit('setUserDataInteractions', null)
        return
      }
      if (getters.cometdSubscriptions.userData) {
        getters.cometd.unsubscribe(getters.cometdSubscriptions.userData);
      }
      axios.get('/sim/monitor/get-ixn-user-data?id=' + interaction.value).then((m) => {
        commit('setUserDataInteractions', m.data)
      })
      state.cometdSubscriptions.userData = getters.cometd.subscribe(`/user-data/${interaction.value}`, function (m) {
        commit('setUserDataInteractions', m.data)
      });
    },
    initCometD({ commit, dispatch, getters }, url) {
      // if cometd is already set, disconnect it
      if (getters.cometd){
        console.log("disconnecting from previous cometd connection")
        getters.cometd.disconnect();
      }
      // Create the CometD object.
      var cometd = new CometD.CometD();

      cometd.configure({
        url: url
      })
      return (new Promise((resolve, reject) => {
        // Handshake with the server.
        cometd.handshake(function (h) {
          if (h.successful) {
            // reset previous session data
            commit('setSelectedInteraction', null)
            commit('setUserDataInteractions', null)
            // Subscribe to receive messages from the server.
            cometd.subscribe('/sessions', function (m) {
              // set the sessions
              commit('setSessions', m.data)
              // if there is no session, set the selected session to null
              if (!m.data || m.data.length === 0) {
                dispatch('changeSelectedSession', null);
              }
              else if (m.data && m.data.length > 0 && !getters.selectedSession) {
                // if a session is present and no one is currently selected, select it
                dispatch('changeSelectedSession', m.data[0])
              }
            });
            // set cometd
            commit('setCometd', cometd)
            resolve();
          } else {
            commit('setCometd', null)
          }
        })
      }))
    },
    loadSessions({ commit, dispatch, getters }) {
      // request the sessions from the server
      axios.get('/sim/monitor/get-sessions').then((response) => {
        commit('setSessions', response.data)
        // if a session is present and no one is currently selected, select it
        if (response.data && response.data.length > 0 && !getters.selectedSession) {
          dispatch('changeSelectedSession', response.data[0])
        }
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err)
      })
    },
    loadToolkitSampleStatus({ commit }) {
      // ask the server if the toolkit sample is set
      axios.get('/sim/is-toolkit-sample').then((response) => {
        commit('setIsToolkitSampleSet', response.data.isToolkitSample)
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err)
      })
    },
    addInteractionData({ getters }, { data, snotify }) {
      axios
        .post(
          "/workspace/v3/voice/calls/" +
          getters.selectedInteraction.value +
          "/update-user-data",
          {
            data: {
              userData: [data]
            }
          }
        )
        .catch(() => {
          if (snotify) {
            snotify.error("Failed to add the new data", "Error !", {
              timeout: 5000
            });
          }
        });
    },
    addDefaultAttachedData({ commit, getters }, data) {
      let attachedData = getters.defaultAttachedData
      // check if an element with this key already exist
      let existingElement = attachedData.find((d) => d.key === data.key)
      // if so, update the value
      if (existingElement) {
        existingElement.value = data.value
      }
      else {
        // otherwise, add the element
        attachedData.push(data)
      }
      commit('setDefaultAttachedData', attachedData)
    },
    removeDefaultAttachedData({ commit, getters }, dataKey) {
      let attachedData = getters.defaultAttachedData
      let index = attachedData.findIndex((data) => data.key === dataKey)
      if (index < 0) {
        return
      }
      attachedData.splice(index, 1)
      commit('setDefaultAttachedData', attachedData)
    }
  }
})