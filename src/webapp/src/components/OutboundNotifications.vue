<template>
  <section id="outbound">
    <h2>Outbound Campaign Notifications</h2>
    <div class="controls">
      <label for="campaign">
        Campaign:
      </label>
      <select
        v-model="campaignName"
        name="campaignName"
      >
        <option selected
          value="Pull Preview Campaign">
          Pull Preview Campaign
        </option>
        <option value="Push Preview Campaign">
          Push Preview Campaign
        </option>
      </select>
      <label for="action">
        Action:
      </label>
      <select
        id="campaignAction"
        v-model="campaignAction"
        name="campaignAction"
      >
        <option value="LOAD">
          Load
        </option>
        <option value="UNLOAD">
          Unload
        </option>
        <option value="START">
          Start
        </option>
        <option value="STOP">
          Stop
        </option>
      </select>
      <button
        :disabled="!selectedSession"
        type="button"
        @click="createOutboundNotif"
      >
        Notify State
      </button>
    </div>
  </section>
</template>

<script>
import axios from 'axios'
import {mapGetters} from 'vuex'

export default {
  name: "OutboundNotifications",
  data: () => {
    return {
      campaignName: 'Custom Pull Preview',
      campaignAction: 'LOAD',
      loadText: 'Load',
      startText: 'Start'
    }
  },
  computed:{
    ...mapGetters([
      'selectedSession'
    ])
  },
  methods:{
    createOutboundNotif(e) {
      axios.post('/sim/manage/outbound-notification/create-notification',
        {
          agent: this.selectedSession,
          campaign: {
            campaignName: this.campaignName,
            campaignAction: this.campaignAction
          }
        })
        .then(() => {
          this.$snotify.success('Notification sent !', 'Success', {timeout:3000});
        })
        .catch(() => {
          this.$snotify.error('Failed to send the notification', 'Error', {timeout:5000});
        })
    }
  }
};
</script>

<style>
</style>