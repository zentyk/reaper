<template>
  <div>
    <!-- The Game UI Overlays go here, Game engine adds canvas to body directly -->
    <StartScreen v-show="store.isStartScreenVisible" />
    <GameOverScreen v-show="store.isGameOverVisible" />
    <div id="fadeOverlay" class="fade-overlay"></div>
    <div id="levelText" class="level-text">{{ store.levelText }}</div>
    
    <InventoryScreen />
    <GameHUD v-show="!store.isStartScreenVisible && !store.isGameOverVisible" />
    <DebugMenuModal />
    
    <div v-show="store.feedbackMessage" class="feedback-message">
      {{ store.feedbackMessage }}
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { store } from './store.js'

// Vue Components
import StartScreen from './components/ui/StartScreen.vue'
import GameOverScreen from './components/ui/GameOverScreen.vue'
import GameHUD from './components/ui/GameHUD.vue'
import InventoryScreen from './components/ui/InventoryScreen.vue'
import DebugMenuModal from './components/ui/DebugMenuModal.vue'

// Import the legacy vanilla Game entrypoint
import { Game } from '../js/Game.js'

onMounted(async () => {
    // Keep window.game for global debug access
    window.game = await Game.init();

    // Global Key Listener for Debug Menu (F3)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F3') {
        e.preventDefault(); // Prevent browser search
        store.showDebugMenu = !store.showDebugMenu;
      }
    });
})
</script>
