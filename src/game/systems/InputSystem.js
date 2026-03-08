import { Input } from '../../engine/core/Input.js';
import { InputState, PlayerTag } from '../components.js';

export class InputSystem {
    constructor() {
        this.input = new Input();
    }

    update(entities, dt) {
        const player = entities.find(e => e.components.PlayerTag);
        if (!player) return;

        // Ensure player has InputState
        if (!player.components.InputState) {
            player.components.InputState = new InputState();
        }

        const state = player.components.InputState;

        // Map raw input to component state
        state.forward = this.input.isKeyDown('arrowup');
        state.backward = this.input.isKeyDown('arrowdown');
        state.left = this.input.isKeyDown('arrowleft');
        state.right = this.input.isKeyDown('arrowright');
        state.run = this.input.isKeyDown('z');
        state.aim = this.input.isKeyDown('shift');

        // Triggers (one frame only)
        state.shoot = this.input.isKeyPressed(' ');
        state.interact = this.input.isKeyPressed(' '); // Context dependent
        state.reload = this.input.isKeyPressed('r');
        state.inventory = this.input.isKeyPressed('i');
        // Quick Turn: backward held + left or right just pressed
        state.quickTurn = state.backward &&
            (this.input.isKeyPressed('arrowleft') || this.input.isKeyPressed('arrowright'));
    }
}