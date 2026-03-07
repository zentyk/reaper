export class UIManager {
    constructor() {
        this.screens = {
            start: document.getElementById('startScreen'),
            gameOver: document.getElementById('gameOverScreen'),
            inventory: document.getElementById('inventoryScreen'),
            uiContainer: document.getElementById('uiContainer'),
            pickupPrompt: document.getElementById('pickupPrompt'),
            fadeOverlay: document.getElementById('fadeOverlay'),
            contextMenu: document.getElementById('contextMenu')
        };

        this.elements = {
            healthBar: document.getElementById('healthValue'),
            ammoValue: document.getElementById('ammoValue'),
            levelText: document.getElementById('levelText'),
            pickupText: document.getElementById('pickupText'),
            invGrid: document.getElementById('invGrid'),
            cheatBtn: document.getElementById('cheatBtn'),
            pickupYes: document.getElementById('pickupYes'),
            pickupNo: document.getElementById('pickupNo')
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
        const startBtn = document.getElementById('startButton');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (this.callbacks.onStart) this.callbacks.onStart();
            });
        }

        if (this.elements.cheatBtn) {
            this.elements.cheatBtn.addEventListener('click', () => {
                if (this.callbacks.onCheatToggle) this.callbacks.onCheatToggle();
            });
        }

        if (this.elements.pickupYes) {
            this.elements.pickupYes.addEventListener('click', () => {
                if (this.callbacks.onPickupYes) this.callbacks.onPickupYes();
            });
        }

        if (this.elements.pickupNo) {
            this.elements.pickupNo.addEventListener('click', () => {
                if (this.callbacks.onPickupNo) this.callbacks.onPickupNo();
            });
        }
    }

    showStartScreen() {
        // Should not be called after start, but for completeness
        if (this.screens.start) {
            this.screens.start.style.display = 'flex';
        }
        this.screens.uiContainer.style.display = 'none';
    }

    hideStartScreen() {
        console.log("Nuking Start Screen");
        // Completely remove it from the DOM to ensure it can't block anything
        if (this.screens.start && this.screens.start.parentNode) {
            this.screens.start.parentNode.removeChild(this.screens.start);
            this.screens.start = null; // Clear reference
        }
        
        this.screens.uiContainer.classList.remove('hidden');
        this.screens.uiContainer.style.display = 'flex';
    }

    showGameOver() {
        this.screens.gameOver.classList.remove('hidden');
        this.screens.gameOver.style.display = 'flex';
    }

    updateHealth(current, max) {
        const percent = (current / max) * 100;
        this.elements.healthBar.style.width = `${percent}%`;
        if (percent > 50) this.elements.healthBar.style.backgroundColor = 'green';
        else if (percent > 25) this.elements.healthBar.style.backgroundColor = 'yellow';
        else this.elements.healthBar.style.backgroundColor = 'red';
    }

    updateAmmo(current, max) {
        this.elements.ammoValue.innerText = `${current} / ${max}`;
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
        feedback.style.position = 'absolute';
        feedback.style.bottom = '100px';
        feedback.style.left = '50%';
        feedback.style.transform = 'translateX(-50%)';
        feedback.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        feedback.style.color = 'white';
        feedback.style.padding = '20px';
        feedback.style.borderRadius = '5px';
        feedback.style.zIndex = '1000';
        feedback.innerText = message;
        
        document.body.appendChild(feedback);
        setTimeout(() => {
            if (document.body.contains(feedback)) document.body.removeChild(feedback);
        }, 2000);
    }

    // Inventory UI methods
    toggleInventory(isOpen) {
        if (isOpen) {
            this.screens.inventory.classList.remove('hidden');
            this.screens.inventory.style.display = 'flex';
        } else {
            this.screens.inventory.classList.add('hidden');
            this.screens.inventory.style.display = 'none';
            this.hideContextMenu();
        }
    }

    renderInventory(inventory, combineSourceIndex, onSlotClick) {
        this.elements.invGrid.innerHTML = '';

        if (combineSourceIndex !== null) {
            const instruction = document.createElement('div');
            instruction.style.position = 'absolute';
            instruction.style.top = '80px';
            instruction.style.color = '#ff00ff';
            instruction.innerText = "Select item to combine with...";
            this.elements.invGrid.appendChild(instruction);
        }

        inventory.forEach((item, index) => {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            
            if (combineSourceIndex === index) {
                slot.style.borderColor = '#ff00ff';
                slot.style.boxShadow = '0 0 10px #ff00ff';
            }

            if (item) {
                slot.classList.add('item');
                if (item.equipped) slot.classList.add('equipped');
                
                let text = item.name;
                if (item.type === 'weapon' && item.equipped) {
                    // Assuming we can get ammo info from item or passed in. 
                    // For now just name.
                }
                if (item.count !== undefined) text += `<br>x${item.count}`;
                if (item.equipped) text += `<br>(Equipped)`;
                
                slot.innerHTML = text;
                
                slot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onSlotClick(index, e.clientX, e.clientY);
                });
            } else {
                slot.addEventListener('click', (e) => {
                    onSlotClick(index, null, null);
                });
            }
            this.elements.invGrid.appendChild(slot);
        });
    }

    showContextMenu(x, y, actions) {
        this.screens.contextMenu.innerHTML = '';
        this.screens.contextMenu.classList.remove('hidden');
        this.screens.contextMenu.style.display = 'flex';
        this.screens.contextMenu.style.left = `${x}px`;
        this.screens.contextMenu.style.top = `${y}px`;

        actions.forEach(opt => {
            const div = document.createElement('div');
            div.className = 'context-option';
            div.innerText = opt.label;
            
            if (opt.enabled) {
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    opt.action();
                    this.hideContextMenu();
                });
            } else {
                div.classList.add('disabled');
            }
            this.screens.contextMenu.appendChild(div);
        });
    }

    hideContextMenu() {
        this.screens.contextMenu.classList.add('hidden');
        this.screens.contextMenu.style.display = 'none';
    }

    showPickupPrompt(itemName) {
        this.elements.pickupText.innerText = `Will you take the ${itemName}?`;
        this.screens.pickupPrompt.classList.remove('hidden');
        this.screens.pickupPrompt.style.display = 'flex';
    }

    hidePickupPrompt() {
        this.screens.pickupPrompt.classList.add('hidden');
        this.screens.pickupPrompt.style.display = 'none';
    }
}