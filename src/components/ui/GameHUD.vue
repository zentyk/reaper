<template>
  <div class="hud hud--visible">
    <div v-show="store.showDebugMenu">
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
    </div>
  </div>
</template>

<script setup>
import { store } from '../../store.js'
import ProgressBar from 'primevue/progressbar'
import Badge from 'primevue/badge'
</script>
