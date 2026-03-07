import { Transform, AI, ZombieTag, PlayerTag, Movement, MeshComponent, Grapple, ObstacleTag, Collider } from '../components.js';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';

export class AISystem {
    constructor(pathfinder) {
        this.pathfinder = pathfinder;
    }

    update(entities, dt) {
        const player = entities.find(e => e.components.PlayerTag);
        if (!player) return;

        const playerPos = player.components.Transform.position;
        const grapple = player.components.Grapple;
        const isPlayerGrappled = grapple ? grapple.isGrappled : false;
        
        const obstacles = entities.filter(e => e.components.ObstacleTag);

        for (const entity of entities) {
            if (entity.components.ZombieTag && entity.components.AI) {
                this.updateZombie(entity, playerPos, dt, isPlayerGrappled, obstacles);
            }
        }
    }

    updateZombie(entity, targetPos, dt, isPlayerGrappled, obstacles) {
        const ai = entity.components.AI;
        const transform = entity.components.Transform;
        const movement = entity.components.Movement;
        const meshComp = entity.components.MeshComponent;

        // Handle Knockdown
        if (ai.state === 'knocked_down') {
            ai.knockDownTimer -= dt;
            if (ai.knockDownTimer <= 0) {
                ai.state = 'chase'; // Stand up
                if (meshComp && meshComp.mesh) {
                    meshComp.mesh.rotation.x = 0;
                    meshComp.mesh.position.y = 0.9;
                }
            }
            return;
        }

        // If biting, stay put
        if (ai.state === 'biting') {
            return;
        }

        // If another zombie is biting, wait (idle)
        if (isPlayerGrappled) {
            const lookTarget = new THREE.Vector3(targetPos.x, transform.position.y, targetPos.z);
            if (meshComp && meshComp.mesh) {
                meshComp.mesh.lookAt(lookTarget);
                transform.rotation.copy(meshComp.mesh.rotation);
            }
            return;
        }

        // Simple state machine
        if (ai.state === 'idle') {
            if (transform.position.distanceTo(targetPos) < 10) {
                ai.state = 'chase';
            }
        } else if (ai.state === 'chase') {
            // Pathfinding update
            ai.pathTimer += dt;
            if (ai.pathTimer > 0.5) {
                ai.pathTimer = 0;
                if (this.pathfinder) {
                    ai.path = this.pathfinder.findPath(transform.position, targetPos);
                }
            }

            let moveTarget = targetPos;
            
            // Follow path if available
            if (ai.path && ai.path.length > 0) {
                const nextPoint = ai.path[0];
                const dist = new THREE.Vector3(transform.position.x, 0, transform.position.z)
                    .distanceTo(new THREE.Vector3(nextPoint.x, 0, nextPoint.z));
                
                if (dist < 0.5) {
                    ai.path.shift();
                    if (ai.path.length > 0) {
                        moveTarget = ai.path[0];
                    }
                } else {
                    moveTarget = nextPoint;
                }
            }

            // Move towards target
            const dir = new THREE.Vector3().subVectors(moveTarget, transform.position);
            dir.y = 0;
            dir.normalize();
            
            const moveVector = dir.multiplyScalar(movement.speed);
            const newPos = transform.position.clone().add(moveVector);
            
            // Check Collision
            if (!this.checkCollision(newPos, entity, obstacles)) {
                transform.position.add(moveVector);
            }
            
            // Look at
            if (dir.lengthSq() > 0) {
                const lookTarget = new THREE.Vector3(moveTarget.x, transform.position.y, moveTarget.z);
                if (meshComp && meshComp.mesh) {
                    meshComp.mesh.lookAt(lookTarget);
                    transform.rotation.copy(meshComp.mesh.rotation);
                }
            }
        }

        // Sync Mesh
        if (meshComp && meshComp.mesh) {
            meshComp.mesh.position.copy(transform.position);
        }
    }
    
    checkCollision(pos, entity, obstacles) {
        const collider = entity.components.Collider;
        if (!collider) return false;

        const zombieBox = new THREE.Box3();
        const min = new THREE.Vector3(pos.x - collider.radius, 0, pos.z - collider.radius);
        const max = new THREE.Vector3(pos.x + collider.radius, 2, pos.z + collider.radius);
        zombieBox.set(min, max);

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

                if (zombieBox.intersectsBox(obsBox)) {
                    return true;
                }
            }
        }
        return false;
    }
}