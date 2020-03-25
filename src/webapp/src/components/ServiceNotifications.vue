<template>
  <section id="notifications">
    <h2>Service state change Notifications</h2>
    <div class="controls">
      <label for="server">
        Service:
      </label>
      <select
        v-model="serviceName"
        name="serviceName"
      >
        <option value="VOICE">
          SIP Server
        </option>
        <option value="IXN">
          Interaction Server
        </option>
        <option value="UCS">
          Contact Server
        </option>
        <option value="STATS">
          Stat Server
        </option>
      </select>
      <label for="new">
        State:
      </label>
      <select
        id="serviceState"
        v-model="serviceState"
        name="serviceState"
      >
        <option value="UNAVAILABLE">
          Not Available
        </option>
        <option value="AVAILABLE">
          Available
        </option>
      </select>
      <button
        :disabled="!selectedSession"
        type="button"
        @click="createServStateChangeNotif"
      >
        New Notification
      </button>
    </div>
  </section>
</template>

<script>
import axios from 'axios'
import {mapGetters} from 'vuex'

export default {
  name: "ServiceNotifications",
  data: () => {
    return {
      serviceName: 'VOICE',
      serviceState: 'UNAVAILABLE'
    }
  },
  computed:{
    ...mapGetters([
      'selectedSession'
    ])
  },
  methods:{
    createServStateChangeNotif() { 
      axios.post('/sim/manage/service-state-change-notification/create-notification',
        {
          agent: this.selectedSession,
          serviceName: this.serviceName,
          serviceState: this.serviceState
        })
        .then(() => {
          this.$snotify.success('Notification sent !', 'Success', {timeout:3000})
        })
        .catch(() => {
          this.$snotify.error('Failed to send the notification', 'Error', {timeout:5000})
        })
    }
  }
};
</script>

<style>
</style>