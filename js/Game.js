import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';
import { Player } from './Player.js';
import { InputHandler } from './InputHandler.js';
import { Pathfinder } from './Pathfinder.js';
import { setupLevel1 } from './levels/Level1.js';
import { setupLevel2 } from './levels/Level2.js';
import { AudioHandler } from './AudioHandler.js';

export class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);

        // Cameras (Initialized here, but configured per level)
        this.cameras = {
            north: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
            south: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
            cutscene: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
        };
        
        this.activeCamera = this.cameras.north;

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.zombies = []; // Initialize zombies array
        this.obstacles = []; // Initialize obstacles array
        this.interactables = []; // Initialize interactables (collectibles, doors, etc.)
        this.isGameOver = false;
        this.grappledZombie = null; // Track which zombie is biting
        this.grappleTimer = 0; // Timer for damage over time
        
        this.keySpawned = false;
        this.keyMesh = null;
        this.isCutscene = false;
        
        this.currentLevel = 1;

        // Audio
        this.audio = new AudioHandler();

        this.createFloor();
        
        this.input = new InputHandler();
        this.player = new Player(this.scene, this); // Pass game instance to player
        
        this.setupEnvironment(); // Setup level (lights, cameras, objects)
        
        // Initialize Pathfinder
        this.pathfinder = new Pathfinder(20, 20, this.obstacles);

        this.animate = this.animate.bind(this);
        
        // Initial Fade In
        setTimeout(() => this.fadeIn(), 100);
    }

    createFloor() {
        const floor = new THREE.Mesh(
            new THREE.BoxGeometry(20, 0.1, 20),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        this.scene.add(floor);
    }

    setupEnvironment() {
        if (this.currentLevel === 1) {
            setupLevel1(this);
        } else {
            setupLevel2(this);
        }
    }
    
    fadeIn() {
        const fadeOverlay = document.getElementById('fadeOverlay');
        if (fadeOverlay) {
            // Ensure it starts black
            fadeOverlay.style.opacity = '1';
            
            // Use a small timeout to allow the browser to render the opacity: 1 state
            // before switching to opacity: 0 to trigger the transition
            requestAnimationFrame(() => {
                fadeOverlay.style.opacity = '0';
            });
        }
    }
    
    changeLevel(levelNumber) {
        this.currentLevel = levelNumber;
        
        // Update UI
        const levelText = document.getElementById('levelText');
        if (levelText) levelText.innerText = `Level ${this.currentLevel}`;
        
        // Reset Game State
        // Remove old entities
        this.zombies.forEach(z => this.scene.remove(z.mesh));
        this.obstacles.forEach(o => this.scene.remove(o));
        this.interactables.forEach(i => this.scene.remove(i));
        
        // Reset arrays
        this.zombies = [];
        this.obstacles = [];
        this.interactables = [];
        this.keySpawned = false;
        this.keyMesh = null;
        
        // Reset Player Rotation
        this.player.container.rotation.set(0, 0, 0);
        
        // Re-setup environment (This will configure lights, cameras, audio, and spawn player)
        this.setupEnvironment();
        
        // Re-init pathfinder
        this.pathfinder = new Pathfinder(20, 20, this.obstacles);
        
        console.log(`Level ${this.currentLevel} Loaded`);
        
        // Trigger Fade In
        this.fadeIn();
    }

    updateZombies() {
        if (this.isGameOver) return;

        const playerPos = this.player.container.position;
        const isPlayerGrappled = this.player.isGrappled;

        // If grappled, handle damage and escape
        if (isPlayerGrappled && this.grappledZombie) {
            // Damage over time (every 60 frames approx 1 sec, let's do faster)
            this.grappleTimer++;
            if (this.grappleTimer % 30 === 0) { // Every 0.5 seconds
                if (this.player.takeDamage(10)) { // 10 damage per tick
                    this.gameOver();
                }
            }

            // Check struggle count (simple threshold for now)
            if (this.player.struggleCount > 10) {
                // Escaped!
                this.player.isGrappled = false;
                this.player.struggleCount = 0;
                this.grappledZombie.stopBiting();
                this.grappledZombie = null;
                this.grappleTimer = 0;
                console.log("Escaped!");
            }
        }

        // Check if all zombies are dead to spawn key
        if (!this.keySpawned) {
            const allDead = this.zombies.every(z => z.isDead);
            if (allDead) {
                this.spawnKey();
            }
        }

        for (let i = this.zombies.length - 1; i >= 0; i--) {
            const zombie = this.zombies[i];
            
            // Pass grapple state so other zombies wait
            // Also pass obstacles for collision
            // Pass pathfinder
            zombie.update(playerPos, isPlayerGrappled, this.obstacles, this.pathfinder);

            // Check for new grapple
            if (!isPlayerGrappled && !zombie.isDead && zombie.checkCollision(playerPos)) {
                // Start grapple
                this.player.isGrappled = true;
                this.player.struggleCount = 0;
                this.grappledZombie = zombie;
                this.grappleTimer = 0;
                zombie.startBiting();
                
                // Initial damage
                if (this.player.takeDamage(10)) {
                    this.gameOver();
                }
                console.log("Grappled! Mash Space!");
            }
        }
    }

    spawnKey() {
        this.keySpawned = true;
        this.keyMesh.visible = true;
        
        // Setup cutscene camera
        const target = this.keyMesh.position.clone();
        this.cameras.cutscene.position.set(target.x + 2, 3, target.z + 2);
        this.cameras.cutscene.lookAt(target);
        
        this.previousCamera = this.activeCamera;
        this.activeCamera = this.cameras.cutscene;
        this.isCutscene = true;
        
        setTimeout(() => {
            this.activeCamera = this.previousCamera;
            this.isCutscene = false;
            this.updateCamera(); // Ensure correct camera is active
        }, 3000);
    }

    updateCamera() {
        if (this.isCutscene) return;

        const playerZ = this.player.container.position.z;
        
        // Simple switch logic: if player is in the "north" half (z < 0), use North camera
        // If player is in the "south" half (z > 0), use South camera
        // Adding a small buffer to prevent rapid switching at z=0
        
        if (this.activeCamera === this.cameras.north && playerZ > 2) {
            this.activeCamera = this.cameras.south;
        } else if (this.activeCamera === this.cameras.south && playerZ < -2) {
            this.activeCamera = this.cameras.north;
        }
    }

    gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        
        this.audio.fadeOutMusic();
        
        const screen = document.getElementById('gameOverScreen');
        screen.style.display = 'flex';
        // Trigger reflow to enable transition
        void screen.offsetWidth;
        screen.style.opacity = '1';

        setTimeout(() => {
            window.location.reload();
        }, 3000);
    }

    animate() {
        if (!this.isGameOver) {
            requestAnimationFrame(this.animate);
            
            if (!this.isCutscene) {
                // Pass zombie meshes to player for hit detection
                const zombieMeshes = this.zombies.map(z => z.mesh);
                
                // Update Player (handles input, movement, shooting, inventory)
                // Pass obstacles for collision
                // Pass interactables (collectibles + door)
                this.player.update(this.input, zombieMeshes, this.obstacles, this.interactables);
                
                // Only update zombies if inventory is NOT open AND pickup prompt is NOT open
                if (!this.player.isInventoryOpen && !this.player.isPickupPromptOpen) {
                    this.updateZombies();
                }
                
                this.updateCamera();
            }
            
            this.renderer.render(this.scene, this.activeCamera);
        }
    }

    start() {
        this.animate();
    }
}