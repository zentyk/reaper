<template>
  <div v-show="store.isInventoryVisible" class="retro-inventory-overlay">
    
    <!-- Main Inventory Container -->
    <div class="retro-inventory-container">
      
      <!-- Top Nav Bar (Decorative for now to match reference) -->
      <div class="retro-nav-bar">
        <div class="nav-item" style="cursor: pointer;" @click="onExitClick"><span>Exit</span></div>
        <div class="nav-item"><span>Files</span></div>
        <div class="nav-item"><span>Map</span></div>
        <div class="nav-item active-nav"><i class="pi pi-briefcase"></i></div>
      </div>

      <!-- Split Layout -->
      <div class="retro-split-layout">
        
        <!-- Left Side: Viewer & Prompts -->
        <div class="retro-left-panel">
          
          <!-- Item 3D Viewer Placeholder -->
          <div class="retro-viewer-box">
             <div v-if="activeItem" class="viewer-placeholder">
               <!-- In a real game, output WebGL render target here -->
               <div class="spinning-box"></div>
             </div>
             <div v-else class="viewer-empty"></div>
          </div>

          <!-- Pickup Mode Prompt -->
          <div v-if="store.isPickupMode" class="retro-prompt-box">
            <div class="prompt-text">
              Will you take the<br>
              <span class="prompt-highlight">{{ store.pickupItemName }}</span>?
            </div>
            <div class="prompt-buttons">
              <button class="retro-btn" @click="onYes">Yes</button>
              <button class="retro-btn" @click="onNo">No</button>
            </div>
          </div>
          
          <!-- Default Footer status -->
          <div v-else class="retro-footer-box">
             <span v-if="store.examineText" style="color: #ccc;">{{ store.examineText }}</span>
             <span v-else-if="store.combineSourceIndex !== null" style="color: #bc9c6a;">Select item to combine...</span>
             <span v-else>Press [I] to close. Right-click slot for options.</span>
          </div>

        </div>

        <!-- Right Side: Inventory Grid -->
        <div class="retro-right-panel">
          <div class="retro-grid">
            <div 
              v-for="(item, index) in store.inventory" 
              :key="index"
              class="retro-slot"
              :class="{ 
                'slot-active': store.combineSourceIndex === index,
                'slot-equipped': item && item.equipped 
              }"
              @click="onSlotClick(index, $event)"
              @mouseenter="hoverItem(item)"
            >
              <div v-if="item" class="slot-content">
                <div class="slot-name">{{ item.name }}</div>
                <div v-if="item.count !== undefined" class="slot-count">{{ item.count }}</div>
              </div>
            </div>
          </div>

          <!-- Equipped Weapon / Status Block -->
          <div class="retro-status-block">
             <div class="status-header">Weapon</div>
             <div class="status-content" v-if="equippedWeapon">
                {{ equippedWeapon.name }}
                <div class="status-ammo">{{ equippedWeapon.ammo || '∞' }}</div>
             </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { store } from '../../store.js'

const activeItem = ref(null);

const equippedWeapon = computed(() => {
  return store.inventory.find(i => i && i.equipped && i.type === 'weapon');
});

function hoverItem(item) {
   if (item) activeItem.ref = item;
}

function onSlotClick(index, event) {
  if (store.inventory[index] || store.combineSourceIndex !== null) {
      activeItem.value = store.inventory[index];
      document.dispatchEvent(new CustomEvent('slot-click', { 
        detail: { index, x: event.clientX, y: event.clientY }
      }));
  }
}

// Pickup Mode Handlers
function onYes() {
  document.dispatchEvent(new CustomEvent('pickup-yes'));
}

function onNo() {
  document.dispatchEvent(new CustomEvent('pickup-no'));
}

function onExitClick() {
  store.examineText = '';
  store.combineSourceIndex = null;
  store.isInventoryVisible = false;
  // Trigger external pause toggle
  document.dispatchEvent(new CustomEvent('inventory-close'));
}
</script>
