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
        
        <!-- Left Side: Fixed UI Panel -->
        <div class="retro-left-panel">
          
          <!-- Top Section: Health & Defensive Item -->
          <div class="retro-top-section">
             <div class="retro-health-box">
                <div class="health-ecg-line" :class="healthStatusClass"></div>
                <div class="health-text" :class="healthStatusClass">{{ healthStatusText }}</div>
             </div>
             
             <div class="retro-defensive-box">
                <div class="defensive-header">Defensive Items</div>
                <div class="defensive-slot">
                    <div class="spinning-box"></div> <!-- Placeholder for item -->
                </div>
             </div>
          </div>

          <!-- Middle Section: Fixed Action Menu -->
          <div class="retro-middle-section">
             <div v-if="store.contextMenu.visible && store.contextMenu.options.length > 0" class="fixed-action-menu">
                <button 
                  v-for="(opt, idx) in store.contextMenu.options" 
                  :key="idx"
                  class="action-btn"
                  :disabled="!opt.enabled"
                  @click="handleActionClick(opt)"
                >
                  {{ opt.label }}
                </button>
             </div>
          </div>
          <!-- Bottom Section: Prompts & Footer -->
          <div class="retro-bottom-section">
            
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
               <span v-else>Press [I] to close. Click a slot for options.</span>
            </div>
            
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
                <div v-else-if="item.type === 'weapon'" class="slot-count">{{ item.ammo != null ? item.ammo : '∞' }}</div>
              </div>
            </div>
          </div>

          <!-- Equipped Weapon / Status Block -->
          <div class="retro-status-block">
             <div class="status-header">Weapon</div>
             <div v-if="equippedWeapon" class="status-content">
                {{ equippedWeapon.name }}
                <div class="status-ammo">{{ equippedWeapon.ammo != null ? equippedWeapon.ammo : '∞' }}</div>
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

const healthStatusClass = computed(() => {
   if (store.healthPercent > 50) return 'health-fine';
   if (store.healthPercent > 20) return 'health-caution';
   return 'health-danger';
});

const healthStatusText = computed(() => {
   if (store.healthPercent > 50) return 'Fine';
   if (store.healthPercent > 20) return 'Caution';
   return 'Danger';
});

function handleActionClick(opt) {
  if (opt.enabled && typeof opt.action === 'function') {
    opt.action();
    store.contextMenu.visible = false;
  }
}

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
