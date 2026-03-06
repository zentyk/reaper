import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';

export class Player {
    constructor(scene) {
        this.scene = scene;
        
        // Movement Settings
        this.walkSpeed = 0.08;
        this.runSpeed = 0.16;
        this.rotationSpeed = 0.04;
        this.healthMultiplier = 1.0;
        this.speed = this.walkSpeed;
        
        this.isAiming = false;
        this.canShoot = true;
        
        this.health = 100;
        this.isGrappled = false;
        this.struggleCount = 0; // Count key presses to escape
        this.lastSpaceState = false; // Track previous state of space key
        this.lastRState = false; // Track previous state of R key
        this.lastIState = false; // Track previous state of I key

        // Ammo Logic
        this.maxAmmoInClip = 15;
        this.currentAmmoInClip = 15;
        this.totalAmmo = 30; // Starting ammo in inventory
        this.isReloading = false;
        
        // Inventory Logic
        this.isInventoryOpen = false;

        // Container for the player (pivot point at feet)
        this.container = new THREE.Group();
        this.container.position.set(0, 0, 0);
        scene.add(this.container);

        // Character Mesh (Tall White Block)
        const geometry = new THREE.BoxGeometry(0.5, 1.8, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y = 0.9; // Move up so feet are at 0
        this.mesh.castShadow = true;
        this.container.add(this.mesh);

        // Gun Mesh
        const gunGeo = new THREE.BoxGeometry(0.1, 0.1, 0.4);
        const gunMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        this.gun = new THREE.Mesh(gunGeo, gunMat);
        this.gun.position.set(0.3, 1.4, -0.4); // Attached to side, slightly forward
        this.container.add(this.gun);

        this.raycaster = new THREE.Raycaster();
        
        this.updateHealthUI();
        this.updateAmmoUI();
    }

    update(input, shootableObjects = []) {
        const isSpaceDown = input.isKeyDown(' ');
        const isRDown = input.isKeyDown('r');
        const isIDown = input.isKeyDown('i');
        const isRunDown = input.isKeyDown('z'); // Z for Running

        // Toggle Inventory
        if (isIDown && !this.lastIState) {
            this.toggleInventory();
        }
        this.lastIState = isIDown;

        if (this.isInventoryOpen) {
            return; // Pause game logic while inventory is open
        }

        if (this.isGrappled) {
            // Struggle Mechanic: Mash Space to escape
            // Only count new presses (rising edge)
            if (isSpaceDown && !this.lastSpaceState) {
                this.struggleCount++;
            }
            this.lastSpaceState = isSpaceDown;
            this.lastRState = isRDown;
            return; // Disable movement and shooting while grappled
        }

        // Reload Logic (R key)
        if (isRDown && !this.lastRState && !this.isReloading && this.currentAmmoInClip < this.maxAmmoInClip && this.totalAmmo > 0) {
            this.reload();
        }

        // Check for Aiming (Shift)
        this.isAiming = input.isKeyDown('shift');

        if (this.isAiming) {
            // Aiming Logic
            this.gun.rotation.x = 0; // Point forward

            // Rotate while aiming
            if (input.isKeyDown('arrowleft')) {
                this.container.rotation.y += this.rotationSpeed;
            }
            if (input.isKeyDown('arrowright')) {
                this.container.rotation.y -= this.rotationSpeed;
            }

            // Shoot (Space)
            if (isSpaceDown && !this.lastSpaceState && this.canShoot && !this.isReloading) {
                if (this.currentAmmoInClip > 0) {
                    this.shoot(shootableObjects);
                    this.canShoot = false;
                    setTimeout(() => this.canShoot = true, 500); // 0.5s fire rate
                } else {
                    // Click sound or visual feedback for empty clip
                    console.log("Click! Empty clip.");
                    this.canShoot = false;
                    setTimeout(() => this.canShoot = true, 200); // Faster reset for empty click
                }
            }

        } else {
            // Movement Logic
            this.gun.rotation.x = Math.PI / 3; // Point down

            // Calculate current speed based on Run state and Health
            const baseSpeed = isRunDown ? this.runSpeed : this.walkSpeed;
            this.speed = baseSpeed * this.healthMultiplier;

            if (input.isKeyDown('arrowleft')) {
                this.container.rotation.y += this.rotationSpeed;
            }
            if (input.isKeyDown('arrowright')) {
                this.container.rotation.y -= this.rotationSpeed;
            }
            if (input.isKeyDown('arrowup')) {
                this.container.position.x -= Math.sin(this.container.rotation.y) * this.speed;
                this.container.position.z -= Math.cos(this.container.rotation.y) * this.speed;
            }
            if (input.isKeyDown('arrowdown')) {
                this.container.position.x += Math.sin(this.container.rotation.y) * this.speed;
                this.container.position.z += Math.cos(this.container.rotation.y) * this.speed;
            }
        }
        
        this.lastSpaceState = isSpaceDown;
        this.lastRState = isRDown;
    }

    toggleInventory() {
        this.isInventoryOpen = !this.isInventoryOpen;
        const invScreen = document.getElementById('inventoryScreen');
        
        if (this.isInventoryOpen) {
            if (invScreen) {
                invScreen.style.display = 'flex';
                this.updateInventoryUI();
            }
        } else {
            if (invScreen) {
                invScreen.style.display = 'none';
            }
        }
    }

    updateInventoryUI() {
        const invAmmo = document.getElementById('invAmmo');
        if (invAmmo) {
            invAmmo.innerHTML = `Ammo<br>x${this.totalAmmo}`;
        }
    }

    reload() {
        console.log("Reloading...");
        this.isReloading = true;
        
        // Visual feedback: maybe lower gun or change color temporarily
        const originalColor = this.gun.material.color.getHex();
        this.gun.material.color.setHex(0x888888); // Grey out gun

        setTimeout(() => {
            // Calculate how much ammo we need to fill the clip
            const needed = this.maxAmmoInClip - this.currentAmmoInClip;
            
            // Take from total ammo, but don't take more than we have
            const toLoad = Math.min(needed, this.totalAmmo);
            
            this.currentAmmoInClip += toLoad;
            this.totalAmmo -= toLoad;
            
            this.isReloading = false;
            this.gun.material.color.setHex(originalColor);
            this.updateAmmoUI();
            this.updateInventoryUI(); // Update inventory if open
            console.log("Reloaded!");
        }, 1500); // 1.5s reload time
    }

    shoot(targets) {
        this.currentAmmoInClip--;
        this.updateAmmoUI();

        // Calculate forward direction
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.container.quaternion);

        // Origin at gun position
        const origin = new THREE.Vector3();
        this.gun.getWorldPosition(origin);

        this.raycaster.set(origin, direction);

        // Visual Feedback (Laser/Tracer)
        const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
        const points = [];
        points.push(origin);
        // End point far away
        const endPoint = new THREE.Vector3().copy(origin).add(direction.multiplyScalar(100));
        points.push(endPoint);
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        
        // Remove line after short duration
        setTimeout(() => {
            this.scene.remove(line);
            geometry.dispose();
            material.dispose();
        }, 50);

        // Check hits
        const intersects = this.raycaster.intersectObjects(targets);
        if (intersects.length > 0) {
            const hit = intersects[0];
            
            // Check if it's a zombie
            if (hit.object.userData && hit.object.userData.isZombie) {
                const zombie = hit.object.userData.parent;
                if (zombie) {
                    zombie.takeDamage();
                }
            }
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        
        this.updateHealthUI();
        this.updateSpeed(); // Update speed based on new health

        // Visual feedback (flash red)
        this.mesh.material.color.setHex(0xff0000);
        setTimeout(() => {
            this.mesh.material.color.setHex(0xffffff);
        }, 100);
        
        if (this.health <= 0) {
            return true; // Dead
        }
        return false;
    }

    updateSpeed() {
        if (this.health > 66) {
            this.healthMultiplier = 1.0; // 100% speed (Fine)
        } else if (this.health > 33) {
            this.healthMultiplier = 0.75; // 75% speed (Caution)
        } else {
            this.healthMultiplier = 0.5; // 50% speed (Danger)
        }
    }

    updateHealthUI() {
        const healthBar = document.getElementById('healthValue');
        if (healthBar) {
            healthBar.style.width = this.health + '%';
            
            // Change color based on health
            if (this.health > 50) {
                healthBar.style.backgroundColor = 'green';
            } else if (this.health > 25) {
                healthBar.style.backgroundColor = 'yellow';
            } else {
                healthBar.style.backgroundColor = 'red';
            }
        }
    }

    updateAmmoUI() {
        const ammoValue = document.getElementById('ammoValue');
        if (ammoValue) {
            ammoValue.innerText = `${this.currentAmmoInClip} / ${this.totalAmmo}`;
        }
    }
}