export class ContextMenu extends HTMLElement {
    constructor() {
        super();
        this.innerHTML = `
            <div class="context-menu" id="cMenu">
                <!-- Options rendered dynamically -->
            </div>
        `;
    }

    show(x, y, actions) {
        const menu = this.querySelector('#cMenu');
        if (!menu) return;

        menu.innerHTML = '';
        menu.classList.add('context-menu--visible');
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        actions.forEach(opt => {
            const div = document.createElement('div');
            div.className = 'context-menu__option';
            div.innerText = opt.label;

            if (opt.enabled) {
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    opt.action();
                    this.hide();
                });
            } else {
                div.classList.add('context-menu__option--disabled');
            }
            menu.appendChild(div);
        });
    }

    hide() {
        const menu = this.querySelector('#cMenu');
        if (menu) menu.classList.remove('context-menu--visible');
    }
}

customElements.define('context-menu', ContextMenu);
