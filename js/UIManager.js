export class UIManager {
    constructor() {
        this.screens = {
            start: document.getElementById('startScreen'),
            gameOver: document.getElementById('gameOverScreen'),
            inventory: document.getElementById('inventoryScreen'),
            hud: document.getElementById('hud'),
            pickupPrompt: document.getElementById('pickupPrompt'),
            fadeOverlay: document.getElementById('fadeOverlay'),
            contextMenu: document.getElementById('contextMenu')
        };

        this.elements = {
            levelText: document.getElementById('levelText')
        };

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
        // Redundant realistically, but retained for schema completeness
    }

    hideStartScreen() {
        console.log("Nuking Start Screen");
        if (this.screens.start && this.screens.start.parentNode) {
            this.screens.start.parentNode.removeChild(this.screens.start);
            this.screens.start = null;
        }

        if (this.screens.hud) this.screens.hud.show();
    }

    showGameOver() {
        if (this.screens.gameOver) this.screens.gameOver.show();
    }

    updateHealth(current, max) {
        if (this.screens.hud) this.screens.hud.updateHealth(current, max);
    }

    updateAmmo(current, max) {
        if (this.screens.hud) this.screens.hud.updateAmmo(current, max);
    }

    updateLevelText(level) {
        this.elements.levelText.innerText = `Level ${level}`;
    }

    fadeIn() {
        this.screens.fadeOverlay.style.opacity = '1';
        void this.screens.fadeOverlay.offsetWidth;
        requestAnimationFrame(() => {
            this.screens.fadeOverlay.style.opacity = '0';
        });
    }

    fadeOut(callback) {
        this.screens.fadeOverlay.style.opacity = '1';
        setTimeout(() => {
            if (callback) callback();
        }, 500);
    }

    showFeedback(message) {
        const feedback = document.createElement('div');
        feedback.className = 'feedback-message';
        feedback.innerText = message;

        document.body.appendChild(feedback);
        setTimeout(() => {
            if (document.body.contains(feedback)) document.body.removeChild(feedback);
        }, 2000);
    }

    // Inventory UI methods
    toggleInventory(isOpen) {
        if (isOpen) {
            if (this.screens.inventory) this.screens.inventory.show();
        } else {
            if (this.screens.inventory) this.screens.inventory.hide();
            this.hideContextMenu();
        }
    }

    renderInventory(inventory, combineSourceIndex, onSlotClick) {
        // Unbind previous event listener to avoid stacking
        if (this._inventorySlotClickListener) {
            document.removeEventListener('slot-click', this._inventorySlotClickListener);
        }

        this._inventorySlotClickListener = (e) => {
            onSlotClick(e.detail.index, e.detail.x, e.detail.y);
        };

        document.addEventListener('slot-click', this._inventorySlotClickListener);

        if (this.screens.inventory) {
            this.screens.inventory.renderItems(inventory, combineSourceIndex);
        }
    }

    showContextMenu(x, y, actions) {
        if (this.screens.contextMenu) this.screens.contextMenu.show(x, y, actions);
    }

    hideContextMenu() {
        if (this.screens.contextMenu) this.screens.contextMenu.hide();
    }

    showPickupPrompt(itemName) {
        if (this.screens.pickupPrompt) this.screens.pickupPrompt.show(itemName);
    }

    hidePickupPrompt() {
        if (this.screens.pickupPrompt) this.screens.pickupPrompt.hide();
    }
}