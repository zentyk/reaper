<template>
  <div class="hud hud--visible">
    <div class="hud-display" id="healthContainer">
      <span>HEALTH</span>
      <div class="hud-display__bar">
        <div class="hud-display__value" 
             :class="{
               'hud-display__value--warning': store.healthPercent <= 50 && store.healthPercent > 25,
               'hud-display__value--critical': store.healthPercent <= 25
             }"
             :style="{ width: store.healthPercent + '%' }">
        </div>
      </div>
    </div>
    
    <div class="hud-display" id="ammoContainer">
      <span>AMMO</span>
      <div class="hud-display__text">{{ store.ammoCurrent }} / {{ store.ammoMax }}</div>
    </div>
    
    <div class="hud__cheats">
      <button class="hud__cheat-btn" @click="toggleCheat">Infinite Health: OFF</button>
      <button class="hud__cheat-btn" :class="{'hud__cheat-btn--active': store.showColliders}" @click="toggleColliderCheat">
        Show Colliders: {{ store.showColliders ? 'ON' : 'OFF' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { store } from '../../store.js'

function toggleCheat() {
  document.dispatchEvent(new CustomEvent('cheat-toggle', { bubbles: true }));
}

function toggleColliderCheat() {
  document.dispatchEvent(new CustomEvent('collider-cheat-toggle', { bubbles: true }));
}
</script>
