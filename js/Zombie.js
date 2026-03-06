import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';

export class Zombie {
    constructor(scene, x, z) {
        this.scene = scene;
        this.speed = 0.02 + Math.random() * 0.02; // Random speed
        this.health = 3;
        this.isDead = false;
        this.isBiting = false;
        this.isKnockedDown = false;
        this.knockDownTimer = 0;

        // Match player height (1.8) and width (0.5)
        const geometry = new THREE.BoxGeometry(0.5, 1.8, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
        this.mesh = new THREE.Mesh(geometry, material);
        
        // Position y at half height (0.9) so feet are on ground
        this.mesh.position.set(x, 0.9, z);
        
        // Link mesh back to this instance for interaction
        this.mesh.userData = { 
            isZombie: true, 
            parent: this 
        };

        this.scene.add(this.mesh);
    }

    update(playerPos, isPlayerGrappled) {
        if (this.isDead) return;

        // Handle Knockdown State
        if (this.isKnockedDown) {
            this.knockDownTimer--;
            if (this.knockDownTimer <= 0) {
                this.standUp();
            }
            return; // Don't move or bite while knocked down
        }

        // If this zombie is biting, stay attached
        if (this.isBiting) {
            // Stick to player (slightly offset)
            // We don't need to move, Game.js handles the grapple state
            // Just visual: maybe shake?
            this.mesh.rotation.z = (Math.random() - 0.5) * 0.2; // Shake
            return;
        }

        // If another zombie is biting, wait (idle)
        if (isPlayerGrappled) {
            // Look at player but don't move
            const lookTarget = new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z);
            this.mesh.lookAt(lookTarget);
            return;
        }

        // Normal Chase Logic
        const direction = new THREE.Vector3()
            .subVectors(playerPos, this.mesh.position);
        
        // Ignore Y difference to prevent flying/sinking
        direction.y = 0;
        direction.normalize();
        
        // Move towards player
        this.mesh.position.add(direction.multiplyScalar(this.speed));
        
        // Face player (but keep upright)
        const lookTarget = new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z);
        this.mesh.lookAt(lookTarget);
    }

    checkCollision(playerPos) {
        if (this.isDead || this.isKnockedDown) return false;

        // Check distance in 2D (XZ plane)
        const dx = this.mesh.position.x - playerPos.x;
        const dz = this.mesh.position.z - playerPos.z;
        const distance = Math.sqrt(dx*dx + dz*dz);
        return distance < 0.8; // Collision threshold
    }

    startBiting() {
        this.isBiting = true;
        this.mesh.material.color.setHex(0xff00ff); // Purple when biting
    }

    stopBiting() {
        this.isBiting = false;
        this.mesh.material.color.setHex(0x0000ff); // Back to blue
        this.mesh.rotation.z = 0; // Reset shake
        
        // Push back and knock down
        const pushDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
        this.mesh.position.add(pushDir.multiplyScalar(-1.5)); // Push back 1.5 units
        
        this.knockDown();
    }

    knockDown() {
        this.isKnockedDown = true;
        this.knockDownTimer = 300; // 5 seconds at 60fps
        
        // Animation: Fall over
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.y = 0.25; // Lower to ground
    }

    standUp() {
        this.isKnockedDown = false;
        
        // Animation: Stand up
        this.mesh.rotation.x = 0;
        this.mesh.position.y = 0.9; // Back to standing height
    }

    takeDamage() {
        if (this.isDead) return;

        this.health--;
        this.speed *= 0.5; // Decrease speed by 50% on hit
        
        // Visual feedback (flash red)
        this.mesh.material.color.setHex(0xff0000);
        setTimeout(() => {
            if (!this.isDead) {
                // Restore color based on state
                this.mesh.material.color.setHex(this.isBiting ? 0xff00ff : 0x0000ff);
            }
        }, 100);

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.isDead = true;
        this.isBiting = false; // Release if biting
        this.mesh.material.color.setHex(0x333333); // Turn grey/black
        this.mesh.rotation.x = -Math.PI / 2; // Fall over
        this.mesh.position.y = 0.25; // Lower to ground
        
        // Optional: Remove from scene after a delay
        // setTimeout(() => this.scene.remove(this.mesh), 5000);
    }
}