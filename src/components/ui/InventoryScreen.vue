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
                  :class="{ 'action-btn-selected': selectedMenuIndex === idx }"
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
                <button class="retro-btn" :class="{ 'btn-selected': selectedPickupIndex === 0 }" @click="onYes">Yes</button>
                <button class="retro-btn" :class="{ 'btn-selected': selectedPickupIndex === 1 }" @click="onNo">No</button>
              </div>
            </div>

            <!-- Discard Mode Prompt -->
            <div v-else-if="store.discardItemIndex !== null" class="retro-prompt-box">
              <div class="prompt-text">
                The <span class="prompt-highlight">{{ store.discardItemName }}</span> appears to be useless now.<br>
                Discard it?
              </div>
              <div class="prompt-buttons">
                <button class="retro-btn" :class="{ 'btn-selected': selectedPickupIndex === 0 }" @click="onDiscardYes">Yes</button>
                <button class="retro-btn" :class="{ 'btn-selected': selectedPickupIndex === 1 }" @click="onDiscardNo">No</button>
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
                'slot-selected': selectedIndex === index && !store.contextMenu.visible,
                'slot-equipped': item && item.equipped 
              }"
              @click="onSlotClick(index, $event)"
              @mouseenter="hoverItem(item, index)"
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { store } from '../../store.js'

const activeItem = ref(null);
const selectedIndex = ref(0);
const selectedMenuIndex = ref(0);
const selectedPickupIndex = ref(0);

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

function hoverItem(item, index) {
   if (item) activeItem.value = item;
   selectedIndex.value = index;
}

function onSlotClick(index, event) {
  if (store.inventory[index] || store.combineSourceIndex !== null) {
      selectedIndex.value = index;
      activeItem.value = store.inventory[index];
      
      let x = event ? event.clientX : window.innerWidth * 0.75;
      let y = event ? event.clientY : window.innerHeight * 0.5;

      document.dispatchEvent(new CustomEvent('slot-click', { 
        detail: { index, x, y }
      }));
  }
}

// Keyboard Navigation
function handleKeyDown(e) {
  if (!store.isInventoryVisible) return;

  const key = e.key.toLowerCase();

  // Handle Pickup / Discard Mode
  if (store.isPickupMode || store.discardItemIndex !== null) {
    if (key === 'arrowleft') {
      selectedPickupIndex.value = 0;
      e.preventDefault();
    } else if (key === 'arrowright') {
      selectedPickupIndex.value = 1;
      e.preventDefault();
    } else if (key === 'enter' || key === ' ') {
      if (store.isPickupMode) {
          if (selectedPickupIndex.value === 0) onYes();
          else onNo();
      } else {
          if (selectedPickupIndex.value === 0) onDiscardYes();
          else onDiscardNo();
      }
      e.preventDefault();
    } else if (key === 'y') {
      if (store.isPickupMode) onYes(); else onDiscardYes();
      e.preventDefault();
    } else if (key === 'n' || key === 'escape') {
      if (store.isPickupMode) onNo(); else onDiscardNo();
      e.preventDefault();
    }
    return;
  }

  // If Context Menu is visible, navigate it
  if (store.contextMenu.visible) {
    if (key === 'arrowup') {
      selectedMenuIndex.value = Math.max(0, selectedMenuIndex.value - 1);
      e.preventDefault();
    } else if (key === 'arrowdown') {
      selectedMenuIndex.value = Math.min(store.contextMenu.options.length - 1, selectedMenuIndex.value + 1);
      e.preventDefault();
    } else if (key === 'enter' || key === ' ') {
      const opt = store.contextMenu.options[selectedMenuIndex.value];
      if (opt) handleActionClick(opt);
      e.preventDefault();
    } else if (key === 'escape' || key === 'i') {
      store.contextMenu.visible = false;
      e.preventDefault();
    }
    return;
  }

  // Navigate Grid
  if (key === 'arrowright') {
    if (selectedIndex.value % 2 === 0) selectedIndex.value += 1;
    e.preventDefault();
  } else if (key === 'arrowleft') {
    if (selectedIndex.value % 2 !== 0) selectedIndex.value -= 1;
    e.preventDefault();
  } else if (key === 'arrowdown') {
    if (selectedIndex.value < 4) selectedIndex.value += 2;
    e.preventDefault();
  } else if (key === 'arrowup') {
    if (selectedIndex.value > 1) selectedIndex.value -= 2;
    e.preventDefault();
  } else if (key === 'enter' || key === ' ') {
    onSlotClick(selectedIndex.value);
    selectedMenuIndex.value = 0; // Reset menu selection
    e.preventDefault();
  }
}

watch(() => store.isInventoryVisible, (val) => {
  if (val) {
    selectedIndex.value = 0;
    selectedMenuIndex.value = 0;
  }
});

watch(() => store.isPickupMode, (val) => {
  if (val) {
    selectedPickupIndex.value = 0; // Focus "Yes" by default
  }
});

watch(() => store.discardItemIndex, (val) => {
  if (val !== null) {
    selectedPickupIndex.value = 0; // Focus "Yes" by default
  }
});

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

// Pickup Mode Handlers
function onYes() {
  console.log("InventoryScreen.vue: dispatching pickup-yes");
  document.dispatchEvent(new CustomEvent('pickup-yes'));
}

function onNo() {
  console.log("InventoryScreen.vue: dispatching pickup-no");
  document.dispatchEvent(new CustomEvent('pickup-no'));
}

function onDiscardYes() {
  document.dispatchEvent(new CustomEvent('discard-yes'));
}

function onDiscardNo() {
  document.dispatchEvent(new CustomEvent('discard-no'));
}

function onExitClick() {
  store.examineText = '';
  store.combineSourceIndex = null;
  store.isInventoryVisible = false;
  document.dispatchEvent(new CustomEvent('inventory-close'));
}
</script>

<style scoped>
.slot-selected {
  outline: 2px solid #bc9c6a;
  box-shadow: inset 0 0 15px rgba(188, 156, 106, 0.4);
}

.action-btn-selected {
  background: rgba(188, 156, 106, 0.3) !important;
  border-color: #bc9c6a !important;
  color: #fff !important;
}

.btn-selected {
  background: rgba(188, 156, 106, 0.3) !important;
  border-color: #bc9c6a !important;
  box-shadow: 0 0 10px rgba(188, 156, 106, 0.4);
}
</style>
