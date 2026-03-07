import * as THREE from 'three';
import { Input } from './core/Input.js';

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

        // Pickup Logic
        this.pendingCollectible = null;
        this.isPickupPromptOpen = false;

        this.setupCheatUI();
        this.setupPickupUI();
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

    setupPickupUI() {
        document.addEventListener('pickup-yes', () => {
            if (this.isPickupMode) {
                this.collectItem();
                this.closePickupPrompt();
            }
        });

        document.addEventListener('pickup-no', () => {
            if (this.isPickupMode) {
                this.closePickupPrompt();
            }
        });

        // Handle Escape/Exit buttons from the Vue UI returning to Gameplay
        document.addEventListener('inventory-close', () => {
            this.isInventoryOpen = false;
            this.game.isPaused = false;
        });
    }

    update() {
        // Only handle UI toggles here. Gameplay is in Systems.
        const isIDown = this.input.isKeyDown('i');

        if (isIDown && !this.lastIState) {
            this.toggleInventory();
        }
        this.lastIState = isIDown;

        // Sync UI with ECS data
        const playerEntity = this.game.world.entities.find(e => e.components.PlayerTag);
        if (playerEntity) {
            const health = playerEntity.components.Health;

            if (health) {
                this.game.ui.updateHealth(health.current, health.max);
            }
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
                    enabled: item.usable || item.type === 'weapon'
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
        }
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
        this.game.isPaused = false;
        this.isPickupMode = false;
        this.pendingCollectible = null;
        this.game.ui.closePickupMode();
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
            if (empty !== -1) this.inventory[empty] = { id: 'key', name: 'Exit Key', type: 'key', combinable: false };
            this.game.ui.showFeedback(`Picked up ${tag.name}`);
        } else if (tag.type === 'health') {
            const empty = this.inventory.findIndex(i => i === null);
            if (empty !== -1) this.inventory[empty] = { id: 'herb', name: 'Green Herb', type: 'health', amount: tag.amount, combinable: false, usable: true };
            this.game.ui.showFeedback(`Picked up ${tag.name}`);
        }

        // Remove from scene
        if (this.pendingCollectible.components.MeshComponent) {
            this.game.scene.remove(this.pendingCollectible.components.MeshComponent.mesh);
        }
        this.pendingCollectible.isDestroyed = true;
    }

    // Door Logic
    tryOpenDoor(door) {
        // Check if player has the key
        const hasKey = this.inventory.some(item => item && item.id === 'key');

        if (hasKey) {
            this.initiateLevelChange(door.components.DoorTag.targetLevel);
        } else {
            this.game.ui.showFeedback("It's locked. You need a key.");
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