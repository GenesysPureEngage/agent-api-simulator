<template>
  <section>
    <div class="actions">
      <label>Caller : </label>
      <select v-model="selectedContact">
        <option 
          v-for="(contact) in contacts" 
          :key="contact.name"
          :value="contact.phoneNumber"
        >
          {{ contact.name }}
        </option>
      </select>
      <button
        id="new-inbound-call"
        :disabled="!selectedSession"
        type="button"
        @click="() => createCall('Inbound', contactNumber, this.defaultContact)"
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
      <button
        id="new-pushpreview"
        :disabled="!selectedSession"
        type="button"
        @click="() => createPushPreview()"
      >
        New Push Preview
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
        'contactNumber',
        'defaultAttachedData',
        'contacts'
      ]),
      selectedContact: {
        set(val) {
        // change the selected session
        
        this.$store.dispatch("changeContactNumber", val);
        },
        get() {
          if (!this.$store.getters.contactNumber){
            return this.defaultContact;
          }
         return this.$store.getters.contactNumber;
      }
      
    },
    defaultContact: {
      get() {
        if (this.contacts && this.contacts.length){
            return this.contacts[0].phoneNumber;
          }
          return null;
      }
    }

    },
    methods:{
      createCall(callType, orig, defaultOrig) {
        axios.post('/sim/manage/voice/create-call',{
          agent: this.selectedSession,
          callType: callType,
          orig: orig || defaultOrig,
          defaultAttachedData: this.defaultAttachedData,
          callNumber: 'orig'
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
      },
      createPushPreview() {
        axios.post('/sim/manage/outbound-notification/send-push-preview', {
          agent: this.selectedSession
        })
        .then(() => {
          this.$snotify.success(null, 'Push Preview sent !', {timeout:2000});
        })
        .catch(() => {
          this.$snotify.error(err, 'Failed to send Push Preview', {timeout:4000});
        })
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
