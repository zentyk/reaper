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

        // Cheats
        this.infiniteHealth = false;

        // Ammo Logic
        this.maxAmmoInClip = 15;
        this.currentAmmoInClip = 15;
        this.totalAmmo = 10; // Starting ammo in inventory
        this.isReloading = false;
        
        // Inventory Logic
        this.isInventoryOpen = false;
        this.combineSourceIndex = null; // Track item selected for combination
        
        this.inventory = [
            { id: 'handgun', name: 'Handgun', type: 'weapon', equipped: true, combinable: true, usable: false },
            { id: 'ammo', name: 'Ammo', type: 'ammo', count: 30, combinable: true, usable: false },
            null, null, null, null // Empty slots
        ];
        
        // Pickup Logic
        this.pendingCollectible = null;
        this.isPickupPromptOpen = false;
        
        // Track equipped weapon
        this.equippedWeapon = this.inventory[0];

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
        
        this.updateWeaponState();
        this.updateHealthUI();
        this.updateAmmoUI();
        this.setupInventoryUI();
        this.setupCheatUI();
        this.setupPickupUI();
    }

    setupCheatUI() {
        const cheatBtn = document.getElementById('cheatBtn');
        if (cheatBtn) {
            cheatBtn.addEventListener('click', () => {
                this.infiniteHealth = !this.infiniteHealth;
                cheatBtn.innerText = `Infinite Health: ${this.infiniteHealth ? 'ON' : 'OFF'}`;
                if (this.infiniteHealth) {
                    cheatBtn.classList.add('active');
                    this.health = 100; // Restore health
                    this.updateHealthUI();
                    this.updateSpeed();
                } else {
                    cheatBtn.classList.remove('active');
                }
            });
        }
    }
    
    setupPickupUI() {
        const yesBtn = document.getElementById('pickupYes');
        const noBtn = document.getElementById('pickupNo');
        
        if (yesBtn) {
            yesBtn.addEventListener('click', () => {
                this.collectItem();
                this.closePickupPrompt();
            });
        }
        
        if (noBtn) {
            noBtn.addEventListener('click', () => {
                this.closePickupPrompt();
            });
        }
    }

    updateWeaponState() {
        if (this.equippedWeapon) {
            this.gun.visible = true;
        } else {
            this.gun.visible = false;
        }
    }

    update(input, shootableObjects = [], obstacles = [], interactables = []) {
        const isSpaceDown = input.isKeyDown(' ');
        const isRDown = input.isKeyDown('r');
        const isIDown = input.isKeyDown('i');
        const isRunDown = input.isKeyDown('z'); // Z for Running

        // Toggle Inventory
        if (isIDown && !this.lastIState) {
            this.toggleInventory();
        }
        this.lastIState = isIDown;

        if (this.isInventoryOpen || this.isPickupPromptOpen) {
            return; // Pause game logic while inventory or prompt is open
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
        
        // Interaction Logic (Space)
        if (isSpaceDown && !this.lastSpaceState) {
            this.checkInteraction(interactables);
        }

        // Reload Logic (R key)
        // Only reload if weapon equipped
        if (isRDown && !this.lastRState && !this.isReloading && this.equippedWeapon && this.currentAmmoInClip < this.maxAmmoInClip && this.totalAmmo > 0) {
            this.reload();
        }

        // Check for Aiming (Shift)
        // Only aim if weapon equipped
        this.isAiming = input.isKeyDown('shift') && this.equippedWeapon;

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
            
            // Calculate potential new position
            let dx = 0;
            let dz = 0;
            
            if (input.isKeyDown('arrowup')) {
                dx -= Math.sin(this.container.rotation.y) * this.speed;
                dz -= Math.cos(this.container.rotation.y) * this.speed;
            }
            if (input.isKeyDown('arrowdown')) {
                dx += Math.sin(this.container.rotation.y) * this.speed;
                dz += Math.cos(this.container.rotation.y) * this.speed;
            }
            
            // Check collision independently for X and Z to allow sliding
            if (dx !== 0 || dz !== 0) {
                // Try moving X
                const newPosX = this.container.position.clone();
                newPosX.x += dx;
                if (!this.checkCollision(newPosX, obstacles)) {
                    this.container.position.x += dx;
                }

                // Try moving Z
                const newPosZ = this.container.position.clone();
                newPosZ.z += dz;
                if (!this.checkCollision(newPosZ, obstacles)) {
                    this.container.position.z += dz;
                }
            }
        }
        
        this.lastSpaceState = isSpaceDown;
        this.lastRState = isRDown;
    }
    
    checkInteraction(interactables) {
        const interactionRadius = 2.5; // Increased radius to account for height differences
        
        for (const item of interactables) {
            if (item.visible) {
                // Calculate 2D distance (XZ plane)
                const dx = this.container.position.x - item.position.x;
                const dz = this.container.position.z - item.position.z;
                const distance = Math.sqrt(dx*dx + dz*dz);
                
                if (distance < interactionRadius) {
                    if (item.userData.isCollectible) {
                        this.openPickupPrompt(item);
                        return;
                    } else if (item.userData.isDoor) {
                        this.tryOpenDoor();
                        return;
                    }
                }
            }
        }
    }
    
    tryOpenDoor() {
        // Check if player has the key
        const hasKey = this.inventory.some(item => item && item.id === 'key');
        
        if (hasKey) {
            this.finishGame();
        } else {
            this.showFeedback("It's locked. You need a key.");
        }
    }
    
    finishGame() {
        // Fade out and reload
        const fadeOverlay = document.getElementById('fadeOverlay');
        if (fadeOverlay) {
            fadeOverlay.style.opacity = '1';
            setTimeout(() => {
                window.location.reload();
            }, 500); // Wait for fade
        } else {
            window.location.reload();
        }
    }
    
    openPickupPrompt(item) {
        this.pendingCollectible = item;
        this.isPickupPromptOpen = true;
        
        const prompt = document.getElementById('pickupPrompt');
        const text = document.getElementById('pickupText');
        
        if (prompt && text) {
            text.innerText = `Will you take the ${item.userData.name}?`;
            prompt.style.display = 'flex';
        }
    }
    
    closePickupPrompt() {
        this.isPickupPromptOpen = false;
        this.pendingCollectible = null;
        
        const prompt = document.getElementById('pickupPrompt');
        if (prompt) {
            prompt.style.display = 'none';
        }
    }
    
    collectItem() {
        if (!this.pendingCollectible) return;
        
        const itemData = this.pendingCollectible.userData;
        
        if (itemData.type === 'ammo') {
            // Add to inventory
            // Check if ammo already exists
            const existingAmmo = this.inventory.find(i => i && i.id === 'ammo');
            if (existingAmmo) {
                existingAmmo.count += itemData.amount;
                this.totalAmmo = existingAmmo.count;
            } else {
                // Find empty slot
                const emptyIndex = this.inventory.findIndex(i => i === null);
                if (emptyIndex !== -1) {
                    this.inventory[emptyIndex] = { 
                        id: 'ammo', 
                        name: 'Ammo', 
                        type: 'ammo', 
                        count: itemData.amount, 
                        combinable: true, 
                        usable: false 
                    };
                    this.totalAmmo += itemData.amount;
                } else {
                    this.showFeedback("Inventory Full");
                    return;
                }
            }
            
            this.updateAmmoUI();
            this.showFeedback(`Picked up ${itemData.amount} Ammo`);
            
            // Remove from scene (hide it)
            this.pendingCollectible.visible = false;
        } else if (itemData.type === 'key') {
            // Add key to inventory
            const emptyIndex = this.inventory.findIndex(i => i === null);
            if (emptyIndex !== -1) {
                this.inventory[emptyIndex] = { 
                    id: 'key', 
                    name: 'Exit Key', 
                    type: 'key', 
                    combinable: false, 
                    usable: false 
                };
                this.showFeedback(`Picked up ${itemData.name}`);
                this.pendingCollectible.visible = false;
            } else {
                this.showFeedback("Inventory Full");
            }
        } else if (itemData.type === 'health') {
            // Add herb to inventory
            const emptyIndex = this.inventory.findIndex(i => i === null);
            if (emptyIndex !== -1) {
                this.inventory[emptyIndex] = { 
                    id: 'herb', 
                    name: 'Green Herb', 
                    type: 'health', 
                    amount: itemData.amount,
                    combinable: false, 
                    usable: true 
                };
                this.showFeedback(`Picked up ${itemData.name}`);
                this.pendingCollectible.visible = false;
            } else {
                this.showFeedback("Inventory Full");
            }
        }
    }
    
    checkCollision(position, obstacles) {
        // Simple bounding box check
        // Player radius approx 0.25, use slightly larger for safety
        const playerRadius = 0.3;
        
        // Create a box for the player at the new position
        const playerBox = new THREE.Box3();
        const min = new THREE.Vector3(position.x - playerRadius, 0, position.z - playerRadius);
        const max = new THREE.Vector3(position.x + playerRadius, 2, position.z + playerRadius);
        playerBox.set(min, max);
        
        for (const obstacle of obstacles) {
            if (obstacle.userData.boundingBox) {
                if (playerBox.intersectsBox(obstacle.userData.boundingBox)) {
                    return true;
                }
            }
        }
        return false;
    }

    toggleInventory() {
        this.isInventoryOpen = !this.isInventoryOpen;
        const invScreen = document.getElementById('inventoryScreen');
        const contextMenu = document.getElementById('contextMenu');
        
        if (this.isInventoryOpen) {
            if (invScreen) {
                invScreen.style.display = 'flex';
                this.combineSourceIndex = null; // Reset combine state on open
                this.renderInventory();
            }
        } else {
            if (invScreen) {
                invScreen.style.display = 'none';
                if (contextMenu) contextMenu.style.display = 'none'; // Hide context menu on close
            }
        }
    }

    setupInventoryUI() {
        // Close context menu on click outside
        document.addEventListener('click', (e) => {
            const contextMenu = document.getElementById('contextMenu');
            if (contextMenu && contextMenu.style.display === 'flex' && !e.target.closest('.inv-slot')) {
                contextMenu.style.display = 'none';
            }
            
            // Cancel combine if clicking outside slots
            if (this.combineSourceIndex !== null && !e.target.closest('.inv-slot')) {
                this.combineSourceIndex = null;
                this.renderInventory();
            }
        });
    }

    renderInventory() {
        const grid = document.getElementById('invGrid');
        if (!grid) return;
        
        grid.innerHTML = ''; // Clear current

        // Add instruction text if combining
        if (this.combineSourceIndex !== null) {
            const instruction = document.createElement('div');
            instruction.style.position = 'absolute';
            instruction.style.top = '80px';
            instruction.style.color = '#ff00ff'; // Purple text to match
            instruction.innerText = "Select item to combine with...";
            grid.appendChild(instruction);
        }

        this.inventory.forEach((item, index) => {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            
            // Highlight if selected for combine
            if (this.combineSourceIndex === index) {
                slot.style.borderColor = '#ff00ff'; // Purple
                slot.style.boxShadow = '0 0 10px #ff00ff';
            }

            if (item) {
                slot.classList.add('item');
                if (item.equipped) slot.classList.add('equipped');
                
                let text = item.name;
                
                // Show ammo count for weapon if equipped
                if (item.type === 'weapon' && item.equipped) {
                    text += `<br>${this.currentAmmoInClip}/${this.maxAmmoInClip}`;
                }
                
                if (item.count !== undefined) text += `<br>x${item.count}`;
                if (item.equipped) text += `<br>(Equipped)`;
                
                slot.innerHTML = text;
                
                // Click handler
                slot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    if (this.combineSourceIndex !== null) {
                        // If in combine mode, try to combine with this target
                        this.finishCombination(index);
                    } else {
                        // Otherwise show context menu
                        this.showContextMenu(e, item, index);
                    }
                });
            } else {
                // Empty slot click
                slot.addEventListener('click', (e) => {
                     if (this.combineSourceIndex !== null) {
                         // Cancel combine if clicking empty slot
                         this.combineSourceIndex = null;
                         this.renderInventory();
                     }
                });
            }
            grid.appendChild(slot);
        });
    }

    showContextMenu(event, item, index) {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) return;

        contextMenu.innerHTML = ''; // Clear options
        contextMenu.style.display = 'flex';
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.top = `${event.clientY}px`;

        // Define Actions
        const actions = [
            { 
                label: item.equipped ? 'Unequip' : 'Equip/Use', 
                action: () => this.useItem(index),
                enabled: item.usable || item.type === 'weapon' // Weapons can be equipped, ammo not usable directly here
            },
            { 
                label: 'Combine', 
                action: () => this.combineItem(index),
                enabled: item.combinable 
            },
            { 
                label: 'Examine', 
                action: () => this.examineItem(index),
                enabled: true 
            }
        ];

        actions.forEach(opt => {
            const div = document.createElement('div');
            div.className = 'context-option';
            div.innerText = opt.label;
            
            if (opt.enabled) {
                div.addEventListener('click', (e) => {
                    e.stopPropagation(); // Stop propagation to prevent immediate cancel by document listener
                    opt.action();
                    contextMenu.style.display = 'none';
                });
            } else {
                div.classList.add('disabled');
            }
            
            contextMenu.appendChild(div);
        });
    }

    useItem(index) {
        const item = this.inventory[index];
        if (!item) return;

        console.log(`Using ${item.name}`);
        
        if (item.type === 'weapon') {
            if (item.equipped) {
                this.unequipWeapon(item);
            } else {
                this.equipWeapon(item);
            }
            this.renderInventory(); // Refresh UI
        } else if (item.type === 'health') {
            // Heal logic
            this.health += item.amount;
            if (this.health > 100) this.health = 100;
            
            this.updateHealthUI();
            this.updateSpeed();
            this.showFeedback("Health Restored");
            
            // Remove item
            this.inventory[index] = null;
            this.renderInventory();
        }
    }

    equipWeapon(item) {
        // Unequip current if any
        if (this.equippedWeapon) {
            this.equippedWeapon.equipped = false;
        }
        
        item.equipped = true;
        this.equippedWeapon = item;
        this.updateWeaponState();
        console.log(`Equipped ${item.name}`);
    }

    unequipWeapon(item) {
        item.equipped = false;
        this.equippedWeapon = null;
        this.updateWeaponState();
        console.log(`Unequipped ${item.name}`);
    }

    combineItem(index) {
        console.log(`Combine selected for ${this.inventory[index].name}`);
        this.combineSourceIndex = index;
        this.renderInventory(); // Re-render to show highlight
    }

    finishCombination(targetIndex) {
        if (this.combineSourceIndex === targetIndex) {
            // Clicked same item, cancel
            this.combineSourceIndex = null;
            this.renderInventory();
            return;
        }

        const source = this.inventory[this.combineSourceIndex];
        const target = this.inventory[targetIndex];
        
        console.log(`Combining ${source.name} with ${target.name}`);

        // Logic for Handgun + Ammo
        if ((source.id === 'handgun' && target.id === 'ammo') || 
            (source.id === 'ammo' && target.id === 'handgun')) {
            
            // Find which one is the ammo item
            const ammoItem = source.id === 'ammo' ? source : target;
            this.instantReload(ammoItem);
        } else {
            console.log("Cannot combine these items.");
            // Show feedback on UI instead of alert
            this.showFeedback("This action cannot be done");
        }
        
        this.combineSourceIndex = null;
        this.renderInventory();
    }

    showFeedback(message) {
        // Create a temporary feedback element
        const feedback = document.createElement('div');
        feedback.style.position = 'absolute';
        feedback.style.bottom = '100px'; // Changed from top: 50% to bottom: 100px
        feedback.style.left = '50%';
        feedback.style.transform = 'translateX(-50%)'; // Changed from translate(-50%, -50%)
        feedback.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        feedback.style.color = 'white';
        feedback.style.padding = '20px';
        feedback.style.borderRadius = '5px';
        feedback.style.zIndex = '1000';
        feedback.innerText = message;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            if (document.body.contains(feedback)) {
                document.body.removeChild(feedback);
            }
        }, 2000);
    }

    instantReload(ammoItem) {
        if (this.currentAmmoInClip >= this.maxAmmoInClip) {
            console.log("Clip already full.");
            this.showFeedback("Clip is already full.");
            return;
        }

        const needed = this.maxAmmoInClip - this.currentAmmoInClip;
        const toLoad = Math.min(needed, ammoItem.count);
        
        if (toLoad <= 0) {
            console.log("No ammo.");
            this.showFeedback("No ammo remaining.");
            return;
        }

        this.currentAmmoInClip += toLoad;
        ammoItem.count -= toLoad;
        this.totalAmmo = ammoItem.count; // Sync total ammo tracking

        // If ammo depleted, remove item? Or keep empty? 
        // Usually keep empty or remove. Let's keep it for now or remove if 0.
        if (ammoItem.count === 0) {
            // Find index and remove? Or just leave as 0.
            // Leaving as 0 is fine for now.
        }

        this.updateAmmoUI();
        console.log("Reloaded via combination!");
        this.showFeedback("Reloaded!");
    }

    examineItem(index) {
        console.log(`Examining ${this.inventory[index].name}`);
        this.showFeedback(`It's a ${this.inventory[index].name}.`);
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
            
            // Update inventory ammo count
            const ammoItem = this.inventory.find(i => i && i.id === 'ammo');
            if (ammoItem) {
                ammoItem.count = this.totalAmmo;
            }
            
            this.isReloading = false;
            this.gun.material.color.setHex(originalColor);
            this.updateAmmoUI();
            if (this.isInventoryOpen) this.renderInventory(); // Refresh if open
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
        if (this.infiniteHealth) return false; // Cheat check

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