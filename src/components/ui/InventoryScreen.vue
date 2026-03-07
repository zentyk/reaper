<template>
  <div class="inventory-screen inventory-screen--visible">
    <div class="inventory-screen__title">INVENTORY</div>
    <div v-if="store.combineSourceIndex !== null" class="inventory-screen__instruction">
      Select item to combine with...
    </div>
    
    <div class="inventory-grid">
      <div 
        v-for="(item, index) in store.inventory" 
        :key="index"
        class="inventory-slot"
        :class="{
          'inventory-slot--item': item !== null,
          'inventory-slot--equipped': item && item.equipped,
          'inventory-slot--combining': store.combineSourceIndex === index
        }"
        @click="onSlotClick(index, $event)"
      >
        <span v-if="item">
          {{ item.name }}
          <br v-if="item.count !== undefined">
          <span v-if="item.count !== undefined">x{{ item.count }}</span>
        </span>
      </div>
    </div>
    
    <div class="inventory-screen__close-hint">Press [I] to close</div>
  </div>
</template>

<script setup>
import { store } from '../../store.js'

function onSlotClick(index, event) {
  if (store.inventory[index] || store.combineSourceIndex !== null) {
      document.dispatchEvent(new CustomEvent('slot-click', { 
        detail: { index, x: event.clientX, y: event.clientY }
      }));
  }
}
</script>
