export class GameOverScreen extends HTMLElement {
    constructor() {
        super();
        this.innerHTML = `
            <div class="game-over-screen" id="gameOverContainer">
                <div class="game-over-screen__text">YOU DIED</div>
            </div>
        `;
    }

    show() {
        const container = this.querySelector('#gameOverContainer');
        if (container) {
            container.classList.add('game-over-screen--visible');
        }
    }
}

customElements.define('game-over-screen', GameOverScreen);
