export class InventoryScreen extends HTMLElement {
    constructor() {
        super();
        this.innerHTML = `
            <div class="inventory-screen" id="invScreen">
                <h2 class="inventory-screen__title">INVENTORY</h2>
                <div class="inventory-grid" id="invGrid">
                    <!-- Slots rendered dynamically -->
                </div>
                <div class="inventory-screen__close-hint">Press 'I' to Close</div>
            </div>
        `;
    }

    show() {
        const screen = this.querySelector('#invScreen');
        if (screen) screen.classList.add('inventory-screen--visible');
    }

    hide() {
        const screen = this.querySelector('#invScreen');
        if (screen) screen.classList.remove('inventory-screen--visible');
    }

    renderItems(inventory, combineSourceIndex) {
        const grid = this.querySelector('#invGrid');
        if (!grid) return;
        grid.innerHTML = '';

        if (combineSourceIndex !== null) {
            const instruction = document.createElement('div');
            instruction.className = 'inventory-screen__instruction';
            instruction.innerText = "Select item to combine with...";
            grid.appendChild(instruction);
        }

        inventory.forEach((item, index) => {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';

            if (combineSourceIndex === index) {
                slot.classList.add('inventory-slot--combining');
            }

            if (item) {
                slot.classList.add('inventory-slot--item');
                if (item.equipped) slot.classList.add('inventory-slot--equipped');

                let text = item.name;
                if (item.count !== undefined) text += `<br>x${item.count}`;
                if (item.equipped) text += `<br>(Equipped)`;

                slot.innerHTML = text;

                slot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.dispatchEvent(new CustomEvent('slot-click', {
                        detail: { index, x: e.clientX, y: e.clientY },
                        bubbles: true
                    }));
                });
            } else {
                slot.addEventListener('click', (e) => {
                    this.dispatchEvent(new CustomEvent('slot-click', {
                        detail: { index, x: null, y: null },
                        bubbles: true
                    }));
                });
            }
            grid.appendChild(slot);
        });
    }
}

customElements.define('inventory-screen', InventoryScreen);
