<template>
  <div id="default-interaction">
    <ul>
      <InteractionData
        v-for="data in defaultAttachedData"
        :key="data.key"
        :data="data"
        @update="addInteraction"
        @delete="removeInteractionData"
      />
    </ul>
    <AddInteraction @addInteraction="addInteraction" />
  </div>
</template>

<script>
import {mapGetters} from 'vuex'
import AddInteraction from './AddInteraction'
import InteractionData from './InteractionData'

export default {
  name: 'DefaultInteractionData',
  components:{
    AddInteraction,
    InteractionData
  },
  computed:{
    ...mapGetters(['defaultAttachedData'])
  },
  methods:{
    removeInteractionData(data){
      this.$store.dispatch('removeDefaultAttachedData', data.key)
    },
    addInteraction(data){
      this.$store.dispatch('addDefaultAttachedData', data)
    }
  }
}
</script>

<style scoped>

#default-interaction{
  margin-bottom:20px;
}

</style>