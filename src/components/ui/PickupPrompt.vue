<template>
  <div class="pickup-prompt pickup-prompt--visible">
    <div class="pickup-prompt__text">Pick up {{ store.pickupPrompt.text }}?</div>
    <div class="pickup-prompt__options">
      <button class="pickup-prompt__button" @click="onYes">Yes</button>
      <button class="pickup-prompt__button" @click="onNo">No</button>
    </div>
  </div>
</template>

<script setup>
import { store } from '../../store.js'

function onYes() {
  document.dispatchEvent(new CustomEvent('pickup-yes'));
}

function onNo() {
  document.dispatchEvent(new CustomEvent('pickup-no'));
}
</script>
