<template>
  <div 
    class="context-menu context-menu--visible"
    :style="{ left: store.contextMenu.x + 'px', top: store.contextMenu.y + 'px' }"
  >
    <div 
      v-for="(option, index) in store.contextMenu.options" 
      :key="index"
      class="context-menu__option"
      :class="{'context-menu__option--disabled': !option.enabled}"
      @click="onOptionClick(option)"
    >
      {{ option.label }}
    </div>
  </div>
</template>

<script setup>
import { store } from '../../store.js'

function onOptionClick(option) {
  if (option.enabled) {
    if (typeof option.action === 'function') {
      option.action();
    }
    store.contextMenu.visible = false;
  }
}
</script>
