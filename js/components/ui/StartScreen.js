export class StartScreen extends HTMLElement {
    constructor() {
        super();
        this.innerHTML = `
            <div class="start-screen">
                <h1 class="start-screen__title">REAPER</h1>
                <button class="start-screen__button" id="startButton">START GAME</button>
            </div>
        `;
    }

    connectedCallback() {
        this.querySelector('#startButton').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('start-game', { bubbles: true }));
        });
    }

    hide() {
        const container = this.querySelector('.start-screen');
        if (container) {
            container.classList.add('start-screen--hidden');
        }
    }
}

customElements.define('start-screen', StartScreen);
