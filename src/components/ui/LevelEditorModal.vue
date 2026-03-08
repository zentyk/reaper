<template>
  <div class="editor-overlay" @mousedown.stop @contextmenu.prevent>
    <!-- Left sidebar: tools + inspector -->
    <div class="editor-sidebar left">
      <div class="editor-title">⚙ LEVEL EDITOR</div>

      <!-- Level selector -->
      <div class="editor-section">
        <div class="editor-label">LEVEL</div>
        <div class="editor-btn-row">
          <select 
            class="ed-select" 
            :value="store.editorLevel" 
            @change="switchLevel(+$event.target.value)">
            <option v-for="n in 10" :key="n" :value="n">Level {{ n }}</option>
          </select>
        </div>
      </div>

      <!-- Tools -->
      <div class="editor-section">
        <div class="editor-label">TOOLS</div>
        <button
          v-for="t in tools" :key="t.key"
          :class="['ed-btn tool-btn', store.editorTool === t.key ? 'active' : '']"
          @click="store.editorTool = t.key">
          <span class="tool-icon">{{ t.icon }}</span> {{ t.label }}
        </button>
        <div class="editor-hint">Click viewport to place</div>
      </div>

      <!-- Inspector -->
      <div class="editor-section" v-if="selected">
        <div class="editor-label">INSPECTOR — {{ selected.type.toUpperCase() }}</div>
        
        <div class="editor-btn-row" style="margin-bottom: 10px;">
          <button class="ed-btn" @click="setGizmoMode('translate')">⬌ Move</button>
          <button class="ed-btn" @click="setGizmoMode('rotate')">⭘ Rot</button>
          <button class="ed-btn" @click="setGizmoMode('scale')">⤡ Scale</button>
        </div>
        <div class="inspector-field" v-for="field in editableFields" :key="field.key">
          <label>{{ field.label }}</label>
          <input type="number" step="0.1"
            :value="getField(field.key)"
            @change="setField(field.key, $event.target.value)" />
        </div>
        <!-- Collectible extras -->
        <template v-if="selected.type === 'collectible'">
          <div class="inspector-field">
            <label>Type</label>
            <select :value="selectedData.type" @change="updateDataField('type', $event.target.value)">
              <option v-for="ct in ['ammo','health','key']" :key="ct" :value="ct">{{ ct }}</option>
            </select>
          </div>
          <div class="inspector-field">
            <label>Name</label>
            <input type="text" :value="selectedData.name" @change="updateDataField('name', $event.target.value)" />
          </div>
          <div class="inspector-field">
            <label>Amount</label>
            <input type="number" :value="selectedData.amount" @change="updateDataField('amount', +$event.target.value)" />
          </div>
        </template>
        <!-- Camera extras -->
        <template v-if="selected.type === 'camera'">
          <div class="editor-label" style="margin-top:8px">LOOK AT</div>
          <div class="inspector-field" v-for="(ax, i) in ['X','Y','Z']" :key="'la'+ax">
            <label>{{ ax }}</label>
            <input type="number" step="0.1" :value="selectedData.lookAt[i]"
              @change="updateLookAt(i, +$event.target.value)" />
          </div>
          <div class="editor-label" style="margin-top:8px">BOUNDS</div>
          <div class="inspector-field" v-for="bk in ['minX','maxX','minZ','maxZ']" :key="bk">
            <label>{{ bk }}</label>
            <input type="number" step="1" :value="selectedData.bounds[bk]"
              @change="updateBound(bk, +$event.target.value)" />
          </div>
        </template>
        <!-- Light extras -->
        <template v-if="selected.type === 'light'">
          <div class="inspector-field">
            <label>Color (Hex)</label>
            <!-- Show hex format for easier editing, convert string to number on save -->
            <input type="text" :value="'#' + selectedData.color.toString(16).padStart(6, '0')"
              @input="handleLightColorChange($event.target.value)" />
          </div>
          <div class="inspector-field">
            <label>Intensity</label>
            <input type="number" step="0.5" :value="selectedData.intensity"
              @change="updateDataField('intensity', +$event.target.value); applyLightUpdate()" />
          </div>
          <div class="inspector-field">
            <label>Distance</label>
            <input type="number" step="1" :value="selectedData.distance"
              @change="updateDataField('distance', +$event.target.value); applyLightUpdate()" />
          </div>
        </template>
        <button class="ed-btn delete-btn" @click="deleteSelected">🗑 DELETE</button>
      </div>
    </div>

    <!-- Right sidebar: object list -->
    <div class="editor-sidebar right">
      <div class="editor-title">OBJECTS</div>
      <div class="obj-list">
        <div
          v-for="obj in allObjects" :key="obj.id"
          :class="['obj-item', selected && selected.id === obj.id ? 'selected' : '']"
          @click="selectById(obj.id)">
          <span class="obj-type-dot" :style="{ background: typeColor(obj.type) }"></span>
          <span class="obj-label">{{ obj.type }} · {{ obj.id }}</span>
          <span class="obj-pos">{{ formatPos(obj) }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="editor-actions">
        <button class="ed-btn action-btn" @click="exportJSON">📥 Export JSON</button>
        <button class="ed-btn action-btn" @click="saveToDisk">💾 Save to Disk</button>
        <button class="ed-btn action-btn" @click="reloadLevel">🔄 Reload Level</button>
      </div>
    </div>

    <!-- Camera Preview Frame (WebGL draws underneath this) -->
    <div class="camera-preview-container" v-if="selected?.type === 'camera'">
      <div class="camera-preview-title">Camera Preview</div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue';
import { store } from '../../store.js';

// ─── Tools ───────────────────────────────────────────────────────────
const tools = [
  { key: 'select',      icon: '↖', label: 'Select' },
  { key: 'camera',      icon: '📷', label: 'Camera' },
  { key: 'playerSpawn', icon: '🟢', label: 'Player Spawn' },
  { key: 'zombie',      icon: '💀', label: 'Zombie' },
  { key: 'collectible', icon: '📦', label: 'Collectible' },
  { key: 'light',       icon: '💡', label: 'Light' },
];

// ─── Reactive level data from store (set by App.vue on F4 open) ───────
const d = computed(() => store.editorLevelData);

// ─── Object list (fully reactive via store) ───────────────────────────
const allObjects = computed(() => {
  const data = d.value;
  if (!data) return [];
  const list = [];

  if (data.playerSpawn) {
    list.push({ id: 'playerSpawn', type: 'playerSpawn', pos: [data.playerSpawn.x, data.playerSpawn.y, data.playerSpawn.z] });
  }
  (data.cameras || []).forEach(c => list.push({ id: c.id, type: 'camera', data: c, pos: c.pos }));
  (data.zombies || []).forEach(z => list.push({ id: z.id, type: 'zombie', data: z, pos: z.pos }));
  (data.collectibles || []).forEach(it => list.push({ id: it.id, type: 'collectible', data: it, pos: it.pos }));
  (data.lights || []).forEach(l => list.push({ id: l.id, type: 'light', data: l, pos: l.pos }));

  return list;
});

// ─── Selection ────────────────────────────────────────────────────────
const selected = computed(() => {
  const id = store.editorSelectedId;
  if (!id) return null;
  return allObjects.value.find(o => o.id === id) || null;
});

const selectedData = computed(() => selected.value?.data || null);

function selectById(id) {
  store.editorSelectedId = id;
  window.game?.editorGizmos?.setSelected(id);
}

function setGizmoMode(mode) {
  if (window.game && window.game.transformControl) {
    window.game.transformControl.setMode(mode);
  }
}

watch(() => store.editorSelectedId, id => {
  window.game?.editorGizmos?.setSelected(id || null);
});

// ─── Position fields ──────────────────────────────────────────────────
const editableFields = computed(() => {
  if (!selected.value) return [];
  const fields = [
    { key: 'px', label: 'Pos X' }, { key: 'py', label: 'Pos Y' }, { key: 'pz', label: 'Pos Z' },
    { key: 'rx', label: 'Rot X' }, { key: 'ry', label: 'Rot Y' }, { key: 'rz', label: 'Rot Z' }
  ];
  return fields;
});

function getField(key) {
  const sel = selected.value;
  if (!sel) return 0;
  
  let pos = sel.pos || [0,0,0];
  let rot = sel.rot || [0,0,0];

  if (sel.type === 'playerSpawn') {
    const sp = d.value?.playerSpawn;
    pos = [sp?.x || 0, sp?.y || 0, sp?.z || 0];
    rot = sp?.rot || [0,0,0];
  }

  const map = { px: pos[0], py: pos[1], pz: pos[2], rx: rot[0], ry: rot[1], rz: rot[2] };
  return map[key] ?? 0;
}

function setField(key, value) {
  const v = parseFloat(value);
  const data = d.value;
  const sel = selected.value;
  if (!data || !sel) return;

  const isRot = key.startsWith('r');
  const axisIdx = key.endsWith('x') ? 0 : key.endsWith('y') ? 1 : 2;

  if (sel.type === 'playerSpawn') {
    if (isRot) {
      if (!data.playerSpawn.rot) data.playerSpawn.rot = [0,0,0];
      data.playerSpawn.rot[axisIdx] = v;
      // We don't have a specific gizmo rotate by ID function easily accessible 
      // without directly digging into Game, but dragging the gizmo handles it anyway.
    } else {
      const keys = ['x', 'y', 'z'];
      data.playerSpawn[keys[axisIdx]] = v;
      window.game?.editorGizmos?.moveById('playerSpawn', data.playerSpawn.x, data.playerSpawn.y + 1, data.playerSpawn.z);
    }
    return;
  }

  if (isRot) {
    if (!sel.rot) sel.rot = [0,0,0];
    sel.rot[axisIdx] = v;
  } else {
    sel.pos[axisIdx] = v;
    window.game?.editorGizmos?.moveById(sel.id, sel.pos[0], sel.pos[1], sel.pos[2]);
  }
}

function updateDataField(key, value) {
  if (selectedData.value) selectedData.value[key] = value;
}
function updateLookAt(idx, value) {
  if (selectedData.value?.lookAt) selectedData.value.lookAt[idx] = value;
}
function updateBound(key, value) {
  if (selectedData.value?.bounds) selectedData.value.bounds[key] = value;
}
function handleLightColorChange(hexString) {
  const cleanHex = hexString.replace('#', '');
  if (cleanHex.length === 6) {
    const num = parseInt(cleanHex, 16);
    if (!isNaN(num)) {
      updateDataField('color', num);
      applyLightUpdate();
    }
  }
}
function applyLightUpdate() {
  const d = selectedData.value;
  if (!d) return;
  const light = window.game?.scene?.children?.find(c => c.isPointLight && c.userData.id === d.id);
  if (light) {
    light.color.setHex(d.color);
    light.intensity = d.intensity;
    light.distance = d.distance;
  }
}

// ─── Delete ───────────────────────────────────────────────────────────
function deleteSelected() {
  const sel = selected.value;
  if (!sel || sel.type === 'playerSpawn') return;
  const data = d.value;
  const listKey = { camera: 'cameras', zombie: 'zombies', collectible: 'collectibles', light: 'lights' }[sel.type];
  if (listKey) data[listKey] = data[listKey].filter(o => o.id !== sel.id);
  window.game?.editorGizmos?.removeById(sel.id);
  store.editorSelectedId = null;
}

// ─── Level switching ──────────────────────────────────────────────────
function switchLevel(n) {
  store.editorLevel = n;
  store.editorSelectedId = null;
  document.dispatchEvent(new CustomEvent('editor-load-level', { detail: { level: n } }));
  // After level reload, App.vue will re-sync store.editorLevelData via the
  // editor-load-level → loadLevel → game.currentLevelData update path.
  // Re-sync here after a tick to ensure data is ready.
  setTimeout(() => {
    store.editorLevelData = window.game?.currentLevelData || null;
    window.game?.editorGizmos?.sync(store.editorLevelData);
  }, 600);
}

// ─── Export / Save ────────────────────────────────────────────────────
function exportJSON() {
  const data = d.value;
  if (!data) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `level${store.editorLevel}.json`;
  a.click();
}

async function saveToDisk() {
  const data = d.value;
  if (!data) return;
  try {
    const resp = await fetch('/api/save-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: store.editorLevel, data })
    });
    alert(resp.ok ? `level${store.editorLevel}.json saved!` : 'Save failed: ' + resp.statusText);
  } catch (e) {
    alert('Save failed: ' + e.message);
  }
}

function reloadLevel() {
  document.dispatchEvent(new CustomEvent('editor-load-level', { detail: { level: store.editorLevel } }));
  setTimeout(() => {
    store.editorLevelData = window.game?.currentLevelData || null;
    window.game?.editorGizmos?.sync(store.editorLevelData);
  }, 600);
}

// ─── Helpers ──────────────────────────────────────────────────────────
function typeColor(type) {
  return { camera: '#ffdd00', playerSpawn: '#00cc44', zombie: '#ff2222', collectible: '#2288ff' }[type] || '#aaa';
}
function formatPos(obj) {
  const p = obj.pos;
  if (!p) return '';
  return `(${(+p[0]).toFixed(1)}, ${(+p[1]).toFixed(1)}, ${(+p[2]).toFixed(1)})`;
}
</script>

<style scoped>
.editor-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 800;
  display: flex;
  justify-content: space-between;
  font-family: 'Courier New', monospace;
}

.editor-sidebar {
  pointer-events: all;
  width: 240px;
  background: rgba(8, 10, 20, 0.92);
  border: 1px solid #1e3a5f;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 4px;
  overflow-y: auto;
  max-height: 100vh;
}

.editor-title {
  color: #5bcffa;
  font-size: 12px;
  font-weight: bold;
  letter-spacing: 2px;
  padding-bottom: 8px;
  border-bottom: 1px solid #1e3a5f;
  margin-bottom: 8px;
}

.editor-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 10px;
  border-bottom: 1px solid #1a2a3a;
  margin-bottom: 4px;
}

.editor-label {
  color: #4a80a0;
  font-size: 10px;
  letter-spacing: 1.5px;
  margin-top: 6px;
}

.editor-hint {
  color: #2a4a60;
  font-size: 9px;
  margin-top: 2px;
}

.ed-btn {
  background: #0d1f30;
  border: 1px solid #1e3a5f;
  color: #7ad4f5;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  padding: 5px 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}

.ed-btn:hover { background: #1a3a5a; border-color: #5bcffa; }
.ed-btn.active { background: #0e3256; border-color: #5bcffa; color: #fff; }

.ed-select {
  background: #0d1f30;
  border: 1px solid #1e3a5f;
  color: #7ad4f5;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  padding: 5px 8px;
  cursor: pointer;
  width: 100%;
  outline: none;
}
.ed-select:hover { border-color: #5bcffa; }
.ed-select option { background: #080a14; color: #7ad4f5; }

.editor-btn-row { display: flex; gap: 4px; }
.editor-btn-row .ed-btn { flex: 1; text-align: center; }

.tool-btn { display: flex; align-items: center; gap: 6px; }
.tool-icon { font-size: 13px; }

.delete-btn { color: #ff5555; border-color: #5a1515; margin-top: 8px; }
.delete-btn:hover { background: #3a1010; }

/* Inspector */
.inspector-field {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}
.inspector-field label {
  color: #4a80a0;
  font-size: 10px;
  min-width: 50px;
}
.inspector-field input,
.inspector-field select {
  background: #050d18;
  border: 1px solid #1e3a5f;
  color: #7ad4f5;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  padding: 2px 5px;
  flex: 1;
  width: 0;
}

/* Object list */
.obj-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.obj-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 2px;
  transition: background 0.1s;
}
.obj-item:hover { background: #0d2030; }
.obj-item.selected { background: #0e3256; border-color: #5bcffa; }
.obj-type-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.obj-label { color: #7ad4f5; font-size: 10px; flex: 1; }
.obj-pos { color: #2a5a7a; font-size: 9px; }

/* Actions */
.editor-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid #1a2a3a;
  margin-top: 4px;
}
.action-btn { text-align: center; font-size: 11px; }

/* Camera Preview */
.camera-preview-container {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 320px;
  height: 180px;
  pointer-events: none;
  border: 1px solid #1e3a5f;
  background: transparent;
  box-shadow: 0 0 15px rgba(0,0,0,0.8);
}
.camera-preview-title {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  background: rgba(14, 50, 86, 0.9);
  color: #7ad4f5;
  font-family: 'Courier New', monospace;
  font-size: 10px;
  padding: 3px 6px;
  border-bottom: 1px solid #1e3a5f;
  box-sizing: border-box;
}
</style>
