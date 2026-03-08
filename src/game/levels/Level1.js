import * as THREE from 'three';
import levelData from './level1.json';

export function setupLevel1(game) {
    // Make the data mutable and store on game for the editor
    game.currentLevelData = JSON.parse(JSON.stringify(levelData));
    game.currentLevelIndex = 1;

    // Audio
    game.audio.playMusic(1);

    // Cameras — build from JSON
    const camObjects = {};
    Object.values(game.cameras).forEach(c => { if (c.isCamera) camObjects[c.name] = c; });

    game.cameras[1] = game.currentLevelData.cameras.map(cfg => {
        // Reuse the pre-existing camera instance or fall back to main
        const camInstance = game.cameras[cfg.id] || game.cameras.main;
        return {
            camera: camInstance,
            pos: cfg.pos,
            lookAt: cfg.lookAt,
            bounds: cfg.bounds
        };
    });

    // Set initial camera (last entry = main)
    const mainCam = game.cameras[1][game.cameras[1].length - 1];
    game.activeCamera = mainCam.camera;
    game.activeCamera.position.set(...mainCam.pos);
    game.activeCamera.lookAt(...mainCam.lookAt);

    // Lights
    game.scene.children.filter(obj => obj.isLight).forEach(l => game.scene.remove(l));
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    game.scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    game.scene.add(dirLight);
    game.scene.background = new THREE.Color(0x1a1a1a);

    const d = game.currentLevelData;

    // Obstacles (hardcoded geometry for now — not JSON-driven yet)
    [
        { id: 'obs1', x: 5, z: 5, w: 2, h: 2 },
        { id: 'obs2', x: -5, z: -5, w: 2, h: 2 },
        { id: 'obs3', x: 5, z: -5, w: 1, h: 4 },
        { id: 'obs4', x: -5, z: 5, w: 4, h: 1 }
    ].forEach(data => game.levelManager.createObstacle(data.id, data.x, data.z, data.w, data.h));

    // Collectibles
    d.collectibles.forEach(data => {
        if (game.gameState.isItemCollected(1, data.id)) return;
        game.levelManager.createCollectible(data.id, data.type, data.amount, data.name, data.pos[0], data.pos[1], data.pos[2]);
    });

    // Doors
    d.doors.forEach(data => {
        game.levelManager.createDoor(data.id, data.pos[0], data.pos[1], data.pos[2], data.size[0], data.size[1], data.size[2], data.targetLevel);
    });

    // Zombies
    d.zombies.forEach(data => {
        if (game.gameState.isZombieDead(1, data.id)) return;
        game.levelManager.createZombie(data.id, data.pos[0], data.pos[2]);
    });

    // Player spawn
    const sp = d.playerSpawn;
    game.player.container.position.set(sp.x, sp.y, sp.z);
}