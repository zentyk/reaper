import { Game } from './Game.js';

// The Game class now handles its own initialization and loop start.
// The UIManager inside Game will handle the start button click.

// We create the game instance immediately.
// It will initialize the UI and wait for the start button to be clicked (handled in Game.js/UIManager.js).
const game = new Game();