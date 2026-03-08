export class Input {
    constructor() {
        if (Input.instance) return Input.instance;
        Input.instance = this;

        this.keys = {};
        this.downKeys = {}; // Keys pressed this frame

        document.addEventListener("keydown", e => {
            const key = e.key.toLowerCase();
            if (!this.keys[key]) {
                this.downKeys[key] = true;
            }
            this.keys[key] = true;
        });

        document.addEventListener("keyup", e => {
            this.keys[e.key.toLowerCase()] = false;
            this.downKeys[e.key.toLowerCase()] = false;
        });
    }

    isKeyDown(key) {
        return !!this.keys[key.toLowerCase()];
    }

    isKeyPressed(key) {
        return !!this.downKeys[key.toLowerCase()];
    }

    // Call this at end of frame to clear "just pressed" state
    update() {
        this.downKeys = {};
    }
}