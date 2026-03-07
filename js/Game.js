import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';
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

export class Game {
    constructor() {
        // --- Core Systems ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 1);
        document.body.appendChild(this.renderer.domElement);

        // --- Cameras ---
        this.cameras = {
            north: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
            south: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
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
    }

    _bindUICallbacks() {
        this.ui.callbacks.onStart = () => this.startGame();
    }

    startGame() {
        console.log("Game Starting...");
        this.ui.hideStartScreen();
        this.isPaused = false;

        // Load Level 1
        this.levelManager.loadLevel(1);

        // Update AISystem with new pathfinder
        const aiSystem = this.world.systems.find(s => s instanceof AISystem);
        if (aiSystem) {
            aiSystem.pathfinder = this.levelManager.pathfinder;
        }
    }

    changeLevel(levelNumber) {
        this.isPaused = true;
        this.ui.fadeOut(() => {
            this.levelManager.loadLevel(levelNumber);

            // Update AI System
            const aiSystem = this.world.systems.find(s => s instanceof AISystem);
            if (aiSystem) {
                aiSystem.pathfinder = this.levelManager.pathfinder;
            }

            this.isPaused = false;
        });
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
        }

        // Render
        if (this.activeCamera) {
            this.renderer.render(this.scene, this.activeCamera);
        }

        // Legacy Update for Player (UI/Input)
        if (this.player) {
            this.player.update();
        }

        this.input.update();
    }
}