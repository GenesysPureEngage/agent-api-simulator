<template>
  <section>
    <div class="actions">
      <button
        id="new-inbound-call"
        :disabled="!selectedSession"
        type="button"
        @click="() => createCall('Inbound', '+332980255555')"
      >
        New inbound call
      </button>
      <button
        id="new-internal-call"
        :disabled="!selectedSession"
        type="button"
        @click="() => createCall('Internal', '+332980255555')"
      >
        New internal call
      </button>
      <button
        id="new-email"
        :disabled="!selectedSession"
        type="button"
        @click="showEmailForm = !showEmailForm"
      >
        New email
      </button>
      <button
        id="new-workitem"
        :disabled="!selectedSession"
        type="button"
        @click="() => createWorkitem('FN', 'LN', 'genesys@mail.dom', 'Hello')"
      >
        New workitem
      </button>
    </div>
    <EmailForm
      v-if="showEmailForm"
      :selected-session="selectedSession"
      @submit="showEmailForm = false"
    />
  </section>
</template>

<script>
import axios from 'axios'
import {mapGetters} from 'vuex'
import EmailForm from './EmailForm'

export default {
    name: 'Actions',
    components:{
      EmailForm
    },
    data: () => {
      return {
        showEmailForm: false
      }
    },
    computed:{
      ...mapGetters([
        'selectedSession',
        'defaultAttachedData'
      ])
    },
    methods:{
      createCall(callType, orig) {
        axios.post('/sim/manage/voice/create-call',{
          agent: this.selectedSession,
          callType: callType,
          orig: orig,
          defaultAttachedData: this.defaultAttachedData
        }).then(() => {
          this.$snotify.success(null, 'Call sent', {timeout: 2000});
        }).catch((err) => {
          this.$snotify.error(err, 'Call error', {timeout: 4000});
        });
      },
      createWorkitem(fn, ln, email, subject){
        axios.post('/sim/manage/workitem/create-workitem',{
          agent: this.selectedSession,
          fn: fn,
          ln: ln,
          email: email,
          subject: subject
        }).then(() => {
          this.$snotify.success(null, 'Workitem sent', {timeout: 2000});
        }).catch((err) => {
          this.$snotify.error(err, 'Workitem error', {timeout: 4000});
        });
      }
    }
}
</script>

<style scoped>

.actions {
  width: 100%;
  margin:10px 0 10px 0;
}

</style>