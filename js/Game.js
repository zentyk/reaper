import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';
import { Player } from './Player.js';
import { InputHandler } from './InputHandler.js';
import { Zombie } from './Zombie.js';
import { Pathfinder } from './Pathfinder.js';

export class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);

        // Cameras
        this.cameras = {
            north: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
            south: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
            cutscene: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
        };
        
        // Setup North Camera (Looking South)
        this.cameras.north.position.set(10, 10, -15);
        this.cameras.north.lookAt(-10, 0, 0);
        
        // Setup South Camera (Looking North)
        this.cameras.south.position.set(-10, 10, 15);
        this.cameras.south.lookAt(0, 0, 0);
        
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

        this.setupLights();
        this.setupEnvironment();

        this.input = new InputHandler();
        this.player = new Player(this.scene);
        
        // Initialize Pathfinder
        this.pathfinder = new Pathfinder(20, 20, this.obstacles);

        this.animate = this.animate.bind(this);
    }

    setupLights() {
        const light = new THREE.PointLight(0xffffff, 100, 100);
        light.position.set(0, 10, 0);
        this.scene.add(light);

        const lightB = new THREE.PointLight(0xffffff, 100, 100);
        lightB.position.set(10, 10, 0);
        this.scene.add(lightB);

        const lightC = new THREE.PointLight(0xffffff, 100, 100);
        lightC.position.set(-10, 10, 0);
        this.scene.add(lightC);
    }

    setupEnvironment() {
        const floor = new THREE.Mesh(
            new THREE.BoxGeometry(20, 0.1, 20),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        this.scene.add(floor);

        // Add Obstacles
        this.obstacles = [];
        const obstaclePositions = [
            { x: 5, z: 5, w: 2, h: 2 },
            { x: -5, z: -5, w: 2, h: 2 },
            { x: 5, z: -5, w: 1, h: 4 },
            { x: -5, z: 5, w: 4, h: 1 }
        ];

        obstaclePositions.forEach(pos => {
            const geometry = new THREE.BoxGeometry(pos.w, 2, pos.h);
            const material = new THREE.MeshStandardMaterial({ color: 0x555555 });
            const obstacle = new THREE.Mesh(geometry, material);
            obstacle.position.set(pos.x, 1, pos.z);
            obstacle.castShadow = true;
            obstacle.receiveShadow = true;
            
            // Add bounding box for collision
            obstacle.geometry.computeBoundingBox();
            obstacle.userData = { isObstacle: true, boundingBox: new THREE.Box3().setFromObject(obstacle) };
            
            this.scene.add(obstacle);
            this.obstacles.push(obstacle);
        });

        // Add Collectibles (Ammo Box)
        this.interactables = [];
        const ammoBoxGeo = new THREE.BoxGeometry(0.5, 0.3, 0.3);
        const ammoBoxMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Green box
        const ammoBox = new THREE.Mesh(ammoBoxGeo, ammoBoxMat);
        ammoBox.position.set(2, 0.15, 2);
        ammoBox.userData = { 
            isCollectible: true, 
            type: 'ammo', 
            amount: 15,
            name: 'Handgun Ammo'
        };
        this.scene.add(ammoBox);
        this.interactables.push(ammoBox);

        // Add Key (Hidden initially)
        const keyGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const keyMat = new THREE.MeshStandardMaterial({ color: 0xFFFF00 }); // Yellow
        const key = new THREE.Mesh(keyGeo, keyMat);
        key.position.set(3, 0.1, 2); 
        key.userData = { 
            isCollectible: true, 
            type: 'key', 
            name: 'Exit Key'
        };
        key.visible = false; // Hide initially
        this.scene.add(key);
        this.interactables.push(key);
        this.keyMesh = key;

        // Add Green Herb
        const herbGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
        const herbMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Green
        const herb = new THREE.Mesh(herbGeo, herbMat);
        herb.position.set(-2, 0.15, -2);
        herb.userData = { 
            isCollectible: true, 
            type: 'health', 
            amount: 50,
            name: 'Green Herb'
        };
        this.scene.add(herb);
        this.interactables.push(herb);

        // Add Door (Now also an obstacle)
        const doorGeo = new THREE.BoxGeometry(2, 3, 0.2);
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown
        const door = new THREE.Mesh(doorGeo, doorMat);
        // Position on North wall (z = -10)
        door.position.set(0, 1.5, -10); 
        
        // Add bounding box for collision
        door.geometry.computeBoundingBox();
        door.userData = { 
            isDoor: true, 
            name: "Exit Door",
            isObstacle: true, // Treat as obstacle
            boundingBox: new THREE.Box3().setFromObject(door)
        };
        
        this.scene.add(door);
        this.interactables.push(door);
        this.obstacles.push(door); // Add to obstacles list for collision

        // Add some zombies
        this.zombies = [];
        for (let i = 0; i < 5; i++) {
            const x = (Math.random() - 0.5) * 15;
            const z = (Math.random() - 0.5) * 15;
            const zombie = new Zombie(this.scene, x, z);
            this.zombies.push(zombie);
        }
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