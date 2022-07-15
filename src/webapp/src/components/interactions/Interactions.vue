<template>
  <section>
    <h2>Interactions</h2>
    <div id="current-interaction">
      <div
        id="current-interaction-control"
        class="container"
      >
      <!--Temporaly unsude code due to not supported chat functionality -->
        <!-- <h4>
          <button
            type="button"
            @click="showInteractionUserData = !showInteractionUserData"
          >
            <span v-if="showInteractionUserData">
              Show Interaction Details
            </span>
            <span v-else>
              Show Interaction Data
            </span>
          </button>
        </h4> -->
        <select
          id="interaction-list"
          v-model="selectedInteraction"
        >
          <option
            v-for="(interaction, index) in interactionList"
            :key="'interaction-' + index"
            :value="interaction.value"
          >
            {{ index }} - {{ interaction.text }}
          </option>
          <option :value="null">
            Default interaction
          </option>
        </select>
      </div>
      <div
        v-if="selectedInteraction && showInteractionUserData && userDataInteractions && userDataInteractions.length > 0"
      >
        <ul>
          <InteractionData
            v-for="(userDataInteraction, index) in userDataInteractions"
            :key="index + '-' + userDataInteraction.key"
            :data="userDataInteraction"
            @update="updateInteractionData"
            @delete="deleteInteractionData"
          />
          <AddInteraction
            v-if="selectedInteraction"
            @addInteraction="addInteraction"
          />
        </ul>
        <div class="panel panel-info" />
      </div>
      <InteractionDetails
        v-else-if="!showInteractionUserData"
        class="interaction-details"
      />
      <DefaultInteractionData v-if="!selectedInteraction" />
    </div>
  </section>
</template>

<script>
import { mapGetters } from "vuex";
import axios from "axios";
import InteractionData from "./InteractionData";
import InteractionDetails from "./interactionDetails.vue/InteractionDetails";
import AddInteraction from "./AddInteraction";
import DefaultInteractionData from "./DefaultInteractionData";

export default {
  name: "Interactions",
  components: {
    InteractionData,
    InteractionDetails,
    AddInteraction,
    DefaultInteractionData
  },
  data: () => {
    return {
      showInteractionUserData: true
    };
  },
  computed: {
    ...mapGetters(["interactionList", "userDataInteractions"]),
    selectedInteraction: {
      get() {
        return this.$store.getters.selectedInteraction
          ? this.$store.getters.selectedInteraction.value
          : this.$store.getters.selectedInteraction;
      },
      set(val) {
        let interaction = this.interactionList.find(i => i.value === val);
        if (!interaction) {
          this.$store.dispatch("selectInteraction", null);
          return;
        }
        this.$store.dispatch("selectInteraction", interaction);
      }
    }
  },
  methods: {
    addInteraction(data) {
      this.$store.dispatch("addInteractionData", {
        data: data,
        snotify: this.$snotify
      });
    },
    updateInteractionData(data) {
      this.$store.dispatch("addInteractionData", {
        data: data,
        snotify: this.$snotify
      });
    },
    deleteInteractionData(data) {
      if (!data) {
        console.error("deleteInteractionData: !data")
        return;
      }
      // search for the interaction
      const interaction = this.interactionList.find(
        i => i.value === this.selectedInteraction
      );
      // if not found, leave
      if (!interaction) {
        console.error("deleteInteractionData: !interaction")
        return;
      }
      // if voice
      if (interaction.channelType === "voice") {
        axios
          .post(
            "/workspace/v3/voice/calls/" +
              interaction.value +
              "/delete-user-data-pair",
            { key: data.key }
          )
          .then(() => {
            const index = this.userDataInteractions.findIndex(
              data => data.key === data.key
            );
            if (index >= 0) {
              this.userDataInteractions.splice(index, 1);
            }
          })
          .catch(() => {
            this.$snotify.error("Failed to remove the data", "Error !", {
              timeout: 5000
            });
          });
      } else {
        //TODO delete media interaction user data
      }
    }
  }
};
</script>

<style>
.interaction-btn {
  float: right;
  min-width: 150px;
}
</style>

<style scoped>
.fa {
  padding-right: 1em;
  font-size: 20px;
}

#interaction-list {
  width: auto;
  min-width: 250px;
}

#current-interaction-control {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.interaction-details {
  margin-bottom: 20px;
}
</style>