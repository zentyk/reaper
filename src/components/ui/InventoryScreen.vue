<template>
  <Dialog v-model:visible="store.isInventoryVisible" header="INVENTORY" :modal="true" :closable="false" :style="{ width: '50vw' }">
    <div v-if="store.combineSourceIndex !== null" style="color: var(--p-primary-color); margin-bottom: 1rem; text-align: center; font-weight: bold;">
      Select item to combine with...
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
      <Card 
        v-for="(item, index) in store.inventory" 
        :key="index"
        style="cursor: pointer; text-align: center; height: 120px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;"
        :style="{ 
          border: store.combineSourceIndex === index ? '2px solid var(--p-primary-color)' : item && item.equipped ? '2px solid var(--p-green-500)' : '2px solid transparent',
          backgroundColor: item ? 'var(--p-surface-800)' : 'var(--p-surface-900)'
        }"
        @click="onSlotClick(index, $event)"
      >
        <template #content>
          <div v-if="item" style="font-weight: bold;">
            {{ item.name }}
            <br v-if="item.count !== undefined">
            <Badge v-if="item.count !== undefined" :value="'x' + item.count" severity="info" style="margin-top: 0.5rem;"></Badge>
          </div>
          <div v-else style="color: var(--p-text-muted-color);">Empty</div>
        </template>
      </Card>
    </div>

    <template #footer>
      <div style="text-align: center; width: 100%; color: var(--p-text-muted-color);">Press [I] to close</div>
    </template>
  </Dialog>
</template>

<script setup>
import { store } from '../../store.js'
import Dialog from 'primevue/dialog'
import Card from 'primevue/card'
import Badge from 'primevue/badge'

function onSlotClick(index, event) {
  if (store.inventory[index] || store.combineSourceIndex !== null) {
      document.dispatchEvent(new CustomEvent('slot-click', { 
        detail: { index, x: event.clientX, y: event.clientY }
      }));
  }
}
</script>
