<template>
  <Dialog v-model:visible="store.isPickupPromptVisible" header="Pick up item?" :modal="false" :closable="false" position="bottom" :style="{ width: '300px' }">
    <p class="m-0" style="text-align: center; font-size: 1.2rem; margin-bottom: 20px;">Pick up {{ store.pickupPrompt.text }}?</p>
    <template #footer>
      <div style="display: flex; justify-content: space-around; width: 100%;">
        <Button label="Yes" icon="pi pi-check" @click="onYes" severity="success" />
        <Button label="No" icon="pi pi-times" @click="onNo" severity="secondary" autofocus />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { store } from '../../store.js'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

function onYes() {
  document.dispatchEvent(new CustomEvent('pickup-yes'));
}

function onNo() {
  document.dispatchEvent(new CustomEvent('pickup-no'));
}
</script>
