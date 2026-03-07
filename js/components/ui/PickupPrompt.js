export class PickupPrompt extends HTMLElement {
    constructor() {
        super();
        this.innerHTML = `
            <div class="pickup-prompt" id="pPrompt">
                <div class="pickup-prompt__text" id="pText">Will you take the [Item Name]?</div>
                <div class="pickup-prompt__options">
                    <button class="pickup-prompt__button" id="pYes">Yes</button>
                    <button class="pickup-prompt__button" id="pNo">No</button>
                </div>
            </div>
        `;
    }

    connectedCallback() {
        this.querySelector('#pYes').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('pickup-yes', { bubbles: true }));
        });
        this.querySelector('#pNo').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('pickup-no', { bubbles: true }));
        });
    }

    show(itemName) {
        const prompt = this.querySelector('#pPrompt');
        const text = this.querySelector('#pText');
        if (prompt && text) {
            text.innerText = `Will you take the ${itemName}?`;
            prompt.classList.add('pickup-prompt--visible');
        }
    }

    hide() {
        const prompt = this.querySelector('#pPrompt');
        if (prompt) prompt.classList.remove('pickup-prompt--visible');
    }
}

customElements.define('pickup-prompt', PickupPrompt);
