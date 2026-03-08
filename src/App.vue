<template>
  <div>
    <!-- The Game UI Overlays go here, Game engine adds canvas to body directly -->
    <StartScreen v-show="store.isStartScreenVisible" />
    <GameOverScreen v-show="store.isGameOverVisible" />
    <div id="fadeOverlay" class="fade-overlay"></div>
    <div id="levelText" class="level-text">{{ store.levelText }}</div>
    
    <InventoryScreen />
    <GameHUD v-show="!store.isStartScreenVisible && !store.isGameOverVisible" />
    <DebugMenuModal />
    <LevelEditorModal v-if="store.showLevelEditor" />
    
    <div v-show="store.feedbackMessage" class="feedback-message">
      {{ store.feedbackMessage }}
    </div>
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import * as THREE from 'three'
import { store } from './store.js'

// Vue Components
import StartScreen from './components/ui/StartScreen.vue'
import GameOverScreen from './components/ui/GameOverScreen.vue'
import GameHUD from './components/ui/GameHUD.vue'
import InventoryScreen from './components/ui/InventoryScreen.vue'
import DebugMenuModal from './components/ui/DebugMenuModal.vue'
import LevelEditorModal from './components/ui/LevelEditorModal.vue'

// Import the legacy vanilla Game entrypoint
import { Game } from '../js/Game.js'

onMounted(async () => {
    // Keep window.game for global debug access
    window.game = await Game.init();

    // Toggle global cursor visibility based on Editor mode
    watch(() => store.showLevelEditor, (isEditor) => {
        document.body.style.cursor = isEditor ? 'default' : 'none';
    }, { immediate: true });

    // ── F3 → Debug Menu ──────────────────────────────────────────────
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        store.showDebugMenu = !store.showDebugMenu;
      }

      // ── F4 → Level Editor ─────────────────────────────────────────
      if (e.key === 'F4') {
        e.preventDefault();
        store.showLevelEditor = !store.showLevelEditor;
        if (window.game) {
          window.game.isPaused = store.showLevelEditor;
          if (store.showLevelEditor) {
            store.editorLevel = window.game.currentLevelIndex || 1;
            store.editorSelectedId = null;
            // Mirror level data into reactive store so Vue can track it
            store.editorLevelData = window.game.currentLevelData;
            window.game.editorGizmos?.sync(window.game.currentLevelData);
          } else {
            store.editorLevelData = null;
            window.game.editorGizmos?.clear();
          }
        }
      }
    });

    // ── Canvas click → editor placement / selection ───────────────────
    window.addEventListener('click', (e) => {
      if (!store.showLevelEditor) return;
      const game = window.game;
      if (!game) return;

      // Build NDC mouse coords
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      const ndcY = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

      const mouse  = new THREE.Vector2(ndcX, ndcY);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, game.activeCamera);

      // 1 ─ Try to select an existing gizmo
      const hitId = game.editorGizmos?.raycast(raycaster);
      if (hitId) {
        store.editorSelectedId = hitId;
        return;
      }

      // 2 ─ In select mode, do nothing else
      if (store.editorTool === 'select') return;

      // 3 ─ Raycast against y=0 floor plane
      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const target = new THREE.Vector3();
      raycaster.ray.intersectPlane(floorPlane, target);
      if (!target) return;

      // Place the object
      placeObject(store.editorTool, target, game);
    });
});

// ── Placement helper ────────────────────────────────────────────────
function placeObject(tool, pos, game) {
  const d = game.currentLevelData;
  if (!d) return;

  const x = parseFloat(pos.x.toFixed(2));
  const z = parseFloat(pos.z.toFixed(2));
  const uid = `${tool}_${Date.now()}`;

  if (tool === 'playerSpawn') {
    d.playerSpawn = { x, y: 0, z };
    game.editorGizmos?.moveById('playerSpawn', x, 1, z);
  } else if (tool === 'camera') {
    const newCam = { id: uid, pos: [x, 10, z], lookAt: [0, 0, 0], bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 } };
    d.cameras.push(newCam);
    game.editorGizmos?.addGizmo('camera', uid, x, 10, z);

    // ── Inject live camera for PiP preview
    const cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    cam.userData.id = uid;
    cam.position.set(x, 10, z);
    cam.lookAt(0, 0, 0); // Default look-at
    if (!game.cameras[game.currentLevelIndex]) game.cameras[game.currentLevelIndex] = [];
    game.cameras[game.currentLevelIndex].push({
        camera: cam, pos: newCam.pos, lookAt: newCam.lookAt, bounds: newCam.bounds
    });
  } else if (tool === 'zombie') {
    d.zombies.push({ id: uid, pos: [x, 0, z] });
    game.editorGizmos?.addGizmo('zombie', uid, x, 0.5, z);
  } else if (tool === 'collectible') {
    d.collectibles.push({ id: uid, type: 'ammo', amount: 15, name: 'Handgun Ammo', pos: [x, 0.15, z] });
    game.editorGizmos?.addGizmo('collectible', uid, x, 0.45, z);
  }

  store.editorSelectedId = uid;
}
</script>
