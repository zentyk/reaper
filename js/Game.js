import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';
import { Player } from './Player.js';
import { InputHandler } from './InputHandler.js';
import { Zombie } from './Zombie.js';

export class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, -15);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.zombies = []; // Initialize zombies array
        this.isGameOver = false;
        this.grappledZombie = null; // Track which zombie is biting
        this.grappleTimer = 0; // Timer for damage over time

        this.setupLights();
        this.setupEnvironment();

        this.input = new InputHandler();
        this.player = new Player(this.scene);

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

        for (let i = this.zombies.length - 1; i >= 0; i--) {
            const zombie = this.zombies[i];
            
            // Pass grapple state so other zombies wait
            zombie.update(playerPos, isPlayerGrappled);

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
            
            // Pass zombie meshes to player for hit detection
            const zombieMeshes = this.zombies.map(z => z.mesh);
            
            // Update Player (handles input, movement, shooting, inventory)
            this.player.update(this.input, zombieMeshes);
            
            // Only update zombies if inventory is NOT open
            if (!this.player.isInventoryOpen) {
                this.updateZombies();
            }

            this.renderer.render(this.scene, this.camera);
        }
    }

    start() {
        this.animate();
    }
}