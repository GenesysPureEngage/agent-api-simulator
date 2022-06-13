<template>
  <form class="email-form">
    <h4>New email</h4>
    <div>
      <label>Subject : </label>
      <input
        v-model="subject"
        type="text"
        placeholder="Email title"
      >
    </div>
    <div>
      <label>From : </label>
      <select v-model="from">
        <option 
          v-for="(contact) in contacts"
          :key="contact.name"
          :value="contact.email"
        >
          {{ contact.name }}
        </option>
      </select>
    </div>
    <textarea
      v-model="content"
      placeholder="Email content"
    />
    <button @click.prevent="createEmail">
      Send
    </button>
    <button @click.prevent="cancelEmail">
      Cancel
    </button>
  </form>
</template>

<script>
import axios from "axios";
import { mapGetters } from "vuex";

export default {
  name: "EmailForm",
  props: {
    selectedSession: Object(null)
  },
  data: () => {
    return {
      content: "Hello, world",
      subject: "Hello world",
      from: "genesys@mail.dom"
    };
  },
      computed:{
      ...mapGetters([
        'contactEmail', 
        'contacts'
      ])
    },
  methods: {
    createEmail() {
      axios
        .post(
          "/sim/manage/email/create-email",
            {
              agent: this.selectedSession,
              from: this.from,
              to: 'emailserver@mail.dom',
              subject: this.subject,
              content: this.content
            }
        )
        .then(() => {
          this.$snotify.success(null, "Email sent", { timeout: 2000 });
          this.$emit("submit");
        })
        .catch(err => {
          this.$snotify.error(err, "Email error", { timeout: 4000 });
        });
    },
    cancelEmail() {
      this.$emit("submit");
    }
  }
};
</script>

<style scoped>
.email-form {
  width: 100%;
  padding-bottom:1em;
}

.email-form input {
  width:100%;
  margin: 0 1em 1em 1em;
}

.email-form textarea {
  width: 100%;
  height: 300px;
  font-family: PressStart2P;
  background-color: #333333;
  color: #fdfdfd;
  flex-direction: row;
  box-sizing: border-box;
  position: relative;
  padding: 1em;
  margin-bottom:1em;
}
</style>