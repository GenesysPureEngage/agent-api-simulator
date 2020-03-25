<template>
  <div>
    key:
    <input
      v-model="newInteractionKey"
      type="text"
      name="key"
    >
    value:
    <input
      v-model="newInteractionValue"
      type="text"
      name="value"
    >
    type:
    <select v-model="newInteractionType">
      <option value="str">
        String
      </option>
      <option value="int">
        Integer
      </option>
    </select>
    <button
      v-if="userDataInteractions.find((data) => data.key === newInteractionKey)"
      type="button"
      class="interaction-btn"
      @click="addInteractionData"
    >
      Update
    </button>
    <button
      v-else
      type="button"
      class="interaction-btn"
      @click="addInteractionData"
    >
      Add
    </button>
  </div>
</template>

<script>
import { mapGetters } from "vuex"

export default {
  name: "AddInteraction",
  data: () => {
    return {
      newInteractionKey: null,
      newInteractionValue: null,
      newInteractionType: "str"
    }
  },
  computed: {
    ...mapGetters(["userDataInteractions"])
  },
  methods:{
    addInteractionData() {
      this.$emit('addInteraction', {
          key: this.newInteractionKey,
          type: this.newInteractionType,
          value: this.newInteractionValue
      })
      this.newInteractionKey = null
      this.newInteractionValue = null
    }
  }
};
</script>

<style>
</style>