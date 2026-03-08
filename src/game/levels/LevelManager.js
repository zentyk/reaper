import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Transform, MeshComponent, PlayerTag, ZombieTag, ObstacleTag, CollectibleTag, DoorTag, Health, Movement, AI, Collider, Weapon, Inventory } from '../components.js';
import { store } from '../../store.js';
import { Pathfinder } from './Pathfinder.js';

export class LevelManager {
    constructor(game) {
        this.game = game;
        this.currentLevel = 1;

        // Cameras
        this.cameras = {
            north: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
            south: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
            main: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
            corner: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
        };
    }

    update(dt) {
        if (!this.game.playerEntity || !this.game.cameras[this.game.levelManager.currentLevel]) return;

        const playerTransform = this.game.playerEntity.components.Transform;
        if (!playerTransform) return;

        const px = playerTransform.position.x;
        const pz = playerTransform.position.z;

        let targetCamConfig = null;

        if (this.game.cameras[this.game.levelManager.currentLevel]) {
            const levelCameras = this.game.cameras[this.game.levelManager.currentLevel];
            for (const cam of levelCameras) {
                if (px >= cam.bounds.minX && px <= cam.bounds.maxX &&
                    pz >= cam.bounds.minZ && pz <= cam.bounds.maxZ) {
                    targetCamConfig = cam;
                    break;
                }
            }
        }

        if (targetCamConfig && this.game.activeCamera !== targetCamConfig.camera) {
            this.game.activeCamera = targetCamConfig.camera;
            this.game.activeCamera.position.set(...targetCamConfig.pos);
            if (targetCamConfig.rot) {
                this.game.activeCamera.rotation.set(...targetCamConfig.rot);
            } else if (targetCamConfig.lookAt) {
                this.game.activeCamera.lookAt(...targetCamConfig.lookAt);
            }
        }
    }

    async loadLevel(levelNumber) {
        this.currentLevel = levelNumber;
        this.game.currentLevelIndex = levelNumber;
        console.log(`Loading Level ${levelNumber}`);

        this.clearLevel();
        this.setupCommonEnvironment();

        try {
            const res = await fetch(`/src/game/levels/level${levelNumber}.json`);
            if (res.ok) {
                const data = await res.json();
                this.game.currentLevelData = data;
                store.editorLevelData = data;
                this.buildFromLevelData(data);
            } else {
                console.warn(`Level ${levelNumber} JSON not found, falling back to hardcoded.`);
                if (levelNumber === 1) this.setupLevel1();
                else this.setupLevel2();

                // Construct fallback data for editor
                this.game.currentLevelData = {
                    playerSpawn: { x: levelNumber === 1 ? 0 : 8, y: 0, z: 0 },
                    cameras: [{ id: 'main', pos: [0, 10, -15], lookAt: [0, 0, 0], bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 } }],
                    zombies: [], collectibles: []
                };
            }
        } catch (e) {
            console.error("Error loading level JSON:", e);
            if (levelNumber === 1) this.setupLevel1();
            else this.setupLevel2();
        }

        this.game.ui.updateLevelText(levelNumber);
        this.game.audio.playMusic(levelNumber);

        // Initialize WebAssembly Pathfinder only if enemies are present
        const hasZombies = this.game.world.entities.some(e => e.components.ZombieTag);
        if (hasZombies) {
            this.pathfinder = new Pathfinder(100, 100, this.game.obstacles);
        } else {
            this.pathfinder = null;
        }
    }

    clearLevel() {
        // Remove all entities from ECS, Scene, and Physics Engine
        for (const entity of this.game.world.entities) {
            if (entity.components.MeshComponent) {
                this.game.scene.remove(entity.components.MeshComponent.mesh);
            }
            if (entity.rigidBody) {
                this.game.physicsWorld.removeRigidBody(entity.rigidBody);
            }
        }
        this.game.world.entities = [];
        this.game.interactables = [];
        this.game.obstacles = [];

        // Clean up common environment (Floor)
        if (this.commonFloorMesh) {
            this.game.scene.remove(this.commonFloorMesh);
            this.commonFloorMesh = null;
        }
        if (this.commonFloorBody) {
            this.game.physicsWorld.removeRigidBody(this.commonFloorBody);
            this.commonFloorBody = null;
        }

        // Clear lights
        this.game.scene.children.filter(obj => obj.isLight).forEach(l => this.game.scene.remove(l));
    }

    setupCommonEnvironment() {
        // Floor Mesh
        this.commonFloorMesh = new THREE.Mesh(
            new THREE.BoxGeometry(100, 0.1, 100),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        this.game.scene.add(this.commonFloorMesh);

        // --- Physics Floor ---
        const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.05, 0);
        this.commonFloorBody = this.game.physicsWorld.createRigidBody(floorBodyDesc);
        const floorColliderDesc = RAPIER.ColliderDesc.cuboid(50, 0.05, 50);
        this.game.physicsWorld.createCollider(floorColliderDesc, this.commonFloorBody);

        // Lights - Spooky atmosphere
        const ambientLight = new THREE.AmbientLight(0x222233, 0.05); // Very dark, slightly blue ambient
        this.game.scene.add(ambientLight);

        // Remove the bright directional light to enhance the flashlight effect
    }

    createEntity(components, id = null) {
        const entity = this.game.world.createEntity();
        if (id) entity.persistentId = id; // Store persistent ID on entity

        for (const component of components) {
            this.game.world.addComponent(entity, component);
            if (component instanceof MeshComponent) {
                this.game.scene.add(component.mesh);
                // Also store ID on mesh userData for legacy/raycasting access
                if (id) component.mesh.userData.id = id;
            }
        }
        return entity;
    }

    buildFromLevelData(data) {
        // Cameras
        if (data.cameras && data.cameras.length > 0) {
            this.game.cameras[this.currentLevel] = data.cameras.map(c => {
                const cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
                cam.userData.id = c.id;
                cam.position.set(...c.pos);
                if (c.rot) {
                    cam.rotation.set(c.rot[0], c.rot[1], c.rot[2]);
                } else if (c.lookAt) {
                    cam.lookAt(...c.lookAt);
                }
                return { camera: cam, pos: c.pos, lookAt: c.lookAt, rot: c.rot, bounds: c.bounds };
            });
            this.game.activeCamera = this.game.cameras[this.currentLevel][0].camera;
            this.game.activeCamera.position.set(...this.game.cameras[this.currentLevel][0].pos);
            if (this.game.cameras[this.currentLevel][0].rot) {
                this.game.activeCamera.rotation.set(...this.game.cameras[this.currentLevel][0].rot);
            } else if (this.game.cameras[this.currentLevel][0].lookAt) {
                this.game.activeCamera.lookAt(...this.game.cameras[this.currentLevel][0].lookAt);
            }
        }

        // Lighting based on Level JSON
        if (data.lights && data.lights.length > 0) {
            data.lights.forEach(l => {
                const pointLight = new THREE.PointLight(l.color, l.intensity, l.distance);
                pointLight.position.set(l.pos[0], l.pos[1], l.pos[2]);
                pointLight.userData.id = l.id;
                this.game.scene.add(pointLight);
            });
        }

        if (this.currentLevel === 1) {
            // Hardcoded map geometry for lvl 1
            this.createObstacle('obs1', 5, 5, 2, 2);
            this.createObstacle('obs2', -5, -5, 2, 2);
            this.createObstacle('obs3', 5, -5, 1, 4);
            this.createObstacle('obs4', -5, 5, 4, 1);
            this.createDoor('door1', 0, 1.5, -10, 2, 3, 0.2, 2, true, 'key1');
        } else if (this.currentLevel === 2) {
            // Hardcoded map geometry for lvl 2
            this.createObstacle('l2_obs1', 0, 0, 4, 4);
            this.createObstacle('l2_obs2', -8, -8, 2, 2);
            this.createObstacle('l2_obs3', 8, 8, 2, 2);
            this.createDoor('l2_door1', 10, 1.5, 0, 0.2, 3, 2, 1);
        }

        // Player Spawn
        if (data.playerSpawn) {
            this.createPlayer(data.playerSpawn.x, data.playerSpawn.z, data.playerSpawn.rot);
        }

        // Zombies
        if (data.zombies) {
            data.zombies.forEach(z => {
                this.createZombie(z.id, z.pos[0], z.pos[2], z.rot);
            });
        }

        // Collectibles
        if (data.collectibles) {
            data.collectibles.forEach(c => {
                this.createCollectible(c.id, c.type || 'ammo', c.amount || 15, c.name || 'Item', c.pos[0], c.pos[1], c.pos[2], c.rot);
            });
        }

        // Obstacles
        if (data.obstacles) {
            data.obstacles.forEach(o => {
                this.createObstacle(o.id, o.pos[0], o.pos[2], o.size[0], o.size[2]);
            });
        }

        // Doors
        if (data.doors) {
            data.doors.forEach(d => {
                this.createDoor(d.id, d.pos[0], d.pos[1], d.pos[2], d.size[0], d.size[1], d.size[2], d.targetLevel, d.isLocked, d.requiredKeyId);
            });
        }
    }

    setupLevel1() {
        // Cameras are loaded from JSON and handled dynamically by update()

        // Lights
        const pointLight1 = new THREE.PointLight(0xffaa55, 10, 15); // Warm color, intensity, distance
        pointLight1.position.set(0, 3, 0); // Center of room, slightly elevated
        this.game.scene.add(pointLight1);

        // Door Light Level 1 (Locked - Red)
        const doorLight1 = new THREE.PointLight(0xff4444, 5, 5); // Discrete red light
        doorLight1.position.set(0, 3, -9); // Above and slightly in front of door (0, 1.5, -10)
        this.game.scene.add(doorLight1);

        // Player is loaded from JSON

        // Obstacles
        this.createObstacle('obs1', 5, 5, 2, 2);
        this.createObstacle('obs2', -5, -5, 2, 2);
        this.createObstacle('obs3', 5, -5, 1, 4);
        this.createObstacle('obs4', -5, 5, 4, 1);

        // Collectibles are loaded from JSON

        // Door (id, x, y, z, w, h, d, targetLevel, isLocked, requiredKeyId)
        this.createDoor('door1', 0, 1.5, -10, 2, 3, 0.2, 2, true, 'key1');

        // Zombies are loaded from JSON
    }

    setupLevel2() {
        // Cameras are loaded from JSON

        // Lights
        const pointLight2 = new THREE.PointLight(0x77bbff, 15, 20); // Brighter cool color, wider area
        pointLight2.position.set(0, 4, 0); // Center of room for better illumination
        this.game.scene.add(pointLight2);

        // Door Light Level 2 (Unlocked - Green)
        const doorLight2 = new THREE.PointLight(0x44ff44, 5, 5); // Discrete green light
        doorLight2.position.set(9, 3, 0); // Above and slightly in front of door (10, 1.5, 0)
        this.game.scene.add(doorLight2);

        // Player is loaded from JSON

        // Obstacles
        this.createObstacle('l2_obs1', 0, 0, 4, 4); // Center pillar
        this.createObstacle('l2_obs2', -8, -8, 2, 2);
        this.createObstacle('l2_obs3', 8, 8, 2, 2);

        // Collectibles are loaded from JSON

        // Door
        this.createDoor('l2_door1', 10, 1.5, 0, 0.2, 3, 2, 1);

        // Zombies are loaded from JSON
    }

    createPlayer(x, z, rot = null) {
        // Find persistent stats from global store to prevent level-load resets
        const currentHealth = store.healthPercent; // Percent equals flat HP out of 100
        let currentAmmo = 15;
        const equippedWeapon = store.inventory.find(i => i && i.equipped && i.type === 'weapon');
        if (equippedWeapon && equippedWeapon.ammo !== undefined) {
            currentAmmo = equippedWeapon.ammo;
        }

        // Container Group
        const container = new THREE.Group();
        container.position.set(x, 0, z);
        if (rot) container.rotation.set(rot[0], rot[1], rot[2]);

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.5, 1.8, 0.5);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.9;
        body.castShadow = true;
        container.add(body);

        // Tofu's Knife Weapon
        const knifeGroup = new THREE.Group();

        // Blade - thin pointy white slab
        const bladeGeo = new THREE.BoxGeometry(0.05, 0.04, 0.45);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.3 });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.z = -0.2; // Blade extends out in front
        knifeGroup.add(blade);

        // Handle - slightly wider, beige/tan
        const handleGeo = new THREE.BoxGeometry(0.07, 0.07, 0.18);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0xc2a068 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.z = 0.1; // Behind blade
        knifeGroup.add(handle);

        // Position: raised and outstretched on right side — aiming like a gun
        knifeGroup.position.set(0.28, 1.2, -0.5);
        knifeGroup.rotation.set(0, 0, 0); // Flat, pointing straight forward
        container.add(knifeGroup);

        // Alias as 'gun' for compatibility with existing equip/unequip logic
        const gun = knifeGroup;

        // Store gun ref on container for easy access if needed (optional)
        container.userData.gun = gun;

        // --- Physics Body ---
        let rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 0.9, z);
        if (rot) {
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
            rigidBodyDesc = rigidBodyDesc.setRotation(q);
        }
        const rigidBody = this.game.physicsWorld.createRigidBody(rigidBodyDesc);
        // Player is a 1.8m tall capsule (0.9 half-height), 0.3m radius
        const colliderDesc = RAPIER.ColliderDesc.capsule(0.6, 0.25);
        this.game.physicsWorld.createCollider(colliderDesc, rigidBody);

        const entity = this.createEntity([
            new Transform(x, 0, z), // Transform matches container
            new MeshComponent(container),
            new PlayerTag(),
            new Health(currentHealth, 100),
            new Movement(0.08, 0.04), // Movement speed
            new Collider(0.3),
            new Inventory(),
            new Weapon(currentAmmo, 15)
        ]);

        entity.rigidBody = rigidBody;

        // Link player to game for legacy access
        this.game.playerEntity = entity;

        // Update Player class reference if it exists
        if (this.game.player) {
            this.game.player.container = container;
            this.game.player.gun = gun;
            this.game.player.entity = entity; // Link ECS entity to Player controller
        }
    }

    createZombie(id, x, z, rot = null) {
        if (this.game.gameState.isZombieDead(this.currentLevel, id)) return;

        const geometry = new THREE.BoxGeometry(0.5, 1.8, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
        const mesh = new THREE.Mesh(geometry, material);
        if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);

        // --- Physics Body ---
        let rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 0.9, z);
        if (rot) {
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
            rigidBodyDesc = rigidBodyDesc.setRotation(q);
        }
        const rigidBody = this.game.physicsWorld.createRigidBody(rigidBodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.capsule(0.6, 0.25);
        this.game.physicsWorld.createCollider(colliderDesc, rigidBody);

        const maxHp = store.difficulty === 'hard' ? 6 : 3;
        const entity = this.createEntity([
            new Transform(x, 0.9, z),
            new MeshComponent(mesh),
            new ZombieTag(),
            new Health(maxHp, maxHp),
            new Movement(0.03, 0.0),
            new AI(),
            new Collider(0.3)
        ], id);

        entity.rigidBody = rigidBody;
    }

    createObstacle(id, x, z, w, h) {
        const geometry = new THREE.BoxGeometry(w, 2, h);
        const material = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, 1, z);

        // --- Physics Body ---
        const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, 1, z);
        const rigidBody = this.game.physicsWorld.createRigidBody(rigidBodyDesc);
        // Cuboid takes half-extents (width/2, height/2, depth/2)
        const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, 1, h / 2);
        this.game.physicsWorld.createCollider(colliderDesc, rigidBody);

        const entity = this.createEntity([
            new Transform(x, 1, z),
            new MeshComponent(mesh),
            new ObstacleTag(),
            new Collider(Math.max(w, h) / 2)
        ], id);

        entity.rigidBody = rigidBody;
    }

    createCollectible(id, type, amount, name, x, y, z, rot = null) {
        if (this.game.gameState.isItemCollected(this.currentLevel, id)) return;

        let geometry, material;
        if (type === 'ammo') {
            geometry = new THREE.BoxGeometry(0.5, 0.3, 0.3);
            material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        } else if (type === 'key') {
            geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            material = new THREE.MeshStandardMaterial({ color: 0xFFFF00 });
        } else {
            geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
            material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);

        const entity = this.createEntity([
            new Transform(x, y, z),
            new MeshComponent(mesh),
            new CollectibleTag(type, amount, name)
        ], id);

        // Apply rotation to ECS Transform
        if (rot) {
            entity.components.Transform.rotation.set(rot[0], rot[1], rot[2]);
        }

        if (type === 'key') {
            mesh.visible = false;
            this.game.keyEntity = entity;
        }

        this.game.interactables.push(entity);
    }

    createDoor(id, x, y, z, w, h, d, targetLevel, isLocked = false, requiredKeyId = null) {
        // Persistence check
        if (this.game.gameState.isDoorUnlocked(this.currentLevel, id)) {
            isLocked = false;
        }

        const geometry = new THREE.BoxGeometry(w, h, d);
        const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);

        // --- Physics Body ---
        const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
        const rigidBody = this.game.physicsWorld.createRigidBody(rigidBodyDesc);
        // Cuboid takes half-extents (width/2, height/2, depth/2)
        const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2);
        this.game.physicsWorld.createCollider(colliderDesc, rigidBody);

        const entity = this.createEntity([
            new Transform(x, y, z),
            new MeshComponent(mesh),
            new DoorTag(targetLevel, isLocked, requiredKeyId),
            new ObstacleTag(),
            new Collider(Math.max(w, d) / 2)
        ], id);

        entity.rigidBody = rigidBody;

        this.game.interactables.push(entity);
        this.game.obstacles.push(entity);
    }
}