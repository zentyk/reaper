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

export class Game {
    static async init() {
        await RAPIER.init();
        return new Game();
    }

    constructor() {
        // --- Core Systems ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);

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
        if (this.isTransitioning) {
            this.renderer.render(this.transitionScene, this.transitionCamera);
        } else if (this.activeCamera) {
            this.renderer.render(this.scene, this.activeCamera);
        }

        // Legacy Update for Player (UI/Input)
        if (this.player) {
            this.player.update();
        }

        this.input.update();
    }
}