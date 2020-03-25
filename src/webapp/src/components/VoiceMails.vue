<template>
  <section id="voicemails">
    <h2>Voicemail</h2>
    <div class="controls">
      <label for="new">
        New messages:
      </label>
      <input
        id="new"
        v-model="newMessages"
        class="form-control number-input"
        type="number"
        size="2"
        name="new"
        value="1"
      >
      <label for="old">
        Old messages:
      </label>
      <input
        id="old"
        v-model="oldMessages"
        class="form-control number-input"
        type="number"
        size="2"
        name="old"
        value="0"
      >
    </div>
    <p for="groups-list">
      Group for Shared messages :
    </p>
    <select v-model="groupName">
      <option
        v-for="group in groups"
        :key="group.text"
        class="groups-item"
        :value="group.value"
      >
        {{ group.text }}
      </option>
    </select>
    <button
      :disabled="!selectedSession"
      type="button"
      @click="createVoiceMail"
    >
      New Voicemail
    </button>
  </section>
</template>

<script>
import axios from "axios";
import { mapGetters } from "vuex";

export default {
  name: "Voicemails",
  data: () => {
    return {
      oldMessages: 0,
      newMessages: 0,
      groups: []
    };
  },
  computed: {
    ...mapGetters(["selectedSession"])
  },
  mounted() {
    this.getMailGroups();
  },
  methods: {
    createVoiceMail() {
      if (this.oldMessages === 0 && this.newMessages === 0) {
        this.$snotify.error("You need to send at least 1 message.", "Error.", {
          timeout: 5000
        });
        return;
      }
      axios
        .post("/sim/manage/voice/create-voice-mail", {
          agent: this.selectedSession,
          newmessages: this.newMessages,
          oldmessages: this.oldMessages,
          groupName: this.groupName
        })
        .then(() => {
          this.$snotify.success("Voicemail(s) sent !", "Success", {
            timeout: 3000
          });
        })
        .catch(() => {
          this.$snotify.error("Failed to send the voicemail(s)", "Error", {
            timeout: 3000
          });
        });
    },
    getMailGroups() {
      axios
        .get("/sim/monitor/get-agent-groups")
        .then(result => {
          //a blank entry
          this.groups.push({ text: "None", value: null });
          //and other configured entries
          result.data.forEach(element =>
            this.groups.push({ value: element.name, text: element.name })
          );
        })
        .catch(err => {
          // eslint-disable-next-line no-console
          console.error(err);
        });
    }
  }
};
</script>

<style scoped>
.number-input {
  width: 50px;
}

#voicemails {
  margin-bottom: 20px;
}
</style>