/**
* The Agent API Simulator is being released under the standard MIT License.
* Copyright (c) 2020 Genesys. All rights reserved.
*/

import Vue from 'vue'
import App from './App.vue'
import store from './store'
import Snotify, { SnotifyPosition } from 'vue-snotify'
import Tooltip from 'vue-directive-tooltip';
import 'vue-directive-tooltip/dist/vueDirectiveTooltip.css';

Vue.use(Tooltip, {
  delay: 100
});

Vue.config.productionTip = false

Vue.use(Snotify, {
  toast: {
    position: SnotifyPosition.rightBottom
  }
})
new Vue({
  store,
  mounted() {
    // Check if a toolkit sample is present
    this.$store.dispatch('loadToolkitSampleStatus')
    // load the session a first time (if there is a session change, we will know by cometd)
    this.$store.dispatch('loadSessions')

    this.$store.dispatch('loadContacts');
    // init cometd
    this.$store.dispatch('initCometD', 'https://localhost:7777/simulator/notifications')
  },
  render: h => h(App),
}).$mount('#app')
