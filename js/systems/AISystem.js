import { Transform, AI, ZombieTag, PlayerTag, Movement, MeshComponent, Grapple, ObstacleTag, Collider } from '../components.js';
import * as THREE from 'three';
import { store } from '../../src/store.js';

export class AISystem {
    constructor(pathfinder) {
        this.pathfinder = pathfinder;

        // GC Optimizations: Pre-allocate vectors and boxes
        this._tempLookTarget = new THREE.Vector3();
        this._tempVectorA = new THREE.Vector3();
        this._tempVectorB = new THREE.Vector3();
        this._tempDir = new THREE.Vector3();
        this._tempPos = new THREE.Vector3();

        this._tempZombieBox = new THREE.Box3();
        this._tempObsBox = new THREE.Box3();
        this._tempMin = new THREE.Vector3();
        this._tempMax = new THREE.Vector3();
    }

    update(entities, dt) {
        if (!this.game) {
            this.game = window.game;
        }

        if (this.game && this.game.physicsWorld && !this.characterController) {
            this.characterController = this.game.physicsWorld.createCharacterController(0.01);
            this.characterController.enableAutostep(0.1, 0.1, false);
            this.characterController.enableSnapToGround(0.1);
        }

        const player = entities.find(e => e.components.PlayerTag);
        if (!player) return;

        const playerPos = player.components.Transform.position;
        const grapple = player.components.Grapple;
        const isPlayerGrappled = grapple ? grapple.isGrappled : false;

        for (const entity of entities) {
            if (entity.components.ZombieTag && entity.components.AI) {
                this.updateZombie(entity, playerPos, dt, isPlayerGrappled);
            }
        }
    }

    updateZombie(entity, targetPos, dt, isPlayerGrappled) {
        const ai = entity.components.AI;
        const transform = entity.components.Transform;
        const movement = entity.components.Movement;
        const meshComp = entity.components.MeshComponent;
        const rigidBody = entity.rigidBody;

        // Lazily initialise stuck-detection state
        if (!ai._lastPos) ai._lastPos = transform.position.clone();
        if (ai.stuckTimer === undefined) ai.stuckTimer = 0;
        if (ai.nudgeTimer === undefined) ai.nudgeTimer = 0;

        // Handle Knockdown
        if (ai.state === 'knocked_down') {
            ai.knockDownTimer -= dt;
            if (ai.knockDownTimer <= 0) {
                ai.state = 'chase';

                // Reset Transform
                transform.rotation.x = 0;

                // Reset Mesh
                if (meshComp && meshComp.mesh) {
                    meshComp.mesh.rotation.x = 0;
                    if (meshComp.mesh.material.color.getHex() === 0xff00ff) {
                        meshComp.mesh.material.color.setHex(0x0000ff);
                    }
                }
            }
            return;
        }

        // Handle Dead
        if (ai.state === 'dead') {
            return;
        }

        // Handle Recoil (skip AI movement, decrement timer)
        if (ai.state === 'recoiling') {
            ai.recoilTimer -= dt;
            if (ai.recoilTimer <= 0) {
                ai.state = ai.previousState || 'chase';
            }
            return;
        }

        // If biting, stay put
        if (ai.state === 'biting') {
            return;
        }

        // If another zombie is biting, wait (idle)
        if (isPlayerGrappled) {
            this._tempLookTarget.set(targetPos.x, transform.position.y, targetPos.z);
            if (meshComp && meshComp.mesh) {
                meshComp.mesh.lookAt(this._tempLookTarget);
                transform.rotation.copy(meshComp.mesh.rotation);
            }
            return;
        }

        // Simple state machine
        if (ai.state === 'idle') {
            const detectRange = store.difficulty === 'hard' ? 20 : 10;
            if (transform.position.distanceTo(targetPos) < detectRange) {
                ai.state = 'chase';
            }
        } else if (ai.state === 'chase') {
            // Pathfinding update
            ai.pathTimer += dt;
            const pathRefreshRate = store.difficulty === 'hard' ? 0.2 : 0.5;
            if (ai.pathTimer > pathRefreshRate) {
                ai.pathTimer = 0;
                if (this.pathfinder) {
                    // Try to generate path
                    ai.path = this.pathfinder.findPath(transform.position, targetPos);
                }
            }

            let moveTarget = targetPos;

            // Follow path if available
            if (ai.path && ai.path.length > 0) {
                const nextPoint = ai.path[0];
                this._tempVectorA.set(transform.position.x, 0, transform.position.z);
                this._tempVectorB.set(nextPoint.x, 0, nextPoint.z);
                const dist = this._tempVectorA.distanceTo(this._tempVectorB);

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
            this._tempDir.subVectors(moveTarget, transform.position);
            this._tempDir.y = 0;
            this._tempDir.normalize();

            // Axis-independent movement — scale speed by difficulty
            const speedMult = store.difficulty === 'hard' ? 1.6 : 1.0;
            let dx = this._tempDir.x * movement.speed * speedMult;
            let dz = this._tempDir.z * movement.speed * speedMult;

            // ── Stuck detection & escape nudge ───────────────────────────
            const movedDist = transform.position.distanceTo(ai._lastPos);
            if (movedDist < 0.002) {           // hasn't moved meaningfully
                ai.stuckTimer += dt;
            } else {
                ai.stuckTimer = 0;
            }
            ai._lastPos.copy(transform.position);

            if (ai.stuckTimer > 0.4) {
                // Apply a random perpendicular nudge to unstick
                ai.stuckTimer = 0;
                ai.pathTimer = pathRefreshRate; // force path recalc next frame

                const perpAngle = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
                const cos = Math.cos(perpAngle);
                const sin = Math.sin(perpAngle);
                const nudgeStr = movement.speed * speedMult * 3;
                dx = (this._tempDir.x * cos - this._tempDir.z * sin) * nudgeStr;
                dz = (this._tempDir.x * sin + this._tempDir.z * cos) * nudgeStr;
            }
            // ─────────────────────────────────────────────────────────────

            if (this.characterController && rigidBody) {
                this._tempPos.set(dx, 0, dz);
                const collider = rigidBody.collider(0);

                if (collider) {
                    this.characterController.computeColliderMovement(collider, this._tempPos);
                    const computedMovement = this.characterController.computedMovement();

                    const currentPos = rigidBody.translation();
                    rigidBody.setNextKinematicTranslation({
                        x: currentPos.x + computedMovement.x,
                        y: currentPos.y + computedMovement.y,
                        z: currentPos.z + computedMovement.z
                    });

                    // Sync visual transform
                    const newPos = rigidBody.translation();
                    transform.position.set(newPos.x, newPos.y, newPos.z);
                }
            } else {
                // Fallback
                transform.position.x += dx;
                transform.position.z += dz;
            }

            // Look at
            if (this._tempDir.lengthSq() > 0) {
                this._tempLookTarget.set(moveTarget.x, transform.position.y, moveTarget.z);
                if (meshComp && meshComp.mesh) {
                    meshComp.mesh.lookAt(this._tempLookTarget);
                    transform.rotation.copy(meshComp.mesh.rotation);
                }
            }
        }

        // Sync Mesh
        if (meshComp && meshComp.mesh) {
            meshComp.mesh.position.copy(transform.position);
        }
    }
}
