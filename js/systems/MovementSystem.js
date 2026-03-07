import { Transform, Movement, PlayerTag, Collider, ObstacleTag, InputState, Grapple } from '../components.js';
import * as THREE from 'three';

export class MovementSystem {
    constructor() {
        // GC Optimizations: Pre-allocate vectors and boxes
        this._tempPos = new THREE.Vector3();
        this._tempPlayerBox = new THREE.Box3();
        this._tempObsBox = new THREE.Box3();
        this._tempMin = new THREE.Vector3();
        this._tempMax = new THREE.Vector3();
    }

    update(entities, dt) {
        // Initialize character controller if it doesn't exist
        if (!this.game) {
            // Find game instance (dirty hack but works for this architecture)
            this.game = window.game;
        }

        if (this.game && this.game.physicsWorld && !this.characterController) {
            this.characterController = this.game.physicsWorld.createCharacterController(0.01);
            this.characterController.enableAutostep(0.1, 0.1, false);
            this.characterController.enableSnapToGround(0.1);
        }

        for (const entity of entities) {
            if (entity.components.PlayerTag && entity.components.Transform && entity.components.Movement && entity.components.InputState) {
                this.handlePlayerMovement(entity);
            }
        }
    }

    handlePlayerMovement(entity) {
        const transform = entity.components.Transform;
        const movement = entity.components.Movement;
        const input = entity.components.InputState;
        const meshComp = entity.components.MeshComponent;
        const grapple = entity.components.Grapple;
        const rigidBody = entity.rigidBody;

        // Don't move if aiming OR grappled
        if (input.aim) return;
        if (grapple && grapple.isGrappled) return;

        // Rotation
        if (input.left) transform.rotation.y += movement.rotationSpeed;
        if (input.right) transform.rotation.y -= movement.rotationSpeed;

        // Position
        let dx = 0;
        let dz = 0;

        const speed = input.run ? movement.speed * 2 : movement.speed;

        if (input.forward) {
            dx -= Math.sin(transform.rotation.y) * speed;
            dz -= Math.cos(transform.rotation.y) * speed;
        }
        if (input.backward) {
            dx += Math.sin(transform.rotation.y) * speed;
            dz += Math.cos(transform.rotation.y) * speed;
        }

        if (this.characterController && rigidBody) {
            // Apply physics movement
            this._tempPos.set(dx, 0, dz);

            // Get the first (and only) collider attached to this body
            const collider = rigidBody.collider(0);

            this.characterController.computeColliderMovement(collider, this._tempPos);

            const computedMovement = this.characterController.computedMovement();

            // Apply translation to Rapier body
            const currentPos = rigidBody.translation();
            rigidBody.setNextKinematicTranslation({
                x: currentPos.x + computedMovement.x,
                y: currentPos.y + computedMovement.y,
                z: currentPos.z + computedMovement.z
            });

            // Sync visual transform from Rapier back to ThreeJS
            const newPos = rigidBody.translation();
            transform.position.set(newPos.x, newPos.y - 0.9, newPos.z); // -0.9 because rigid body is centered at Y 0.9
        } else {
            // Fallback to ghost movement if physics fails
            transform.position.x += dx;
            transform.position.z += dz;
        }

        // Sync Mesh
        if (meshComp && meshComp.mesh) {
            meshComp.mesh.position.copy(transform.position);
            meshComp.mesh.rotation.copy(transform.rotation);
        }
    }
}