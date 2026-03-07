<template>
  <div class="hud hud--visible">
    <div class="hud-display" id="healthContainer">
      <span>HEALTH</span>
      <div style="width: 200px; margin-left: 10px;">
        <ProgressBar :value="store.healthPercent" :showValue="false" :style="{ height: '20px' }" 
          :pt="{ value: { style: { backgroundColor: store.healthPercent <= 25 ? 'var(--p-red-500)' : store.healthPercent <= 50 ? 'var(--p-yellow-500)' : 'var(--p-green-500)' } } }" />
      </div>
    </div>
    
    <div class="hud-display" id="ammoContainer">
      <span>AMMO</span>
      <Badge :value="store.ammoCurrent + ' / ' + store.ammoMax" severity="secondary" size="xlarge" style="margin-left: 10px;"></Badge>
    </div>
    
    <div class="hud__cheats" style="pointer-events: auto; margin-top: 10px; display: flex; flex-direction: column; gap: 0.5rem; width: 250px;">
      <Button label="Infinite Health: OFF" severity="secondary" size="small" @click="toggleCheat" />
      <ToggleButton v-model="store.showColliders" onLabel="Show Colliders: ON" offLabel="Show Colliders: OFF" 
        @change="toggleColliderCheat" size="small" />
    </div>
  </div>
</template>

<script setup>
import { store } from '../../store.js'
import ProgressBar from 'primevue/progressbar'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import ToggleButton from 'primevue/togglebutton'

function toggleCheat() {
  document.dispatchEvent(new CustomEvent('cheat-toggle', { bubbles: true }));
}

function toggleColliderCheat() {
  document.dispatchEvent(new CustomEvent('collider-cheat-toggle', { bubbles: true }));
}
</script>
