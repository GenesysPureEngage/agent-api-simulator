<template>
  <section>
    <Chat
      v-if="selectedInteraction && selectedInteraction.channelType === 'media'"
      :interaction="selectedInteraction"
    />
  </section>
</template>

<script>
import Chat from './Chat'
import {mapGetters} from 'vuex';

export default {
  name: 'InteractionDetails',
  components:{
    Chat
  },
  computed:{
    ...mapGetters(['selectedInteraction'])
  }
}
</script>

<style>

</style>