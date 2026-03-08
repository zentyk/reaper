import * as THREE from 'three';
import { Input } from './core/Input.js';
import { store } from '../src/store.js';

export class Player {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        this.input = new Input();

        // Inventory Logic
        this.isInventoryOpen = false;
        this.combineSourceIndex = null;
        this.lastIState = false;

        this.inventory = [
            { id: 'handgun', name: 'Handgun', type: 'weapon', equipped: true, combinable: true, usable: false, ammo: 15 },
            { id: 'ammo', name: 'Ammo', type: 'ammo', count: 30, combinable: true, usable: false },
            null, null, null, null
        ];

        // Knife / Tofu weapon animation state
        this.knifeSwayTime = 0;
        this.knifeStabbing = false;
        this.knifeStabTimer = 0;
        this.knifeBasePos = null; // will be set on first frame
        this.knifeBaseRot = null;

        // Body / walking animation state
        this.bodyBobTime = 0;
        this.bodyBaseY = null; // captured on first frame
        this.hitStaggering = false;
        this.hitStaggerTimer = 0;

        this.pendingCollectible = null;
        this.isPickupPromptOpen = false;

        // Flashlight setup
        this.flashlight = new THREE.SpotLight(0xffffff, 100); // Color, Intensity (high for realistic falloff)
        this.flashlight.angle = Math.PI / 6; // Narrow beam (30 degrees)
        this.flashlight.penumbra = 0.5; // Soft edges
        this.flashlight.decay = 2; // Realistic light decay
        this.flashlight.distance = 25; // How far the light reaches
        this.flashlight.castShadow = true;
        this.flashlight.shadow.mapSize.width = 1024;
        this.flashlight.shadow.mapSize.height = 1024;

        // Target for the spotlight to point at
        this.flashlightTarget = new THREE.Object3D();
        this.scene.add(this.flashlightTarget);
        this.flashlight.target = this.flashlightTarget;

        this.scene.add(this.flashlight);

        this.setupCheatUI();
        this.setupPickupUI();
        this.setupDiscardUI();
    }

    setupCheatUI() {
        document.addEventListener('cheat-toggle', () => {
            // Toggle cheat on ECS entity
            const playerEntity = this.game.world.entities.find(e => e.components.PlayerTag);
            if (playerEntity && playerEntity.components.Health) {
                playerEntity.components.Health.current = 100;
                this.game.ui.updateHealth(100, 100);
            }
        });

        document.addEventListener('collider-cheat-toggle', () => {
            this.game.showColliders = !this.game.showColliders;
            const btn = document.querySelector('#colliderCheatBtn');
            if (btn) {
                btn.innerText = `Show Colliders: ${this.game.showColliders ? 'ON' : 'OFF'}`;
                btn.classList.toggle('hud__cheat-btn--active', this.game.showColliders);
            }
            this.game.toggleColliderVisuals(this.game.showColliders);
        });
    }

    setupDiscardUI() {
        document.addEventListener('discard-yes', () => {
            console.log("Player.js: received discard-yes event, discardItemIndex:", store.discardItemIndex);
            if (store.discardItemIndex !== null) {
                this.inventory[store.discardItemIndex] = null;
                store.discardItemIndex = null;
                store.discardItemName = '';
                this.renderInventory();
            }
        });

        document.addEventListener('discard-no', () => {
            console.log("Player.js: received discard-no event");
            store.discardItemIndex = null;
            store.discardItemName = '';
        });
    }

    setupPickupUI() {
        document.addEventListener('pickup-yes', () => {
            console.log("Player.js: [pickup-yes] store.isPickupMode:", store.isPickupMode);
            if (store.isPickupMode) {
                this.collectItem();
                this.closePickupPrompt();
            }
        });

        document.addEventListener('pickup-no', () => {
            console.log("Player.js: [pickup-no] store.isPickupMode:", store.isPickupMode);
            if (store.isPickupMode) {
                this.closePickupPrompt();
            }
        });

        // Handle Escape/Exit buttons from the Vue UI returning to Gameplay
        document.addEventListener('inventory-close', () => {
            this.isInventoryOpen = false;
            this.game.isPaused = false;
            store.isInventoryVisible = false;
            // Clear interaction target when inventory closes
            store.interactTarget = null;
        });
    }

    update() {
        // Only handle UI toggles here. Gameplay is in Systems.
        const isIDown = this.input.isKeyDown('i');

        if (isIDown && !this.lastIState) {
            this.toggleInventory();
        }
        this.lastIState = isIDown;

        // Sync UI and Visuals with ECS data
        const playerEntity = this.game.world.entities.find(e => e.components.PlayerTag);
        if (playerEntity) {
            const health = playerEntity.components.Health;
            if (health) {
                this.game.ui.updateHealth(health.current, health.max);
            }

            // Sync Flashlight
            const transform = playerEntity.components.Transform;
            if (transform && this.flashlight) {
                // Position light slightly above and offset to the right (like over the shoulder)
                this.flashlight.position.set(transform.position.x, transform.position.y + 1.2, transform.position.z);

                // Calculate forward vector based on rotation
                const forward = new THREE.Vector3(0, 0, -1);
                forward.applyEuler(transform.rotation);

                // Set target slightly ahead and down
                this.flashlightTarget.position.copy(transform.position).add(forward.multiplyScalar(5));
                this.flashlightTarget.position.y = transform.position.y + 0.3;
            }
        }

        // Animate knife (Tofu-style)
        this._updateKnifeAnimation();

        // Animate Tofu body sway / walk bob
        this._updateBodyAnimation();
    }

    _updateBodyAnimation() {
        const container = this.container;
        if (!container) return;

        const playerEntity = this.entity;
        if (!playerEntity) return;
        const input = playerEntity.components.InputState;
        const transform = playerEntity.components.Transform;
        if (!input || !transform) return;

        const isMoving = input.forward || input.backward || input.left || input.right;
        const isRunning = isMoving && input.run;
        const dt = 0.016;
        const lerpSpeed = 0.14;

        // Init lean fields on transform if absent
        if (transform.leanX === undefined) transform.leanX = 0;
        if (transform.leanZ === undefined) transform.leanZ = 0;

        // Capture base Y on first frame
        if (this.bodyBaseY === null) {
            this.bodyBaseY = container.position.y;
        }

        if (this.hitStaggering) {
            // --- Hit Stagger: stumble backward ---
            this.hitStaggerTimer += dt;
            const total = 0.4;
            const t = Math.min(this.hitStaggerTimer / total, 1.0);
            const stagger = Math.sin(t * Math.PI);

            transform.leanX = -stagger * 0.38;
            transform.leanZ = Math.sin(t * Math.PI * 2) * 0.14;
            container.position.y = (this.bodyBaseY || 0) - stagger * 0.15;

            if (t >= 1.0) {
                this.hitStaggering = false;
                this.hitStaggerTimer = 0;
                transform.leanX = 0;
                transform.leanZ = 0;
                container.position.y = this.bodyBaseY || 0;
            }
            return;
        }

        // --- Compute lean targets based on directional input ---
        // Forward = lean into movement; Backward = lean backward (stronger recoil feel)
        let targetLeanX = 0;
        if (input.forward) targetLeanX = isRunning ? 0.25 : 0.16;
        if (input.backward) targetLeanX = isRunning ? -0.35 : -0.24;

        // Strafe left/right tilt (relative to the player's facing which is transform.rotation.y)
        let targetLeanZ = 0;
        if (input.left) targetLeanZ = isRunning ? 0.20 : 0.13;
        if (input.right) targetLeanZ = isRunning ? -0.20 : -0.13;

        // Smooth lerp toward targets — written to transform so MovementSystem picks them up
        transform.leanX += (targetLeanX - transform.leanX) * lerpSpeed;
        transform.leanZ += (targetLeanZ - transform.leanZ) * lerpSpeed;

        if (isMoving) {
            // --- Walking bob (Y position) ---
            const speed = isRunning ? 9 : 6;
            this.bodyBobTime += dt * speed;

            const bobAmt = isRunning ? 0.07 : 0.04;
            container.position.y = (this.bodyBaseY || 0) + Math.abs(Math.sin(this.bodyBobTime)) * bobAmt;

            // Layer a subtle waddle sway ON TOP of the directional lean
            const swayAmt = isRunning ? 0.04 : 0.025;
            transform.leanZ += Math.sin(this.bodyBobTime) * swayAmt;
        } else {
            // Damp Y bob back to rest
            container.position.y += ((this.bodyBaseY || 0) - container.position.y) * 0.15;
        }
    }

    triggerHitStagger() {
        if (!this.container || this.hitStaggering) return;
        this.hitStaggering = true;
        this.hitStaggerTimer = 0;
    }

    _updateKnifeAnimation() {
        const knife = this.gun;
        if (!knife) return;

        // Capture base position on first call
        if (!this.knifeBasePos) {
            this.knifeBasePos = knife.position.clone();
            this.knifeBaseRot = knife.rotation.clone();
        }

        const dt = 0.016;

        // --- Reload Animation (takes priority over everything else) ---
        const playerEntity = this.entity;
        const weapon = playerEntity && playerEntity.components.Weapon;
        const reloadDuration = 1.5;
        if (weapon && weapon.reloadTimer > 0) {
            // t goes 0→1 as the reload progresses (timer counts DOWN from 1.5)
            const t = 1.0 - (weapon.reloadTimer / reloadDuration);

            if (t < 0.3) {
                // Phase 1: Drop the weapon down to hip and tilt outward (0–30%)
                const p = t / 0.3;
                const ease = 1 - Math.pow(1 - p, 2);
                knife.position.y = this.knifeBasePos.y - ease * 0.55;
                knife.position.x = this.knifeBasePos.x - ease * 0.12;
                knife.rotation.x = this.knifeBaseRot.x + ease * 0.8; // tilt muzzle down
                knife.rotation.z = this.knifeBaseRot.z + ease * 0.5; // swing outward
            } else if (t < 0.7) {
                // Phase 2: Hold low — "swap the mag" wobble (30–70%)
                const p = (t - 0.3) / 0.4;
                const wobble = Math.sin(p * Math.PI * 3) * 0.08; // small tap animation
                knife.position.y = this.knifeBasePos.y - 0.55 + wobble;
                knife.position.x = this.knifeBasePos.x - 0.12;
                knife.rotation.x = this.knifeBaseRot.x + 0.8;
                knife.rotation.z = this.knifeBaseRot.z + 0.5 + wobble;
            } else {
                // Phase 3: Raise back up to aiming position (70–100%)
                const p = (t - 0.7) / 0.3;
                const ease = 1 - Math.pow(1 - p, 3);
                knife.position.y = (this.knifeBasePos.y - 0.55) + ease * 0.55;
                knife.position.x = (this.knifeBasePos.x - 0.12) + ease * 0.12;
                knife.rotation.x = (this.knifeBaseRot.x + 0.8) - ease * 0.8;
                knife.rotation.z = (this.knifeBaseRot.z + 0.5) - ease * 0.5;
            }
            return; // Skip all other animation while reloading
        }

        if (this.knifeStabbing) {
            this.knifeStabTimer += dt;
            const kickDuration = 0.08;   // Fast snap upward (like real gun recoil)
            const returnDuration = 0.22; // Slower settle back
            const total = kickDuration + returnDuration;

            if (this.knifeStabTimer < kickDuration) {
                // Phase 1: Snap UP and slightly BACK — gun recoil impulse
                const p = this.knifeStabTimer / kickDuration;
                const ease = 1 - Math.pow(1 - p, 2);
                knife.position.y = this.knifeBasePos.y + ease * 0.18;
                knife.position.z = this.knifeBasePos.z + ease * 0.12; // Kick back
                knife.rotation.x = this.knifeBaseRot.x - ease * 0.35; // Muzzle flip up
            } else if (this.knifeStabTimer < total) {
                // Phase 2: Float back down smoothly
                const p = (this.knifeStabTimer - kickDuration) / returnDuration;
                const ease = 1 - Math.pow(1 - p, 3);
                knife.position.y = (this.knifeBasePos.y + 0.18) - ease * 0.18;
                knife.position.z = (this.knifeBasePos.z + 0.12) - ease * 0.12;
                knife.rotation.x = (this.knifeBaseRot.x - 0.35) + ease * 0.35;
            } else {
                // Reset
                knife.position.copy(this.knifeBasePos);
                knife.rotation.copy(this.knifeBaseRot);
                this.knifeStabbing = false;
                this.knifeStabTimer = 0;
            }
        } else {
            // Idle sway: gentle arm hold breathing motion
            this.knifeSwayTime += dt * 1.2;
            const sway = Math.sin(this.knifeSwayTime) * 0.004;
            const bob = Math.cos(this.knifeSwayTime * 0.6) * 0.003;
            knife.position.y = this.knifeBasePos.y + sway;
            knife.position.x = this.knifeBasePos.x + bob;
            knife.rotation.z = this.knifeBaseRot.z + bob * 0.2;
        }
    }

    toggleInventory() {
        this.isInventoryOpen = !this.isInventoryOpen;
        this.game.isPaused = this.isInventoryOpen;
        this.game.ui.toggleInventory(this.isInventoryOpen);

        if (this.isInventoryOpen) {
            this.combineSourceIndex = null;
            this.renderInventory();
        }
    }

    renderInventory() {
        // Sync ECS ammo data into the raw UI weapon object
        const weaponItem = this.inventory.find(i => i && i.type === 'weapon');
        const playerEntity = this.game.world.entities.find(e => e.components.PlayerTag);

        if (weaponItem && playerEntity && playerEntity.components.Weapon) {
            weaponItem.ammo = playerEntity.components.Weapon.ammo;
        }

        this.game.ui.renderInventory(
            this.inventory,
            this.combineSourceIndex,
            (index, x, y) => this.handleInventoryClick(index, x, y)
        );
    }

    handleInventoryClick(index, x, y) {
        if (this.combineSourceIndex !== null) {
            this.finishCombination(index);
        } else if (this.inventory[index]) {
            const item = this.inventory[index];
            const actions = [
                {
                    label: item.equipped ? 'Unequip' : 'Equip/Use',
                    action: () => this.useItem(index),
                    enabled: item.usable || item.type === 'weapon' || item.type === 'key'
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
            this.game.ui.showContextMenu(x, y, actions);
        }
    }

    useItem(index) {
        const item = this.inventory[index];
        if (!item) return;

        if (item.type === 'weapon') {
            if (item.equipped) this.unequipWeapon(item);
            else this.equipWeapon(item);
            this.renderInventory();
        } else if (item.type === 'health') {
            const playerEntity = this.game.world.entities.find(e => e.components.PlayerTag);
            if (playerEntity && playerEntity.components.Health) {
                const health = playerEntity.components.Health;
                health.current = Math.min(100, health.current + item.amount);
                this.game.ui.examineItem("Health Restored");
                this.inventory[index] = null;
                this.renderInventory();
            }
        } else if (item.type === 'key') {
            const door = store.interactTarget;
            if (door && door.components.DoorTag && door.components.DoorTag.isLocked) {
                if (door.components.DoorTag.requiredKeyId === item.id) {
                    door.components.DoorTag.isLocked = false;
                    this.game.ui.showFeedback(`Used the ${item.name}.`);

                    // Persist the unlock
                    const doorId = door.persistentId || door.id;
                    if (doorId) {
                        this.game.gameState.recordDoorUnlocked(this.game.levelManager.currentLevel, doorId);
                    }

                    // Check if key is spent
                    if (this.isKeySpent(item.id)) {
                        store.discardItemIndex = index;
                        store.discardItemName = item.name;
                    }

                    this.renderInventory();
                } else {
                    this.game.ui.examineItem("That won't work here.");
                }
            } else {
                this.game.ui.examineItem("You can't use that here.");
            }
        }
    }

    isKeySpent(keyId) {
        // Logic: Check if any other doors in the world still require this key and are locked
        const doors = this.game.world.entities.filter(e => e.components.DoorTag);
        return !doors.some(d => d.components.DoorTag.requiredKeyId === keyId && d.components.DoorTag.isLocked);
    }

    equipWeapon(item) {
        // Find currently equipped and unequip
        const current = this.inventory.find(i => i && i.equipped && i.type === 'weapon');
        if (current) current.equipped = false;

        item.equipped = true;

        // Update ECS Weapon component
        const playerEntity = this.game.world.entities.find(e => e.components.PlayerTag);
        if (playerEntity && playerEntity.components.Weapon) {
            playerEntity.components.Weapon.isEquipped = true;
            // Also show gun mesh
            if (playerEntity.components.MeshComponent && playerEntity.components.MeshComponent.gun) {
                playerEntity.components.MeshComponent.gun.visible = true;
            }
        }
    }

    unequipWeapon(item) {
        item.equipped = false;

        // Update ECS Weapon component
        const playerEntity = this.game.world.entities.find(e => e.components.PlayerTag);
        if (playerEntity && playerEntity.components.Weapon) {
            playerEntity.components.Weapon.isEquipped = false;
            // Hide gun mesh
            if (playerEntity.components.MeshComponent && playerEntity.components.MeshComponent.gun) {
                playerEntity.components.MeshComponent.gun.visible = false;
            }
        }
    }

    combineItem(index) {
        this.combineSourceIndex = index;
        this.renderInventory();
    }

    finishCombination(targetIndex) {
        if (this.combineSourceIndex === targetIndex) {
            this.combineSourceIndex = null;
            this.renderInventory();
            return;
        }

        const source = this.inventory[this.combineSourceIndex];
        const target = this.inventory[targetIndex];

        if ((source.id === 'handgun' && target.id === 'ammo') ||
            (source.id === 'ammo' && target.id === 'handgun')) {
            const ammoItem = source.id === 'ammo' ? source : target;
            this.instantReload(ammoItem);
        } else {
            this.game.ui.examineItem("This action cannot be done");
        }

        this.combineSourceIndex = null;
        this.renderInventory();
    }

    instantReload(ammoItem) {
        const playerEntity = this.game.world.entities.find(e => e.components.PlayerTag);
        if (!playerEntity || !playerEntity.components.Weapon) return;

        const weapon = playerEntity.components.Weapon;

        if (weapon.ammo >= weapon.maxAmmo) {
            this.game.ui.examineItem("Clip is already full.");
            return;
        }

        const needed = weapon.maxAmmo - weapon.ammo;
        const toLoad = Math.min(needed, ammoItem.count);

        if (toLoad <= 0) {
            this.game.ui.examineItem("No ammo remaining.");
            return;
        }

        weapon.ammo += toLoad;
        ammoItem.count -= toLoad;

        this.game.ui.examineItem("Reloaded!");
        this.game.ui.updateAmmo(weapon.ammo, ammoItem.count); // Update UI immediately
    }

    examineItem(index) {
        this.game.ui.examineItem(`It's a ${this.inventory[index].name}.`);
    }

    // Pickup Logic
    openPickupPrompt(item) {
        this.game.isPaused = true;
        this.isPickupMode = true;
        this.pendingCollectible = item;
        this.renderInventory();
        this.game.ui.openPickupMode(item.components.CollectibleTag.name);
    }

    closePickupPrompt() {
        console.log("Player.js: closing pickup prompt");
        this.game.isPaused = false;
        this.isPickupMode = false;
        this.pendingCollectible = null;
        this.game.ui.closePickupMode();

        // Consume the spacebar so we don't instantly interact again on unpause
        if (this.game.input) {
            this.game.input.downKeys[' '] = false;
            this.game.input.keys[' '] = false;
        }

        // Final force hide
        store.isInventoryVisible = false;
        store.isPickupMode = false;
    }

    collectItem() {
        if (!this.pendingCollectible) return;

        const tag = this.pendingCollectible.components.CollectibleTag;

        // Use persistentId if available, otherwise fallback to mesh userData
        const id = this.pendingCollectible.persistentId ||
            (this.pendingCollectible.components.MeshComponent && this.pendingCollectible.components.MeshComponent.mesh.userData.id);

        if (id) {
            this.game.itemCollected(id);
        } else {
            console.warn("Collected item has no ID, persistence will fail.");
        }

        // Add to inventory logic
        if (tag.type === 'ammo') {
            const existing = this.inventory.find(i => i && i.id === 'ammo');
            if (existing) existing.count += tag.amount;
            else {
                const empty = this.inventory.findIndex(i => i === null);
                if (empty !== -1) this.inventory[empty] = { id: 'ammo', name: 'Ammo', type: 'ammo', count: tag.amount, combinable: true };
            }
            this.game.ui.showFeedback(`Picked up ${tag.amount} Ammo`);

            // Update UI immediately
            const playerEntity = this.game.world.entities.find(e => e.components.PlayerTag);
            if (playerEntity && playerEntity.components.Weapon) {
                const ammoItem = this.inventory.find(i => i && i.id === 'ammo');
                this.game.ui.updateAmmo(playerEntity.components.Weapon.ammo, ammoItem ? ammoItem.count : 0);
            }

        } else if (tag.type === 'key') {
            const empty = this.inventory.findIndex(i => i === null);
            if (empty !== -1) {
                this.inventory[empty] = {
                    id: tag.id || id || 'key',
                    name: tag.name || 'Key',
                    type: 'key',
                    combinable: false
                };
            }
            this.game.ui.showFeedback(`Picked up ${tag.name || 'Key'}`);
        } else if (tag.type === 'health') {
            const empty = this.inventory.findIndex(i => i === null);
            if (empty !== -1) {
                this.inventory[empty] = {
                    id: 'herb',
                    name: 'Green Herb',
                    type: 'health',
                    amount: tag.amount,
                    combinable: false,
                    usable: true
                };
            }
            this.game.ui.showFeedback(`Picked up ${tag.name || 'Health'}`);
        }

        // Remove from scene
        if (this.pendingCollectible.components.MeshComponent) {
            this.game.scene.remove(this.pendingCollectible.components.MeshComponent.mesh);
        }
        this.pendingCollectible.isDestroyed = true;
    }

    // Door Logic
    tryOpenDoor(door) {
        const doorTag = door.components.DoorTag;
        if (doorTag.isLocked) {
            this.game.ui.showFeedback("The door is locked.");
            store.interactTarget = door;
        } else {
            this.initiateLevelChange(doorTag.targetLevel);
        }
    }

    initiateLevelChange(targetLevel) {
        // Fade out and load next level
        this.game.audio.fadeOutMusic();

        const fadeOverlay = document.getElementById('fadeOverlay');
        if (fadeOverlay) {
            fadeOverlay.style.opacity = '1';
            setTimeout(() => {
                this.game.changeLevel(targetLevel);
            }, 500); // Wait for fade
        } else {
            this.game.changeLevel(targetLevel);
        }
    }
}