<template>
  <Menu 
    v-if="store.contextMenu.visible"
    :model="menuItems"
    class="context-menu--prime"
    :style="{ position: 'absolute', left: store.contextMenu.x + 'px', top: store.contextMenu.y + 'px', zIndex: 2000 }"
  />
</template>

<script setup>
import { store } from '../../store.js'
import Menu from 'primevue/menu'
import { computed } from 'vue'

const menuItems = computed(() => {
  return store.contextMenu.options.map(opt => ({
    label: opt.label,
    disabled: !opt.enabled,
    command: () => {
      if (opt.enabled && typeof opt.action === 'function') {
        opt.action();
      }
      store.contextMenu.visible = false;
    }
  }));
});
</script>
