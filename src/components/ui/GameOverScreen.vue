<template>
  <!-- In App.vue we use v-show for visibility. But for proper CSS transitions matching the legacy version, 
       we'll control the interior classes reactively based on the phase state driven by store.isGameOverVisible -->
  <div class="game-over-screen" 
       :class="{ 
         'game-over-screen--visible': store.isGameOverVisible,
         'game-over-screen--white': phase >= 1,
         'game-over-screen--black': phase >= 3
       }">
    <div class="game-over-screen__text" :class="{'game-over-screen__text--visible': phase >= 2}">
      YOU DIED
    </div>
  </div>
</template>

<script setup>
import { store } from '../../store.js'
import { watch, ref } from 'vue'

const phase = ref(0)

watch(() => store.isGameOverVisible, (newVal) => {
  if (newVal) {
    // Replicate legacy Game.js and GameOverScreen.js visual delays
    // Phase 1: Fade to White
    setTimeout(() => { phase.value = 1 }, 50);
    // Phase 2: Show YOU DIED Text
    setTimeout(() => { phase.value = 2 }, 2000);
    // Phase 3: Fade to Black
    setTimeout(() => { phase.value = 3 }, 5000);
  } else {
    phase.value = 0;
  }
})
</script>
