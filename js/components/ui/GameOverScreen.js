export class GameOverScreen extends HTMLElement {
    constructor() {
        super();
        this.innerHTML = `
            <div class="game-over-screen" id="gameOverContainer">
                <div class="game-over-screen__text" id="gameOverText">YOU DIED</div>
            </div>
        `;
    }

    show() {
        const container = this.querySelector('#gameOverContainer');
        const text = this.querySelector('#gameOverText');
        if (!container || !text) return;

        // Phase 1: Fade to White
        container.classList.add('game-over-screen--visible');

        // Slight delay to allow display:flex to apply before kicking off the opacity/bg-color transition
        setTimeout(() => {
            container.classList.add('game-over-screen--white');
        }, 50);

        // Phase 2: Show YOU DIED Text
        setTimeout(() => {
            text.classList.add('game-over-screen__text--visible');
        }, 2000);

        // Phase 3: Fade to Black
        setTimeout(() => {
            container.classList.remove('game-over-screen--white');
            container.classList.add('game-over-screen--black');
        }, 5000);
    }
}

customElements.define('game-over-screen', GameOverScreen);
