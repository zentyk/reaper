<template>
  <div class="start-screen">
    <h1 class="start-screen__title">REAPER</h1>
    <button class="start-screen__button" @click="startGame">Start Game</button>
  </div>
</template>

<script setup>
import { store } from '../../store.js'

function startGame() {
  // Hide UI via Vue Reactivity
  store.isStartScreenVisible = false;
  
  // Forward to legacy engine integration listener
  document.dispatchEvent(new CustomEvent('start-game'));
}
</script>
