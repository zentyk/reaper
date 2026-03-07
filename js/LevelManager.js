import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Transform, MeshComponent, PlayerTag, ZombieTag, ObstacleTag, CollectibleTag, DoorTag, Health, Movement, AI, Collider, Weapon, Inventory } from './components.js';
import { store } from '../src/store.js';
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
            this.game.activeCamera.lookAt(...targetCamConfig.lookAt);
        }
    }

    loadLevel(levelNumber) {
        this.currentLevel = levelNumber;
        console.log(`Loading Level ${levelNumber}`);

        this.clearLevel();
        this.setupCommonEnvironment();

        if (levelNumber === 1) {
            this.setupLevel1();
        } else {
            this.setupLevel2();
        }

        this.game.ui.updateLevelText(levelNumber);
        this.game.audio.playMusic(levelNumber);

        // Initialize WebAssembly Pathfinder using the current Level's bounding layout
        this.pathfinder = new Pathfinder(100, 100, this.game.obstacles);

        this.game.ui.fadeIn();
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

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.game.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
        dirLight.position.set(5, 10, 7);
        dirLight.castShadow = true;
        this.game.scene.add(dirLight);
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

    setupLevel1() {
        // Cameras handled dynamically by update()
        this.game.cameras[1] = [
            {
                camera: this.cameras.corner,
                pos: [-10, 8, -10], lookAt: [-5, 0, -5],
                bounds: { minX: -100, maxX: -5, minZ: -100, maxZ: -5 }
            },
            {
                camera: this.cameras.south,
                pos: [0, 10, 15], lookAt: [0, 0, 0],
                bounds: { minX: -100, maxX: 100, minZ: 0, maxZ: 100 }
            },
            {
                camera: this.cameras.main,
                pos: [0, 10, -15], lookAt: [0, 0, 0],
                bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }
            }
        ];

        this.game.activeCamera = this.game.cameras[1][2].camera; // Default to main
        this.game.activeCamera.position.set(...this.game.cameras[1][2].pos);
        this.game.activeCamera.lookAt(...this.game.cameras[1][2].lookAt);

        // Player
        this.createPlayer(0, 0, 0);

        // Obstacles
        this.createObstacle('obs1', 5, 5, 2, 2);
        this.createObstacle('obs2', -5, -5, 2, 2);
        this.createObstacle('obs3', 5, -5, 1, 4);
        this.createObstacle('obs4', -5, 5, 4, 1);

        // Collectibles
        this.createCollectible('ammo1', 'ammo', 15, 'Handgun Ammo', 2, 0.15, 2);
        this.createCollectible('key1', 'key', 1, 'Exit Key', 3, 0.1, 2);
        this.createCollectible('herb1', 'health', 50, 'Green Herb', -2, 0.15, -2);

        // Door (id, x, y, z, w, h, d, targetLevel)
        this.createDoor('door1', 0, 1.5, -10, 2, 3, 0.2, 2);

        // Zombies
        this.createZombie('zombie1', -7, -7);
        this.createZombie('zombie2', 7, -7);
        this.createZombie('zombie3', 0, 5);
    }

    setupLevel2() {
        // Cameras
        this.game.cameras.north.position.set(0, 15, -15);
        this.game.cameras.north.lookAt(0, 0, 0);
        this.game.activeCamera = this.game.cameras.north;

        // Player (Spawn near the X=10 door)
        this.createPlayer(8, 0, 0);

        // Obstacles
        this.createObstacle('l2_obs1', 0, 0, 4, 4); // Center pillar
        this.createObstacle('l2_obs2', -8, -8, 2, 2);
        this.createObstacle('l2_obs3', 8, 8, 2, 2);

        // Collectibles
        this.createCollectible('l2_ammo1', 'ammo', 15, 'Handgun Ammo', -5, 0.15, -5);
        this.createCollectible('l2_herb1', 'health', 50, 'Green Herb', 5, 0.15, 5);
        this.createCollectible('l2_key1', 'key', 1, 'Exit Key', 0, 0.1, 8);

        // Door
        this.createDoor('l2_door1', 10, 1.5, 0, 0.2, 3, 2, 1);

        // Zombies
        this.createZombie('l2_zombie1', -7, 0);
        this.createZombie('l2_zombie2', 7, 0);
        this.createZombie('l2_zombie3', 0, 7);
    }

    createPlayer(x, z) {
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

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.5, 1.8, 0.5);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.9;
        body.castShadow = true;
        container.add(body);

        // Gun
        const gunGeo = new THREE.BoxGeometry(0.1, 0.1, 0.4);
        const gunMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const gun = new THREE.Mesh(gunGeo, gunMat);
        gun.position.set(0.3, 1.4, -0.4);
        container.add(gun);

        // Store gun ref on container for easy access if needed (optional)
        container.userData.gun = gun;

        // --- Physics Body ---
        const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 0.9, z);
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
            new Weapon(15, currentAmmo)
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

    createZombie(id, x, z) {
        if (this.game.gameState.isZombieDead(this.currentLevel, id)) return;

        const geometry = new THREE.BoxGeometry(0.5, 1.8, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
        const mesh = new THREE.Mesh(geometry, material);

        // --- Physics Body ---
        const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 0.9, z);
        const rigidBody = this.game.physicsWorld.createRigidBody(rigidBodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.capsule(0.6, 0.25);
        this.game.physicsWorld.createCollider(colliderDesc, rigidBody);

        const entity = this.createEntity([
            new Transform(x, 0.9, z),
            new MeshComponent(mesh),
            new ZombieTag(),
            new Health(3, 3),
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

    createCollectible(id, type, amount, name, x, y, z) {
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

        const entity = this.createEntity([
            new Transform(x, y, z),
            new MeshComponent(mesh),
            new CollectibleTag(type, amount, name)
        ], id);

        if (type === 'key') {
            mesh.visible = false;
            this.game.keyEntity = entity;
        }

        this.game.interactables.push(entity);
    }

    createDoor(id, x, y, z, w, h, d, targetLevel) {
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
            new DoorTag(targetLevel),
            new ObstacleTag(),
            new Collider(Math.max(w, d) / 2)
        ], id);

        entity.rigidBody = rigidBody;

        this.game.interactables.push(entity);
        this.game.obstacles.push(entity);
    }
}