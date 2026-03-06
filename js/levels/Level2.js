import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';
import { Zombie } from '../Zombie.js';

export function setupLevel2(game) {
    // --- Level Configuration ---
    
    // Audio
    game.audio.playMusic(2);

    // Cameras (Different angles for Level 2)
    game.cameras.north.position.set(15, 15, -15); // Higher and further
    game.cameras.north.lookAt(0, 0, 0);
    
    game.cameras.south.position.set(-15, 15, 15);
    game.cameras.south.lookAt(0, 0, 0);
    
    game.activeCamera = game.cameras.north;

    // Lights (Reddish/Darker mood)
    // Clear existing lights
    game.scene.children.filter(obj => obj.isPointLight).forEach(l => game.scene.remove(l));

    const light = new THREE.PointLight(0xffaaaa, 80, 100); // Red tint
    light.position.set(0, 8, 0);
    game.scene.add(light);

    const lightB = new THREE.PointLight(0xaa4444, 60, 100); // Darker red
    lightB.position.set(10, 5, 10);
    game.scene.add(lightB);

    const lightC = new THREE.PointLight(0xaa4444, 60, 100);
    lightC.position.set(-10, 5, -10);
    game.scene.add(lightC);

    // --- Environment ---
    
    // Obstacles
    const obstaclePositions = [
        { x: 0, z: 0, w: 4, h: 4 }, // Central Pillar
        { x: -8, z: -8, w: 2, h: 2 },
        { x: 8, z: 8, w: 2, h: 2 },
        { x: -8, z: 8, w: 2, h: 2 },
        { x: 8, z: -8, w: 2, h: 2 }
    ];

    obstaclePositions.forEach(pos => {
        const geometry = new THREE.BoxGeometry(pos.w, 2, pos.h);
        const material = new THREE.MeshStandardMaterial({ color: 0x774444 }); // Reddish walls
        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.position.set(pos.x, 1, pos.z);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        
        obstacle.geometry.computeBoundingBox();
        obstacle.userData = { isObstacle: true, boundingBox: new THREE.Box3().setFromObject(obstacle) };
        
        game.scene.add(obstacle);
        game.obstacles.push(obstacle);
    });

    // Add Collectibles
    // Ammo
    const ammoBoxGeo = new THREE.BoxGeometry(0.5, 0.3, 0.3);
    const ammoBoxMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const ammoBox = new THREE.Mesh(ammoBoxGeo, ammoBoxMat);
    ammoBox.position.set(-5, 0.15, -5);
    ammoBox.userData = { isCollectible: true, type: 'ammo', amount: 15, name: 'Handgun Ammo' };
    game.scene.add(ammoBox);
    game.interactables.push(ammoBox);

    // Herb
    const herbGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
    const herbMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const herb = new THREE.Mesh(herbGeo, herbMat);
    herb.position.set(5, 0.15, 5);
    herb.userData = { isCollectible: true, type: 'health', amount: 50, name: 'Green Herb' };
    game.scene.add(herb);
    game.interactables.push(herb);

    // Key (Hidden)
    const keyGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const keyMat = new THREE.MeshStandardMaterial({ color: 0xFFFF00 });
    const key = new THREE.Mesh(keyGeo, keyMat);
    key.position.set(0, 0.1, 8); // Behind a pillar
    key.userData = { isCollectible: true, type: 'key', name: 'Exit Key' };
    key.visible = false;
    game.scene.add(key);
    game.interactables.push(key);
    game.keyMesh = key;

    // Door (East Wall)
    const doorGeo = new THREE.BoxGeometry(0.2, 3, 2); // Rotated dimensions
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(10, 1.5, 0); 
    
    door.geometry.computeBoundingBox();
    door.userData = { 
        isDoor: true, 
        name: "Exit Door",
        isObstacle: true, 
        boundingBox: new THREE.Box3().setFromObject(door)
    };
    
    game.scene.add(door);
    game.interactables.push(door);
    game.obstacles.push(door);

    // Zombies (5)
    for (let i = 0; i < 5; i++) {
        const x = (Math.random() - 0.5) * 15;
        const z = (Math.random() - 0.5) * 15;
        const zombie = new Zombie(game.scene, x, z);
        game.zombies.push(zombie);
    }
    
    // Set Player Spawn
    game.player.container.position.set(0, 0, -8); // Spawn away from center pillar
}