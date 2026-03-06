import { Game } from './Game.js';

const startButton = document.getElementById('startButton');
const startScreen = document.getElementById('startScreen');
const uiContainer = document.getElementById('uiContainer');

startButton.addEventListener('click', () => {
    startScreen.style.display = 'none';
    uiContainer.style.display = 'flex';
    
    const game = new Game();
    game.start();
});