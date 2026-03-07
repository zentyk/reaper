import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';

export function setupLevel1(game) {
    // --- Level Configuration ---
    
    // Audio
    game.audio.playMusic(1);

    // Cameras
    game.cameras.north.position.set(0, 12, -12);
    game.cameras.north.lookAt(0, 0, 0);
    
    game.cameras.south.position.set(0, 12, 12);
    game.cameras.south.lookAt(0, 0, 0);
    
    game.activeCamera = game.cameras.north;

    // Lights - Clear and Re-add
    game.scene.children.filter(obj => obj.isLight).forEach(l => game.scene.remove(l));

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    game.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    game.scene.add(dirLight);

    game.scene.background = new THREE.Color(0x1a1a1a);

    // --- Environment ---

    const levelObjects = {
        obstacles: [
            { id: 'obs1', x: 5, z: 5, w: 2, h: 2 },
            { id: 'obs2', x: -5, z: -5, w: 2, h: 2 },
            { id: 'obs3', x: 5, z: -5, w: 1, h: 4 },
            { id: 'obs4', x: -5, z: 5, w: 4, h: 1 }
        ],
        collectibles: [
            { id: 'ammo1', type: 'ammo', amount: 15, name: 'Handgun Ammo', pos: [2, 0.15, 2] },
            { id: 'key1', type: 'key', name: 'Exit Key', pos: [3, 0.1, 2] },
            { id: 'herb1', type: 'health', amount: 50, name: 'Green Herb', pos: [-2, 0.15, -2] }
        ],
        doors: [
            { id: 'door1', pos: [0, 1.5, -10], size: [2, 3, 0.2], targetLevel: 2 }
        ],
        zombies: [
            { id: 'zombie1', pos: [-7, 0, -7] },
            { id: 'zombie2', pos: [7, 0, -7] },
            { id: 'zombie3', pos: [0, 0, 5] }
        ]
    };

    // Obstacles
    levelObjects.obstacles.forEach(data => {
        game.levelManager.createObstacle(data.x, data.z, data.w, data.h);
    });

    // Collectibles
    levelObjects.collectibles.forEach(data => {
        if (game.gameState.isItemCollected(1, data.id)) return;
        game.levelManager.createCollectible(data.type, data.amount, data.name, data.pos[0], data.pos[1], data.pos[2]);
    });

    // Doors
    levelObjects.doors.forEach(data => {
        game.levelManager.createDoor(data.pos[0], data.pos[1], data.pos[2], data.size[0], data.size[1], data.size[2], data.targetLevel);
    });

    // Zombies
    levelObjects.zombies.forEach(data => {
        if (game.gameState.isZombieDead(1, data.id)) return;
        game.levelManager.createZombie(data.pos[0], data.pos[2]);
    });
    
    // Set Player Spawn
    game.player.container.position.set(0, 0, 0);
}