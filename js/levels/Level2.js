import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';
import { Zombie } from '../Zombie.js';

export function setupLevel2(game) {
    // --- Level Configuration ---
    
    // Audio
    game.audio.playMusic(2);

    // Cameras
    game.cameras.north.position.set(0, 15, -15);
    game.cameras.north.lookAt(0, 0, 0);
    
    game.cameras.south.position.set(0, 15, 15);
    game.cameras.south.lookAt(0, 0, 0);
    
    game.activeCamera = game.cameras.north;

    // Lights - Clear and Re-add
    game.scene.children.filter(obj => obj.isLight).forEach(l => game.scene.remove(l));

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    game.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffaaaa, 0.6); // Reddish tint
    dirLight.position.set(-5, 10, -5);
    game.scene.add(dirLight);

    game.scene.background = new THREE.Color(0x1a0505);

    // --- Environment ---

    const levelObjects = {
        obstacles: [
            { id: 'l2_obs1', x: 0, z: 0, w: 4, h: 4 },
            { id: 'l2_obs2', x: -8, z: -8, w: 2, h: 2 },
            { id: 'l2_obs3', x: 8, z: 8, w: 2, h: 2 },
            { id: 'l2_obs4', x: -8, z: 8, w: 2, h: 2 },
            { id: 'l2_obs5', x: 8, z: -8, w: 2, h: 2 }
        ],
        collectibles: [
            { id: 'l2_ammo1', type: 'ammo', amount: 15, name: 'Handgun Ammo', pos: [-5, 0.15, -5] },
            { id: 'l2_herb1', type: 'health', amount: 50, name: 'Green Herb', pos: [5, 0.15, 5] },
            { id: 'l2_key1', type: 'key', name: 'Exit Key', pos: [0, 0.1, 8] }
        ],
        doors: [
            { id: 'l2_door1', pos: [10, 1.5, 0], size: [0.2, 3, 2], targetLevel: 1 }
        ],
        zombies: [
            { id: 'l2_zombie1', pos: [-7, 0, 0] },
            { id: 'l2_zombie2', pos: [7, 0, 0] },
            { id: 'l2_zombie3', pos: [0, 0, 7] },
            { id: 'l2_zombie4', pos: [0, 0, -7] },
            { id: 'l2_zombie5', pos: [5, 0, -5] }
        ]
    };

    // Obstacles
    levelObjects.obstacles.forEach(data => {
        game.levelManager.createObstacle(data.x, data.z, data.w, data.h);
    });

    // Collectibles
    levelObjects.collectibles.forEach(data => {
        if (game.gameState.isItemCollected(2, data.id)) return;
        game.levelManager.createCollectible(data.type, data.amount, data.name, data.pos[0], data.pos[1], data.pos[2]);
    });

    // Doors
    levelObjects.doors.forEach(data => {
        game.levelManager.createDoor(data.pos[0], data.pos[1], data.pos[2], data.size[0], data.size[1], data.size[2], data.targetLevel);
    });

    // Zombies
    levelObjects.zombies.forEach(data => {
        if (game.gameState.isZombieDead(2, data.id)) return;
        game.levelManager.createZombie(data.pos[0], data.pos[2]);
    });
    
    // Set Player Spawn
    game.player.container.position.set(0, 0, -8);
}