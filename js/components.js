import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';

// --- Data Components ---

export class Transform {
    constructor(x = 0, y = 0, z = 0) {
        this.position = new THREE.Vector3(x, y, z);
        this.rotation = new THREE.Euler(0, 0, 0);
    }
}

export class MeshComponent {
    constructor(mesh) {
        this.mesh = mesh;
        // Optional: Store child references for easy access (e.g., gun)
        this.gun = mesh.getObjectByName('gun') || null; 
    }
}

export class PlayerTag {}
export class ZombieTag {}
export class ObstacleTag {}
export class CollectibleTag {
    constructor(type, amount, name) {
        this.type = type;
        this.amount = amount;
        this.name = name;
    }
}
export class DoorTag {
    constructor(targetLevel) {
        this.targetLevel = targetLevel;
    }
}

export class Health {
    constructor(current = 100, max = 100) {
        this.current = current;
        this.max = max;
        this.isDead = false;
    }
}

export class Movement {
    constructor(speed = 0.1, rotationSpeed = 0.05) {
        this.speed = speed;
        this.rotationSpeed = rotationSpeed;
    }
}

export class Inventory {
    constructor(size = 6) {
        this.items = new Array(size).fill(null);
        this.isOpen = false;
    }
}

export class Weapon {
    constructor(ammo = 15, maxAmmo = 15) {
        this.ammo = ammo;
        this.maxAmmo = maxAmmo;
        this.cooldown = 0;
        this.fireRate = 0.5;
        this.isEquipped = true;
    }
}

export class InputState {
    constructor() {
        this.forward = false;
        this.backward = false;
        this.left = false;
        this.right = false;
        this.run = false;
        this.aim = false;
        this.shoot = false; // Trigger
        this.interact = false; // Trigger
        this.reload = false; // Trigger
        this.inventory = false; // Trigger
    }
}

export class AI {
    constructor() {
        this.state = 'idle'; // idle, chase, attack, dead, biting, knocked_down
        this.target = null;
        this.path = [];
        this.pathTimer = 0;
        this.knockDownTimer = 0;
    }
}

export class Collider {
    constructor(size = 0.5) {
        this.radius = size;
        this.box = new THREE.Box3();
    }
}

export class Grapple {
    constructor() {
        this.isGrappled = false;
        this.grappler = null; // Entity ID or reference
        this.struggleCount = 0;
        this.damageTimer = 0;
    }
}