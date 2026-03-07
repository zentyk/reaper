import { Transform, Movement, PlayerTag, Collider, ObstacleTag, InputState, Grapple } from '../components.js';
import * as THREE from 'three';

export class MovementSystem {
    update(entities, dt) {
        const obstacles = entities.filter(e => e.components.ObstacleTag);

        for (const entity of entities) {
            if (entity.components.PlayerTag && entity.components.Transform && entity.components.Movement && entity.components.InputState) {
                this.handlePlayerMovement(entity, obstacles);
            }
        }
    }

    handlePlayerMovement(entity, obstacles) {
        const transform = entity.components.Transform;
        const movement = entity.components.Movement;
        const input = entity.components.InputState;
        const meshComp = entity.components.MeshComponent;
        const grapple = entity.components.Grapple;

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

        // Collision Check
        if (dx !== 0 || dz !== 0) {
            // Check X axis
            let nextPos = transform.position.clone();
            nextPos.x += dx;
            if (!this.checkCollision(nextPos, entity, obstacles)) {
                transform.position.x += dx;
            }

            // Check Z axis
            nextPos = transform.position.clone();
            nextPos.z += dz;
            if (!this.checkCollision(nextPos, entity, obstacles)) {
                transform.position.z += dz;
            }
        }

        // Sync Mesh
        if (meshComp && meshComp.mesh) {
            meshComp.mesh.position.copy(transform.position);
            meshComp.mesh.rotation.copy(transform.rotation);
        }
    }

    checkCollision(pos, entity, obstacles) {
        const collider = entity.components.Collider;
        if (!collider) return false;

        const playerBox = new THREE.Box3();
        const min = new THREE.Vector3(pos.x - collider.radius, 0, pos.z - collider.radius);
        const max = new THREE.Vector3(pos.x + collider.radius, 2, pos.z + collider.radius);
        playerBox.set(min, max);

        for (const obs of obstacles) {
            const obsCollider = obs.components.Collider;
            const obsTransform = obs.components.Transform;

            if (obsCollider && obsTransform) {
                const obsBox = new THREE.Box3();
                if (obs.components.MeshComponent && obs.components.MeshComponent.mesh.geometry.boundingBox) {
                    const mesh = obs.components.MeshComponent.mesh;
                    obsBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
                } else {
                    const min = new THREE.Vector3(obsTransform.position.x - obsCollider.radius, 0, obsTransform.position.z - obsCollider.radius);
                    const max = new THREE.Vector3(obsTransform.position.x + obsCollider.radius, 2, obsTransform.position.z + obsCollider.radius);
                    obsBox.set(min, max);
                }

                if (playerBox.intersectsBox(obsBox)) {
                    return true;
                }
            }
        }
        return false;
    }
}