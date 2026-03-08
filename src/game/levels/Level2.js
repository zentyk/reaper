import * as THREE from 'three';
import levelData from './level2.json';

export function setupLevel2(game) {
    // Make the data mutable and store on game for the editor
    game.currentLevelData = JSON.parse(JSON.stringify(levelData));
    game.currentLevelIndex = 2;

    // Audio
    game.audio.playMusic(2);

    // Cameras — build from JSON
    game.cameras[2] = game.currentLevelData.cameras.map(cfg => {
        const camInstance = game.cameras[cfg.id] || game.cameras.main;
        return {
            camera: camInstance,
            pos: cfg.pos,
            lookAt: cfg.lookAt,
            bounds: cfg.bounds
        };
    });

    const firstCam = game.cameras[2][0];
    game.activeCamera = firstCam.camera;
    game.activeCamera.position.set(...firstCam.pos);
    game.activeCamera.lookAt(...firstCam.lookAt);

    // Lights
    game.scene.children.filter(obj => obj.isLight).forEach(l => game.scene.remove(l));
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    game.scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffaaaa, 0.6);
    dirLight.position.set(-5, 10, -5);
    game.scene.add(dirLight);
    game.scene.background = new THREE.Color(0x1a0505);

    const d = game.currentLevelData;

    // Obstacles (hardcoded for now)
    [
        { id: 'l2_obs1', x: 0, z: 0, w: 4, h: 4 },
        { id: 'l2_obs2', x: -8, z: -8, w: 2, h: 2 },
        { id: 'l2_obs3', x: 8, z: 8, w: 2, h: 2 },
        { id: 'l2_obs4', x: -8, z: 8, w: 2, h: 2 },
        { id: 'l2_obs5', x: 8, z: -8, w: 2, h: 2 }
    ].forEach(data => game.levelManager.createObstacle(data.id, data.x, data.z, data.w, data.h));

    // Collectibles
    d.collectibles.forEach(data => {
        if (game.gameState.isItemCollected(2, data.id)) return;
        game.levelManager.createCollectible(data.id, data.type, data.amount, data.name, data.pos[0], data.pos[1], data.pos[2]);
    });

    // Doors
    d.doors.forEach(data => {
        game.levelManager.createDoor(data.id, data.pos[0], data.pos[1], data.pos[2], data.size[0], data.size[1], data.size[2], data.targetLevel);
    });

    // Zombies
    d.zombies.forEach(data => {
        if (game.gameState.isZombieDead(2, data.id)) return;
        game.levelManager.createZombie(data.id, data.pos[0], data.pos[2]);
    });

    // Player spawn
    const sp = d.playerSpawn;
    game.player.container.position.set(sp.x, sp.y, sp.z);
}