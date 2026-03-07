<template>
  <div v-if="store.showDebugMenu" class="debug-modal-overlay">
    <div class="debug-modal">
      <div class="debug-header">- DEBUG MENU -</div>
      
      <div class="debug-section">UTILITY MENU</div>
      
      <ul class="debug-list">
        <li 
          v-for="(option, index) in options" 
          :key="index"
          @mouseenter="hoverIndex = index"
          @mouseleave="hoverIndex = -1"
          @click="option.action"
          class="debug-item"
        >
          <span class="cursor" :style="{ visibility: hoverIndex === index ? 'visible' : 'hidden' }">&gt; </span>
          <span>{{ option.label() }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { store } from '../../store.js';

const hoverIndex = ref(-1);

const options = [
  {
    label: () => `Infinite Health: ${store.infiniteHealthCheat ? 'ON' : 'OFF'}`,
    action: () => {
      // Need to add infiniteHealthCheat to store and game logic later, right now use simple event
      document.dispatchEvent(new CustomEvent('cheat-toggle', { bubbles: true }));
      store.infiniteHealthCheat = !store.infiniteHealthCheat;
    }
  },
  {
    label: () => `1-Hit Kill: ${store.instaKillCheat ? 'ON' : 'OFF'}`,
    action: () => store.instaKillCheat = !store.instaKillCheat
  },
  {
    label: () => `Show Colliders: ${store.showColliders ? 'ON' : 'OFF'}`,
    action: () => {
      store.showColliders = !store.showColliders;
      document.dispatchEvent(new CustomEvent('collider-cheat-toggle', { bubbles: true }));
    }
  },
  {
    label: () => 'JUMP 118 LEVEL 1',
    action: () => loadLevel(1)
  },
  {
    label: () => 'JUMP 118 LEVEL 2',
    action: () => loadLevel(2)
  },
  {
    label: () => 'RESUME GAME',
    action: () => store.showDebugMenu = false
  }
];

function loadLevel(level) {
  store.showDebugMenu = false;
  document.dispatchEvent(new CustomEvent('debug-load-level', { detail: { level }, bubbles: true }));
}
</script>

<style scoped>
.debug-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5); /* Dim the game behind it slightly */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  pointer-events: auto; /* Trap clicks */
}

.debug-modal {
  background-color: #00008b; /* Classic PS1 deep blue */
  border: 2px solid #5555ff;
  border-radius: 4px;
  padding: 2rem 4rem;
  font-family: 'Courier New', Courier, monospace;
  color: white;
  text-transform: uppercase;
  font-size: 1.5rem;
  font-weight: bold;
  text-shadow: 2px 2px 0px black;
  min-width: 600px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.8), inset 0 0 10px rgba(0, 0, 0, 0.5);
}

.debug-header {
  text-align: center;
  margin-bottom: 1.5rem;
  letter-spacing: 2px;
}

.debug-section {
  text-align: center;
  margin-bottom: 1rem;
  color: #cccccc;
}

.debug-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.debug-item {
  cursor: pointer;
  display: flex;
  align-items: center;
}

.debug-item:hover {
  color: #ffff00; /* Yellow hover state */
}

.cursor {
  display: inline-block;
  width: 2rem;
  color: #ffff00;
}
</style>
