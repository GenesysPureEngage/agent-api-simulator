<template>
  <main>
    <!-- Notifications -->
    <!-- eslint-disable-next-line -->
    <vue-snotify />
    <Header />
    <div id="simulator">
      <div class="separator" />
      <Interactions />
      <div class="separator" />
      <VoiceMails />
      <div class="separator" />
      <ServiceNotifications />
      <div class="separator" />
      <OutboundNotifications />
      <br>
      <br>
    </div>
  </main>
</template>

<script>
import Header from "./components/Header";
import VoiceMails from "./components/VoiceMails";
import Interactions from "./components/interactions/Interactions";
import ServiceNotifications from "./components/ServiceNotifications";
import OutboundNotifications from "./components/OutboundNotifications";
import {mapGetters} from 'vuex'

export default {
  name: "App",
  components: {
    VoiceMails,
    Interactions,
    Header,
    ServiceNotifications,
    OutboundNotifications
  },
  computed:{
    ...mapGetters(['selectedInteraction'])
  }
};
</script>

<style>
main {
  padding: 20px;
}
#simulator {
  width: 100%;
  height: 100%;
  min-height: 100%;
  font-family: PressStart2P;
  background-color: #333333;
  color: #fdfdfd;
  flex-direction: row;
  box-sizing: border-box;
  position:relative;
}

.controls button,
.controls select {
  margin: 10px;
}

button,
select {
  cursor: pointer;
  color: #fdfdfd;
  font-family: PressStart2P;
  border: 2px solid #fdfdfd;
  outline: none;
  background-color: unset;
  padding: 15px 25px;
  margin: 2px;
}

button:disabled {
  color: #fdfdfd62;
  cursor: default;
}

button:hover {
  background-color: #444444;
}

input {
  font-family: PressStart2P;
  padding: 15px 5px;
  color: #fdfdfd;
  background-color: unset;
  border: unset;
  border-bottom: 2px solid #fdfdfd;
}

input:focus {
  outline: none;
}

.separator {
  min-height: 2px;
  width: 100%;
  background-color: #fdfdfd;
  position:relative;
}

select {
  /* styling */
  background-color: #333333;
  border: thin solid white;
  border-radius: 4px;
  display: inline-block;
  line-height: 1.5em;
  padding: 10px 250x;
  width: 300px;
  height: 50px;
  font-family: PressStart2P;
}
</style>
