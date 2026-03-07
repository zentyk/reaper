import { store } from '../src/store.js'

export class UIManager {
    constructor() {
        this.callbacks = {
            onStart: null,
            onCheatToggle: null,
            onPickupYes: null,
            onPickupNo: null
        };

        this._bindEvents();
    }

    _bindEvents() {
        document.addEventListener('start-game', () => {
            if (this.callbacks.onStart) this.callbacks.onStart();
        });

        document.addEventListener('cheat-toggle', () => {
            if (this.callbacks.onCheatToggle) this.callbacks.onCheatToggle();
        });

        document.addEventListener('pickup-yes', () => {
            if (this.callbacks.onPickupYes) this.callbacks.onPickupYes();
        });

        document.addEventListener('pickup-no', () => {
            if (this.callbacks.onPickupNo) this.callbacks.onPickupNo();
        });
    }

    showStartScreen() {
        store.isStartScreenVisible = true;
    }

    hideStartScreen() {
        store.isStartScreenVisible = false;
    }

    showGameOver() {
        store.isGameOverVisible = true;
    }

    updateHealth(current, max) {
        store.healthPercent = (current / max) * 100;
        store.maxHealth = max;
    }

    updateAmmo(current, max) {
        store.ammoCurrent = current;
        store.ammoMax = max;
    }

    updateLevelText(level) {
        store.levelText = `Level ${level}`;
    }

    fadeIn() {
        const fadeOverlay = document.getElementById('fadeOverlay');
        if (fadeOverlay) {
            fadeOverlay.style.opacity = '1';
            void fadeOverlay.offsetWidth;
            requestAnimationFrame(() => {
                fadeOverlay.style.opacity = '0';
            });
        }
    }

    fadeOut(callback) {
        const fadeOverlay = document.getElementById('fadeOverlay');
        if (fadeOverlay) {
            fadeOverlay.style.opacity = '1';
            setTimeout(() => {
                if (callback) callback();
            }, 500);
        } else if (callback) {
            callback();
        }
    }

    showFeedback(message) {
        store.feedbackMessage = message;
        setTimeout(() => {
            if (store.feedbackMessage === message) {
                store.feedbackMessage = '';
            }
        }, 2000);
    }

    // Inventory UI methods
    toggleInventory(isOpen) {
        store.isInventoryVisible = isOpen;
        if (!isOpen) {
            this.hideContextMenu();
        }
    }

    renderInventory(inventory, combineSourceIndex, onSlotClick) {
        store.inventory = inventory;
        store.combineSourceIndex = combineSourceIndex;

        // Unbind previous event listener to avoid stacking
        if (this._inventorySlotClickListener) {
            document.removeEventListener('slot-click', this._inventorySlotClickListener);
        }

        this._inventorySlotClickListener = (e) => {
            onSlotClick(e.detail.index, e.detail.x, e.detail.y);
        };

        document.addEventListener('slot-click', this._inventorySlotClickListener);
    }

    showContextMenu(x, y, actions) {
        store.contextMenu = {
            visible: true,
            x,
            y,
            options: actions
        };
    }

    hideContextMenu() {
        store.contextMenu.visible = false;
    }

    showPickupPrompt(itemName) {
        store.pickupPrompt.text = itemName;
        store.isPickupPromptVisible = true;
    }

    hidePickupPrompt() {
        store.isPickupPromptVisible = false;
    }
}