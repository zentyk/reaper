<template>
  <div class="start-screen">
    <h1 class="start-screen__title">REAPER</h1>

    <div class="difficulty-selector">
      <div class="difficulty-label">DIFFICULTY</div>
      <div class="difficulty-options">
        <button
          :class="['diff-btn', store.difficulty === 'normal' ? 'selected normal' : '']"
          @click="store.difficulty = 'normal'">
          <span class="diff-name">NORMAL</span>
          <span class="diff-desc">Standard challenge</span>
        </button>
        <button
          :class="['diff-btn', store.difficulty === 'hard' ? 'selected hard' : '']"
          @click="store.difficulty = 'hard'">
          <span class="diff-name">HARD</span>
          <span class="diff-desc">2× zombie HP · 2× bite damage</span>
        </button>
      </div>
    </div>

    <Button label="Start Game" size="large" severity="danger" @click="startGame" />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { store } from '../../store.js'
import Button from 'primevue/button'

function startGame() {
  store.isStartScreenVisible = false;
  document.dispatchEvent(new CustomEvent('start-game'));
}

function handleKeyDown(e) {
  if (!store.isStartScreenVisible) return;

  const key = e.key.toLowerCase();
  if (key === 'arrowleft') {
    store.difficulty = 'normal';
  } else if (key === 'arrowright') {
    store.difficulty = 'hard';
  } else if (key === 'enter' || key === ' ') {
    startGame();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.start-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
}

/* Difficulty selector */
.difficulty-selector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.difficulty-label {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  letter-spacing: 3px;
  color: #666;
}

.difficulty-options {
  display: flex;
  gap: 12px;
}

.diff-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 24px;
  background: rgba(255,255,255,0.04);
  border: 1px solid #333;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 140px;
}

.diff-btn:hover {
  background: rgba(255,255,255,0.08);
  border-color: #555;
}

.diff-btn.selected.normal {
  background: rgba(50, 200, 80, 0.12);
  border-color: #32c850;
  box-shadow: 0 0 12px rgba(50, 200, 80, 0.25);
}

.diff-btn.selected.hard {
  background: rgba(220, 40, 40, 0.12);
  border-color: #dc2828;
  box-shadow: 0 0 12px rgba(220, 40, 40, 0.3);
}

.diff-name {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  font-weight: bold;
  letter-spacing: 2px;
  color: #eee;
}

.diff-btn.selected.normal .diff-name { color: #32c850; }
.diff-btn.selected.hard   .diff-name { color: #dc2828; }

.diff-desc {
  font-family: 'Courier New', monospace;
  font-size: 9px;
  color: #555;
  letter-spacing: 0.5px;
}

.diff-btn.selected .diff-desc { color: #888; }
</style>
