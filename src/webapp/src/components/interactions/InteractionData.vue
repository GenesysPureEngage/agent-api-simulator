<template>
  <li class="user-data">
    <span>{{ data.key }}</span>
    <button
      v-if="String(data.value) === defaultValue"
      type="button"
      class="interaction-btn"
      @click="() => removeInteractionData()"
    >
      Remove
    </button>
    <button
      v-else
      type="button"
      class="interaction-btn"
      @click="() => updateInteractionData()"
    >
      Update
    </button>
    <input
      v-model="data.value"
      type="text"
    >
  </li>
</template>

<script>
import {mapGetters} from 'vuex'

export default {
  name: "InteractionData",
  props: {
    data: Object(null)
  },
  data: () => {
    return {
      defaultValue: null
    };
  },
  computed: {
    ...mapGetters(["interactionList", "userDataInteractions", "selectedInteraction"])
  },
  mounted() {
    this.defaultValue = this.createCopyOfValue()
  },
  methods: {
    createCopyOfValue(){
      // eslint-disable-next-line no-console
      return (String(this.data.value).repeat(1))
    },
    updateInteractionData() {
      this.defaultValue = this.createCopyOfValue()
      this.$emit('update', {
          key: this.data.key,
          type: this.data.type,
          value: this.data.value
        })
    },
    removeInteractionData() {
      this.$emit('delete', {
          key: this.data.key,
          type: this.data.type,
          value: this.data.value
        })
    }
  }
};
</script>

<style>
.user-data {
  display: inline-block;
  width: 100%;
}

.user-data input {
  width: 60%;
  margin-right: 5%;
  float: right;
}
</style>