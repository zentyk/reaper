import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';
import { Zombie } from '../Zombie.js';

export function setupLevel1(game) {
    // Add Obstacles
    const obstaclePositions = [
        { x: 5, z: 5, w: 2, h: 2 },
        { x: -5, z: -5, w: 2, h: 2 },
        { x: 5, z: -5, w: 1, h: 4 },
        { x: -5, z: 5, w: 4, h: 1 }
    ];

    obstaclePositions.forEach(pos => {
        const geometry = new THREE.BoxGeometry(pos.w, 2, pos.h);
        const material = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.position.set(pos.x, 1, pos.z);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        
        obstacle.geometry.computeBoundingBox();
        obstacle.userData = { isObstacle: true, boundingBox: new THREE.Box3().setFromObject(obstacle) };
        
        game.scene.add(obstacle);
        game.obstacles.push(obstacle);
    });

    // Add Collectibles (Ammo Box)
    const ammoBoxGeo = new THREE.BoxGeometry(0.5, 0.3, 0.3);
    const ammoBoxMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Green box
    const ammoBox = new THREE.Mesh(ammoBoxGeo, ammoBoxMat);
    ammoBox.position.set(2, 0.15, 2);
    ammoBox.userData = { 
        isCollectible: true, 
        type: 'ammo', 
        amount: 15,
        name: 'Handgun Ammo'
    };
    game.scene.add(ammoBox);
    game.interactables.push(ammoBox);

    // Add Key (Hidden initially)
    const keyGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const keyMat = new THREE.MeshStandardMaterial({ color: 0xFFFF00 }); // Yellow
    const key = new THREE.Mesh(keyGeo, keyMat);
    key.position.set(3, 0.1, 2); 
    key.userData = { 
        isCollectible: true, 
        type: 'key', 
        name: 'Exit Key'
    };
    key.visible = false; // Hide initially
    game.scene.add(key);
    game.interactables.push(key);
    game.keyMesh = key;

    // Add Green Herb
    const herbGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
    const herbMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Green
    const herb = new THREE.Mesh(herbGeo, herbMat);
    herb.position.set(-2, 0.15, -2);
    herb.userData = { 
        isCollectible: true, 
        type: 'health', 
        amount: 50,
        name: 'Green Herb'
    };
    game.scene.add(herb);
    game.interactables.push(herb);

    // Add Door
    const doorGeo = new THREE.BoxGeometry(2, 3, 0.2);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.5, -10); 
    
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

    // Add some zombies
    for (let i = 0; i < 3; i++) {
        const x = (Math.random() - 0.5) * 15;
        const z = (Math.random() - 0.5) * 15;
        const zombie = new Zombie(game.scene, x, z);
        game.zombies.push(zombie);
    }
    
    // Set Player Spawn
    game.player.container.position.set(0, 0, 0);
}