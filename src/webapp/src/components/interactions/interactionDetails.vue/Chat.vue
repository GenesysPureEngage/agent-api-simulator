<template>
  <section>
    <h1>Chat</h1>
    <div
      ref="chatMsgContainer"
      class="chat-msg-container"
    >
      <p
        v-for="message in chatMessages"
        :key="message.timestamp"
      >
        {{ message.from }}: {{ message.msg }}
      </p>
    </div>
    <div class="chat-input-container">
      <input
        v-model="chatMsg"
        type="text"
        class="chat-input"
        @keydown.enter="sendChat"
      >
      <button @click="sendChat">
        Send
      </button>
    </div>
  </section>
</template>

<script>
import axios from 'axios'
import {mapGetters} from 'vuex'
export default {
  name: 'Chat',
  props:{
    interaction: Object(null)
  },
  data: () => {
    return {
      chatMsg: ""
    }
  },
  computed:{
    ...mapGetters(['chatMessages'])
  },
  watch:{
    chatMessages:{
      handler(){
        // when a new message is sent/received, scroll to the bottom of the chat
        this.$nextTick(() => {
          this.scrollChatToBottom();
        })
      },
      deep:true
    }
  },
  mounted(){
    this.scrollChatToBottom()
  },
  methods:{
    scrollChatToBottom(){
      this.$refs.chatMsgContainer.scrollTop = this.$refs.chatMsgContainer.scrollHeight
    },
    sendChat(){
      axios.post('/workspace/v3/media/media/interactions/' + this.interaction.value + '/send-message',{
        data:{
          message: this.chatMsg,
          from: 'customer'
        }
      })
      .then(() => {
        // clear the message
        this.chatMsg = ""
      })
      .catch(() => {
        this.$snotify.error("Failed to send the message", "Error", {timeout:5000})
      })
    }
  }
}
</script>

<style scoped>

.chat-msg-container{
  height:300px;
  width:100%;
  overflow-y:auto;
  background:rgb(36, 36, 36);
}

.chat-input-container{
  display:inline-block;
  width:100%;  
}

.chat-input-container button{
  width:20%;
}

.chat-input{
  width:79%;
  background: rgba(128, 128, 128, 0.466);
  border-top: solid black 2px;
  padding-right:0;
}
</style>