<template>
  <div>
    <!-- The Game UI Overlays go here, Game engine adds canvas to body directly -->
    <StartScreen v-show="store.isStartScreenVisible" />
    <GameOverScreen v-show="store.isGameOverVisible" />
    <div id="fadeOverlay" class="fade-overlay"></div>
    <div id="levelText" class="level-text">{{ store.levelText }}</div>
    
    <InventoryScreen v-show="store.isInventoryVisible" />
    <ContextMenu v-show="store.contextMenu.visible" />
    <PickupPrompt v-show="store.isPickupPromptVisible" />
    <GameHUD v-show="!store.isStartScreenVisible && !store.isGameOverVisible" />
    
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
import ContextMenu from './components/ui/ContextMenu.vue'
import PickupPrompt from './components/ui/PickupPrompt.vue'

// Import the legacy vanilla Game entrypoint
import { Game } from '../js/Game.js'

onMounted(() => {
    // Keep window.game for global debug access
    window.game = new Game();
})
</script>
