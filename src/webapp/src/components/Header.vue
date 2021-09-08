<template>
  <div id="header">
    <div>
      <h1 class="title">
        Agent Api Simulator
      </h1>
      <div
        id="sessions"
        class="header-elems"
      >
        <button
          v-tooltip="'Open Workspace'"
          type="button"
          @click="openWorkspace"
        >
          Workspace
        </button>
        <button
          v-tooltip="'Open Toolkit'"
          type="button"
          @click="openToolkit"
        >
          Toolkit
        </button>
        <select v-model="selectedSession">
          <option
            v-if="!sessions || sessions.length === 0"
            selected
            :value="null"
          >
            No session found
          </option>
          <option
            v-else
            selected
            :value="null"
          >
            Select a session
          </option>
          <option
            v-for="(session, index) in sessions"
            :key="session.name + '-' + index"
          >
            {{ session.name }}
          </option>
        </select>
      </div>
    </div>
    <div class="separator" />
    <Actions />
  </div>
</template>

<script>
import Actions from "./Actions";
import { mapGetters } from "vuex";

export default {
  name: "Header",
  components: {
    Actions
  },
  computed: {
    ...mapGetters(["sessions", "isToolkitSampleSet"]),
    selectedSession: {
      set(val) {
        // change the selected session
        this.$store.dispatch("changeSelectedSession", val);
      },
      get() {
        return this.$store.getters.selectedSession;
      }
    }
  },
  methods: {
    openWorkspace() {
      window.open("/sim/workspace-ui", "_blank");
    },
    openToolkit() {
      window.open(window.location.protocol + "//localhost:8080/toolkit/components.html", "_blank");
    }
  }
};
</script>

<style scoped>
#header {
  width: 100%;
  font-family: PressStart2P;
  background-color: #333333;
  color: #fdfdfd;
  display: flex;
  flex-direction: column;
  position: relative;
}

.title {
  float: left;
}
.header-elems {
  float: right;
  margin-top: 15px;
}

.header-elems button {
  margin-right: 10px;
}
</style>