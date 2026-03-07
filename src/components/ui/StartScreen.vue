<template>
  <div class="start-screen">
    <h1 class="start-screen__title">REAPER</h1>
    <Button label="Start Game" size="large" severity="danger" @click="startGame" />
  </div>
</template>

<script setup>
import { store } from '../../store.js'
import Button from 'primevue/button'

function startGame() {
  // Hide UI via Vue Reactivity
  store.isStartScreenVisible = false;
  
  // Forward to legacy engine integration listener
  document.dispatchEvent(new CustomEvent('start-game'));
}
</script>
