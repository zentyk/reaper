import * as THREE from 'three';
import { World } from './ecs/World.js';
import { InputSystem } from './systems/InputSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { AISystem } from './systems/AISystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { UIManager } from './UIManager.js';
import { GameState } from './managers/GameState.js';
import { LevelManager } from './LevelManager.js';
import { Input } from './core/Input.js';
import { AudioHandler } from './AudioHandler.js';
import { Player } from './Player.js';
import { EditorGizmos } from './EditorGizmos.js';
import RAPIER from '@dimforge/rapier3d-compat';
import doorTextureUrl from '../img/door_texture.png?url';
import { store } from '../src/store.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Game {
    static async init() {
        await RAPIER.init();
        return new Game();
    }

    constructor() {
        this.store = store;
        // --- Core Systems ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 1);
        document.body.appendChild(this.renderer.domElement);

        // --- Physics ---
        const gravity = { x: 0.0, y: -9.81, z: 0.0 };
        this.physicsWorld = new RAPIER.World(gravity);

        // --- Cameras ---
        this.cameras = {
            north: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
            south: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
            corner: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
            main: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
            cutscene: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
        };
        this.activeCamera = null;

        // --- Legacy Arrays ---
        this.zombies = [];
        this.obstacles = [];
        this.interactables = [];

        // --- Managers ---
        this.world = new World();
        this.ui = new UIManager();
        this.audio = new AudioHandler();
        this.gameState = new GameState();
        this.levelManager = new LevelManager(this);
        this.input = new Input();

        // --- Level Editor Core ---
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // --- Player Controller ---
        this.player = new Player(this.scene, this);

        // --- Game State ---
        this.isPaused = true;
        this.showColliders = false;
        this.isTransitioning = false;

        // --- Transition Scene ---
        this.transitionScene = new THREE.Scene();
        this.transitionCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.transitionCamera.position.z = 2.5;
        this.doorMesh = null;
        this.doorPivot = null;

        // --- Systems ---
        this.world.addSystem(new InputSystem());
        this.world.addSystem(new MovementSystem());
        this.world.addSystem(new AISystem(this.levelManager.pathfinder));
        this.world.addSystem(new CombatSystem(this));
        this.world.addSystem(new InteractionSystem(this));

        // --- Setup ---
        this._bindUICallbacks();

        // Start Loop
        this.lastTime = 0;
        this.animate = this.animate.bind(this);
        this.animate(0);

        this._setupTransitionScene();

        // --- Level Editor ---
        this.editorGizmos = new EditorGizmos(this.scene);
        this.currentLevelData = null;
        this.currentLevelIndex = 1;

        // editor-load-level: triggered from the level editor UI
        document.addEventListener('editor-load-level', (e) => {
            const lvl = e.detail?.level;
            if (lvl) this.loadLevel(lvl);
        });

        // Transform Controls (Unity/UE5 Style Gizmos)
        this.editorCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.editorCamera.position.set(0, 15, 15);
        this.editorCamera.lookAt(0, 0, 0);

        this.orbitControls = new OrbitControls(this.editorCamera, this.renderer.domElement);
        this.orbitControls.enabled = false; // Disabled by default until editor opens

        this.transformControl = new TransformControls(this.editorCamera, this.renderer.domElement);
        this.isGizmoDragging = false;

        this.transformControl.addEventListener('dragging-changed', (event) => {
            this.isGizmoDragging = event.value;
            // Disable orbit controls while dragging gizmo so we don't accidentally rotate the camera
            this.orbitControls.enabled = !event.value;
        });

        this.transformControl.addEventListener('change', () => {
            if (!this.transformControl.object) return;

            const mesh = this.transformControl.object;

            // Sync the red selection ring position with the mesh
            if (this.editorGizmos && this.editorGizmos._ringMesh) {
                this.editorGizmos._ringMesh.position.copy(mesh.position);
            }

            // Update Vue Store when dragging ends or during drag
            if (this.isGizmoDragging && this.currentLevelData) {
                const type = mesh.userData.editorType;
                const id = mesh.userData.editorId;
                const pos = mesh.position;

                const syncItem = (list, yOffset = 0) => {
                    if (!list) return;
                    const it = list.find(i => i.id === id);
                    if (it && it.pos) {
                        it.pos[0] = pos.x;
                        it.pos[1] = pos.y - yOffset;
                        it.pos[2] = pos.z;
                    }
                };

                if (type === 'playerSpawn') {
                    this.currentLevelData.playerSpawn.x = pos.x;
                    this.currentLevelData.playerSpawn.y = pos.y - 1.0;
                    this.currentLevelData.playerSpawn.z = pos.z;
                } else if (type === 'camera') {
                    syncItem(this.currentLevelData.cameras, 0);
                    if (this.cameras && this.cameras[this.currentLevelIndex]) {
                        const camObj = this.cameras[this.currentLevelIndex].find(c => c.camera.userData.id === id);
                        if (camObj) {
                            camObj.camera.position.set(pos.x, pos.y, pos.z);
                            camObj.pos = [pos.x, pos.y, pos.z];
                            if (mesh.rotation) camObj.camera.rotation.copy(mesh.rotation);
                        }
                    }
                } else if (type === 'light') {
                    syncItem(this.currentLevelData.lights, 0);
                    const light = this.scene.children.find(c => c.isPointLight && c.userData.id === id);
                    if (light) {
                        light.position.copy(pos);
                    }
                } else if (type === 'zombie') {
                    syncItem(this.currentLevelData.zombies, 0.5);
                } else if (type === 'collectible') {
                    syncItem(this.currentLevelData.collectibles, 0.3);
                }

                // Sync the actual game ECS entity in realtime so the visual model moves
                let entity = this.world.entities.find(e => e.persistentId === id);
                if (!entity && id === 'playerSpawn') {
                    entity = this.playerEntity;
                }

                if (entity) {
                    const transform = entity.components.Transform;
                    if (transform) {
                        // Keep the entity's Y offset based on type
                        const yOffset = type === 'zombie' ? 0.5 : (type === 'collectible' ? 0.3 : 0);
                        transform.position.set(pos.x, pos.y - yOffset, pos.z);
                        if (entity.rigidBody) {
                            entity.rigidBody.setTranslation({ x: pos.x, y: pos.y - yOffset, z: pos.z }, true);
                        }

                        // For rotations
                        if (mesh.rotation) {
                            transform.rotation.copy(mesh.rotation);
                        }

                        // Immediately sync the visual mesh component instead of waiting for physics step
                        const meshComp = entity.components.MeshComponent;
                        if (meshComp && meshComp.mesh) {
                            meshComp.mesh.position.copy(transform.position);
                            meshComp.mesh.rotation.copy(transform.rotation);
                            meshComp.mesh.scale.copy(mesh.scale);
                        }
                    }
                }

                // Update specific selected pos in store for UI reactivity
                store.editorLevelData = { ...this.currentLevelData };
            }
        });

        this.scene.add(this.transformControl);

        // Editor Viewport Interaction
        window.addEventListener('pointerdown', (e) => this._onEditorClick(e));

        // Editor Hotkeys (W, E, R for Translate, Rotate, Scale)
        window.addEventListener('keydown', (e) => {
            if (!store.showLevelEditor) return;
            switch (e.key.toLowerCase()) {
                case 'w': this.transformControl.setMode('translate'); break;
                case 'e': this.transformControl.setMode('rotate'); break;
                case 'r': this.transformControl.setMode('scale'); break;
                case 'u': // Also allow 'T' or 'U' if desired, but W/E/R is standard Unity/UE
                    break;
            }
        });
    }

    toggleColliderVisuals(show) {
        if (!this.colliderHelpers) this.colliderHelpers = [];

        if (show) {
            this.world.entities.forEach(entity => {
                const collider = entity.components.Collider;
                const transform = entity.components.Transform;

                if (collider && transform) {
                    let boxHelper;

                    if (entity.components.MeshComponent && entity.components.MeshComponent.mesh) {
                        const mesh = entity.components.MeshComponent.mesh;
                        boxHelper = new THREE.BoxHelper(mesh, 0xff00ff);

                        // Fix for meshes that don't have bounding boxes computed
                        mesh.traverse((child) => {
                            if (child.isMesh && child.geometry && !child.geometry.boundingBox) {
                                child.geometry.computeBoundingBox();
                            }
                        });
                    } else {
                        // Fallback for logical coliders without meshes (like triggers/doors)
                        const boxGeometry = new THREE.BoxGeometry(collider.radius * 2, 2, collider.radius * 2);
                        const edges = new THREE.EdgesGeometry(boxGeometry);
                        boxHelper = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00ffff }));
                        boxHelper.position.copy(transform.position);
                        boxHelper.position.y += 1; // Center vertical
                    }

                    this.scene.add(boxHelper);
                    this.colliderHelpers.push({ helper: boxHelper, entity: entity });
                }
            });
        } else {
            this.colliderHelpers.forEach(item => {
                this.scene.remove(item.helper);
                if (item.helper.geometry) item.helper.geometry.dispose();
                if (item.helper.material) item.helper.material.dispose();
            });
            this.colliderHelpers = [];
        }
    }

    _bindUICallbacks() {
        this.ui.callbacks.onStart = () => this.startGame();
    }

    _onEditorClick(event) {
        if (!store.showLevelEditor) return;
        if (this.isGizmoDragging) return; // Prevent raycasting if currently using the transform gizmo

        // Ignore clicks on UI elements (which should prevent propagation, but just in case)
        if (event.target.closest('.editor-sidebar')) return;

        // Calculate normalized device coordinates
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Ensure TransformControls is using the correct camera
        this.transformControl.camera = this.editorCamera;
        this.raycaster.setFromCamera(this.mouse, this.editorCamera);

        // 1. Check if clicking an existing gizmo
        const hitId = this.editorGizmos.raycast(this.raycaster);

        if (store.editorTool === 'select') {
            store.editorSelectedId = hitId;
            this.editorGizmos.setSelected(hitId);

            if (hitId) {
                const g = this.editorGizmos.gizmos.find(x => x.id === hitId);
                if (g && g.mesh) {
                    this.transformControl.attach(g.mesh);
                }
            } else {
                this.transformControl.detach();
            }
            return;
        }

        // 2. If placing a new object, find intersection with the floor
        if (this.levelManager.commonFloorMesh) {
            const intersects = this.raycaster.intersectObject(this.levelManager.commonFloorMesh);
            if (intersects.length > 0) {
                const p = intersects[0].point;
                this._placeEditorObject(store.editorTool, p.x, p.y, p.z);
            }
        }
    }

    _placeEditorObject(type, x, y, z) {
        if (!this.currentLevelData) return;

        const id = `${type}_${Date.now()}`;
        let newObj = null;

        if (type === 'playerSpawn') {
            // Only one player spawn allowed, so we replace it
            this.currentLevelData.playerSpawn = { x, y, z };
            newObj = { id: 'playerSpawn', pos: [x, y, z] };
        } else if (type === 'camera') {
            if (!this.currentLevelData.cameras) this.currentLevelData.cameras = [];
            newObj = { id, pos: [x, y + 10, z], lookAt: [x, 0, z], bounds: { minX: x - 5, maxX: x + 5, minZ: z - 5, maxZ: z + 5 } };
            this.currentLevelData.cameras.push(newObj);
        } else if (type === 'zombie') {
            if (!this.currentLevelData.zombies) this.currentLevelData.zombies = [];
            newObj = { id, pos: [x, y, z] };
            this.currentLevelData.zombies.push(newObj);
        } else if (type === 'collectible') {
            if (!this.currentLevelData.collectibles) this.currentLevelData.collectibles = [];
            newObj = { id, type: 'ammo', name: 'Handgun Ammo', amount: 15, pos: [x, y, z] };
            this.currentLevelData.collectibles.push(newObj);
        } else if (type === 'light') {
            if (!this.currentLevelData.lights) this.currentLevelData.lights = [];
            newObj = { id, pos: [x, y + 2, z], color: 16768426, intensity: 5, distance: 10 }; // default warm white
            this.currentLevelData.lights.push(newObj);

            // Spawn physical pointlight immediately
            const pLight = new THREE.PointLight(newObj.color, newObj.intensity, newObj.distance);
            pLight.position.set(x, y + 2, z);
            pLight.userData.id = id;
            this.scene.add(pLight);
        }

        // Sync Vue store to force UI update
        store.editorLevelData = { ...this.currentLevelData };

        // Ensure the visual gizmo is spawned
        if (type === 'playerSpawn') {
            // Remove old spawn point visually if it existed
            this.editorGizmos.removeById('playerSpawn');
            this.editorGizmos.addGizmo('playerSpawn', 'playerSpawn', x, y + 1, z);
        } else {
            let yOffset = 0;
            if (type === 'zombie') yOffset = 0.5;
            if (type === 'collectible') yOffset = 0.3;
            // lights and cameras stay at pos
            this.editorGizmos.addGizmo(type, id, newObj.pos[0], newObj.pos[1] + yOffset, newObj.pos[2]);
        }

        // Auto-select the newly placed object
        store.editorSelectedId = newObj.id;
        this.editorGizmos.setSelected(newObj.id);
    }

    _setupTransitionScene() {
        // Point light in a black void
        const light = new THREE.PointLight(0xffddaa, 3.5, 10);
        light.position.set(1, 0, 3); // Center on door
        this.transitionScene.add(light);

        // Load the terrifying vintage door texture via Vite
        const textureLoader = new THREE.TextureLoader();
        const doorTexture = textureLoader.load(doorTextureUrl);
        // Let's make it a bit dark and grungy by reducing the emissive
        const doorMat = new THREE.MeshStandardMaterial({
            map: doorTexture,
            roughness: 0.8,
            color: 0x888888
        });

        const doorGeo = new THREE.PlaneGeometry(2, 3);
        this.doorMesh = new THREE.Mesh(doorGeo, doorMat);

        // Create a pivot so it rotates around the hinge (left edge)
        this.doorPivot = new THREE.Group();
        this.doorPivot.position.set(-1, 0, 0); // Position pivot at left edge of where door should be
        this.doorMesh.position.set(1, 0, 0); // Offset mesh to the right of the pivot
        this.doorPivot.add(this.doorMesh);

        this.transitionScene.add(this.doorPivot);
    }

    startGame() {
        console.log("Game Starting...");
        this.ui.hideStartScreen();
        this.isPaused = false;

        // Load Level 1
        this.levelManager.loadLevel(1);

        // Init Debug UI values
        this.ui.updateAmmo(15, 30);

        // Update AISystem with new pathfinder
        const aiSystem = this.world.systems.find(s => s instanceof AISystem);
        if (aiSystem) {
            aiSystem.pathfinder = this.levelManager.pathfinder;
        }
    }

    changeLevel(levelNumber) {
        this.isPaused = true;

        // 1. Fade old level to black
        this.ui.fadeOut(() => {
            // 2. Hide HUD and show Door Transition Scene
            this.isTransitioning = true;
            this.doorPivot.rotation.y = 0; // Reset door

            // 3. Fade in to reveal the door
            this.ui.fadeIn();

            // 4. Animate door opening, then load new level
            this.playDoorTransition(() => {
                // 5. Door finished, fade back to black
                this.ui.fadeOut(() => {
                    // 6. Start new level behind the scenes
                    this.levelManager.loadLevel(levelNumber);

                    // Update AI System
                    const aiSystem = this.world.systems.find(s => s instanceof AISystem);
                    if (aiSystem) {
                        aiSystem.pathfinder = this.levelManager.pathfinder;
                    }

                    // 7. Swap scenes back and fade into the new level
                    this.isTransitioning = false;
                    this.isPaused = false;
                    this.ui.fadeIn();
                });
            });
        });
    }

    playDoorTransition(onComplete) {
        let startTime = null;
        let isSkipped = false;
        let animationFrameId = null;

        // Reset state
        this.transitionCamera.position.z = 2.5;
        this.doorPivot.rotation.y = 0;

        const skipHandler = (e) => {
            if (e.code === 'Space' && !isSkipped) {
                isSkipped = true;
                window.removeEventListener('keydown', skipHandler);
                if (animationFrameId !== null) {
                    cancelAnimationFrame(animationFrameId);
                }

                // Snap to final state
                this.doorPivot.rotation.y = Math.PI / 2;
                this.transitionCamera.position.z = -0.5;

                if (onComplete) onComplete();
            }
        };
        window.addEventListener('keydown', skipHandler);

        const animateSequence = (time) => {
            if (isSkipped) return;
            if (!startTime) startTime = time;
            const elapsed = time - startTime;

            if (elapsed < 2000) {
                // Phase 1: Contemplate (0-2s)
                this.doorPivot.rotation.y = 0;
                this.transitionCamera.position.z = 2.5;
            } else if (elapsed < 4000) {
                // Phase 2: Open door (2s - 4s)
                const progress = (elapsed - 2000) / 2000;
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                this.doorPivot.rotation.y = easeProgress * (Math.PI / 2);
                this.transitionCamera.position.z = 2.5; // Stay still
            } else if (elapsed < 6000) {
                // Phase 3: Walk through (4s - 6s)
                this.doorPivot.rotation.y = Math.PI / 2; // Door is open
                const progress = (elapsed - 4000) / 2000;
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                this.transitionCamera.position.z = 2.5 - (easeProgress * 3.0);
            } else {
                // Done
                this.doorPivot.rotation.y = Math.PI / 2;
                this.transitionCamera.position.z = -0.5;

                window.removeEventListener('keydown', skipHandler);

                // Optional pause before fading to next level
                setTimeout(() => {
                    if (onComplete && !isSkipped) onComplete();
                }, 500);
                return;
            }

            animationFrameId = requestAnimationFrame(animateSequence);
        };

        animationFrameId = requestAnimationFrame(animateSequence);
    }

    // --- State Helpers ---
    zombieKilled(id) {
        if (id) {
            this.gameState.recordZombieDeath(this.levelManager.currentLevel, id);

            // Level 1 Key Cutscene Trigger
            if (this.levelManager.currentLevel === 1) {
                const z1 = this.gameState.isZombieDead(1, 'zombie1');
                const z2 = this.gameState.isZombieDead(1, 'zombie2');
                const z3 = this.gameState.isZombieDead(1, 'zombie3');

                if (z1 && z2 && z3 && !this.gameState.cutscenePlayed) {
                    this.playKeyCutscene();
                }
            }
        }
    }

    gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.isPaused = true;
        this.ui.showGameOver();

        setTimeout(() => {
            window.location.reload();
        }, 8500);
    }

    playKeyCutscene() {
        if (this.gameState.cutscenePlayed) return;
        this.gameState.cutscenePlayed = true;

        console.log("Playing cutscene...");
        this.isPaused = true; // Pause game mechanics

        // Save current camera
        const previousCamera = this.activeCamera;

        // Set cutscene camera
        this.cameras.cutscene.position.set(3, 3, 5);
        this.cameras.cutscene.lookAt(3, 0.1, 2); // Look at key pos
        this.activeCamera = this.cameras.cutscene;

        // Unhide the key
        if (this.keyEntity && this.keyEntity.components.MeshComponent) {
            const keyMesh = this.keyEntity.components.MeshComponent.mesh;
            keyMesh.visible = true;

            // Add a simple pop animation setup
            keyMesh.position.y = 2; // Start high
            const targetY = 0.1;
            let time = 0;

            const animateKey = () => {
                if (!this.isPaused && this.activeCamera !== this.cameras.cutscene) return; // Cutscene over

                requestAnimationFrame(animateKey);
                if (keyMesh.position.y > targetY) {
                    keyMesh.position.y -= 0.05;
                    keyMesh.rotation.y += 0.1;
                } else {
                    keyMesh.position.y = targetY;
                    keyMesh.rotation.y += 0.05; // Spin slowly
                }
            };
            animateKey();
        }

        // Return to normal after 3 seconds
        setTimeout(() => {
            this.activeCamera = previousCamera;
            this.isPaused = false;
        }, 3000);
    }

    itemCollected(id) {
        if (id) {
            this.gameState.recordItemCollected(this.levelManager.currentLevel, id);
        }
    }

    animate(time) {
        requestAnimationFrame(this.animate);
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        if (!this.isPaused) {
            this.physicsWorld.step(); // Step physics engine
            this.world.update(dt);

            // Check again in case a system (like CombatSystem triggering a cutscene) paused the game
            if (!this.isPaused) {
                this.levelManager.update(dt);
            }

            // Cleanup destroyed entities
            for (let i = this.world.entities.length - 1; i >= 0; i--) {
                if (this.world.entities[i].isDestroyed) {
                    this.world.entities.splice(i, 1);
                }
            }

            // Sync Debug Colliders
            if (this.showColliders && this.colliderHelpers) {
                this.colliderHelpers.forEach(item => {
                    if (item.entity.isDestroyed) return;

                    if (item.entity.components.MeshComponent && item.entity.components.MeshComponent.mesh) {
                        item.helper.update(); // Three.js native bounds sync
                    } else if (item.entity.components.Transform) {
                        item.helper.position.copy(item.entity.components.Transform.position);
                        item.helper.position.y += 1; // Center vertical
                    }
                });
            }
        }

        // Render
        const renderCamera = store.showLevelEditor ? this.editorCamera : this.activeCamera;

        if (store.showLevelEditor) {
            if (this.orbitControls) {
                if (!this.isGizmoDragging) this.orbitControls.enabled = true;
                this.orbitControls.update();
            }

            // Sync gizmo spheres back to ECS entities if they move (e.g. zombies walking)
            if (this.editorGizmos && !this.isGizmoDragging) {
                this.editorGizmos.gizmos.forEach(g => {
                    const id = g.id;
                    if (g.type === 'camera') {
                        const camObj = this.cameras && this.cameras[this.currentLevelIndex] && this.cameras[this.currentLevelIndex].find(c => c.camera.userData.id === id);
                        if (camObj) {
                            g.mesh.position.copy(camObj.camera.position);
                            if (this.editorGizmos.selectedId === id && this.editorGizmos._ringMesh) {
                                this.editorGizmos._ringMesh.position.copy(g.mesh.position);
                            }
                        }
                    } else if (g.type === 'light') {
                        const light = this.scene.children.find(c => c.isPointLight && c.userData.id === id);
                        if (light) {
                            g.mesh.position.copy(light.position);
                            if (this.editorGizmos.selectedId === id && this.editorGizmos._ringMesh) {
                                this.editorGizmos._ringMesh.position.copy(g.mesh.position);
                            }
                        }
                    } else {
                        let entity = this.world.entities.find(e => e.persistentId === id);
                        if (!entity && id === 'playerSpawn') {
                            entity = this.playerEntity;
                        }

                        if (entity && entity.components.Transform) {
                            const tPos = entity.components.Transform.position;
                            const yOffset = g.type === 'zombie' ? 0.5 : (g.type === 'collectible' ? 0.3 : 0);
                            g.mesh.position.set(tPos.x, tPos.y + yOffset, tPos.z);

                            if (this.editorGizmos.selectedId === id && this.editorGizmos._ringMesh) {
                                this.editorGizmos._ringMesh.position.copy(g.mesh.position);
                            }
                        }
                    }
                });
            }
        } else {
            if (this.orbitControls) this.orbitControls.enabled = false;
        }

        if (this.isTransitioning) {
            this.renderer.render(this.transitionScene, this.transitionCamera);
        } else if (renderCamera) {
            if (this.transformControl) this.transformControl.camera = renderCamera;

            // 1. Full screen primary render
            this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
            this.renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
            this.renderer.setScissorTest(false);
            this.renderer.render(this.scene, renderCamera);

            // 2. Camera Preview (PiP) in Editor Mode
            if (store.showLevelEditor && store.editorSelectedId) {
                const selCamObj = this.cameras[this.currentLevelIndex]?.find(c => c.camera.userData.id === store.editorSelectedId);
                if (selCamObj) {
                    const pipWidth = 320;
                    const pipHeight = 180;
                    const padding = 20;

                    // Bottom-center
                    const startX = (window.innerWidth / 2) - (pipWidth / 2);
                    const startY = padding;

                    this.renderer.setViewport(startX, startY, pipWidth, pipHeight);
                    this.renderer.setScissor(startX, startY, pipWidth, pipHeight);
                    this.renderer.setScissorTest(true);

                    // Clear depth so the PiP renders on top
                    this.renderer.clearDepth();

                    // Render the scene from the selected camera's perspective
                    this.renderer.render(this.scene, selCamObj.camera);

                    // Reset renderer state for next frame
                    this.renderer.setScissorTest(false);
                    this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
                }
            }
        }

        // Legacy Update for Player (UI/Input)
        if (this.player) {
            this.player.update();
        }

        this.input.update();
    }
}