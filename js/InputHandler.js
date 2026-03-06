export class InputHandler {
    constructor() {
        this.keys = {};
        document.addEventListener("keydown", e => this.keys[e.key.toLowerCase()] = true);
        document.addEventListener("keyup", e => this.keys[e.key.toLowerCase()] = false);
    }

    isKeyDown(key) {
        return !!this.keys[key.toLowerCase()];
    }
}