export class GameHUD extends HTMLElement {
    constructor() {
        super();
        this.innerHTML = `
            <div class="hud" id="hudContainer">
                <div class="hud-display" id="healthContainer">
                    <span>HEALTH</span>
                    <div class="hud-display__bar">
                        <div class="hud-display__value" id="healthValue"></div>
                    </div>
                </div>
                <div class="hud-display" id="ammoContainer">
                    <span>AMMO</span>
                    <div class="hud-display__text" id="ammoValue">15 / 30</div>
                </div>
                <button class="hud__cheat-btn" id="cheatBtn">Infinite Health: OFF</button>
            </div>
        `;
    }

    connectedCallback() {
        this.querySelector('#cheatBtn').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('cheat-toggle', { bubbles: true }));
        });
    }

    show() {
        const hud = this.querySelector('#hudContainer');
        if (hud) hud.classList.add('hud--visible');
    }

    hide() {
        const hud = this.querySelector('#hudContainer');
        if (hud) hud.classList.remove('hud--visible');
    }

    updateHealth(current, max) {
        const percent = (current / max) * 100;
        const bar = this.querySelector('#healthValue');
        if (!bar) return;

        bar.style.width = `${percent}%`;
        bar.className = 'hud-display__value'; // Reset state

        if (percent <= 25) {
            bar.classList.add('hud-display__value--critical');
        } else if (percent <= 50) {
            bar.classList.add('hud-display__value--warning');
        }
    }

    updateAmmo(current, max) {
        const ammo = this.querySelector('#ammoValue');
        if (ammo) ammo.innerText = `${current} / ${max}`;
    }
}

customElements.define('game-hud', GameHUD);
