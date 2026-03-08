import { Transform, Movement, PlayerTag, Collider, ObstacleTag, InputState, Grapple } from '../components.js';
import * as THREE from 'three';
import { store } from '../../src/store.js';

export class MovementSystem {
    constructor() {
        // GC Optimizations: Pre-allocate vectors and boxes
        this._tempPos = new THREE.Vector3();
        this._tempPlayerBox = new THREE.Box3();
        this._tempObsBox = new THREE.Box3();
        this._tempMin = new THREE.Vector3();
        this._tempMax = new THREE.Vector3();

        // Quick Turn state
        this._quickTurnActive = false;
        this._quickTurnProgress = 0;  // 0 → 1
        this._quickTurnStart = 0;     // starting rotation.y
        this._quickTurnTarget = 0;    // target rotation.y
    }

    update(entities, dt) {
        if (!this.game) this.game = window.game;

        if (this.game && this.game.physicsWorld && !this.characterController) {
            this.characterController = this.game.physicsWorld.createCharacterController(0.01);
            this.characterController.enableAutostep(0.1, 0.1, false);
            this.characterController.enableSnapToGround(0.1);
        }

        for (const entity of entities) {
            if (entity.components.PlayerTag && entity.components.Transform && entity.components.Movement && entity.components.InputState) {
                this.handlePlayerMovement(entity, entities, dt);
            }
        }
    }

    handlePlayerMovement(entity, entities, dt = 0.016) {
        const transform = entity.components.Transform;
        const movement = entity.components.Movement;
        const input = entity.components.InputState;
        const meshComp = entity.components.MeshComponent;
        const grapple = entity.components.Grapple;
        const rigidBody = entity.rigidBody;

        // ── Interaction: Kick knocked-down zombies ──────────────────────
        if (input.interact && this.game && this.game.systems && this.game.systems.combat) {
            const knockedZombies = entities.filter(e =>
                e.components.ZombieTag &&
                e.components.AI &&
                e.components.AI.state === 'knocked_down'
            );

            for (const z of knockedZombies) {
                const zPos = z.components.Transform.position;
                // Kick range: ~1.5 units
                if (transform.position.distanceTo(zPos) < 1.5) {
                    this.game.systems.combat.kickEntity(z);
                    break;
                }
            }
        }

        // ── Quick Turn (Normal / Easy only) ─────────────────────────────
        if (store.difficulty !== 'hard') {
            // Trigger new quick turn (not while being bitten or reloading)
            const weapon = entity.components.Weapon;
            if (input.quickTurn && !this._quickTurnActive && !(grapple && grapple.isGrappled) && !(weapon && weapon.reloadTimer > 0)) {
                this._quickTurnActive = true;
                this._quickTurnProgress = 0;
                this._quickTurnStart = transform.rotation.y;
                this._quickTurnTarget = transform.rotation.y + Math.PI;
            }

            // Animate ongoing quick turn
            if (this._quickTurnActive) {
                const TURN_SPEED = 8; // Complete in ~0.125s
                this._quickTurnProgress = Math.min(1, this._quickTurnProgress + dt * TURN_SPEED);
                // Smooth ease-out
                const ease = 1 - Math.pow(1 - this._quickTurnProgress, 3);
                transform.rotation.y = this._quickTurnStart + ease * Math.PI;
                if (meshComp && meshComp.mesh) meshComp.mesh.rotation.y = transform.rotation.y;
                if (this._quickTurnProgress >= 1) this._quickTurnActive = false;
                return; // Skip all other movement while turning
            }
        }

        // Don't move if aiming, grappled, or reloading
        if (input.aim) return;
        if (grapple && grapple.isGrappled) return;
        const weapon = entity.components.Weapon;
        if (weapon && weapon.reloadTimer > 0) return;

        // Health-based speed/rotation penalty (100% hp → ×1.0, 0% hp → ×0.4)
        const health = entity.components.Health;
        const healthRatio = health ? Math.max(0, health.current / health.max) : 1.0;
        // Quadratic curve: damage feels dramatic at mid-health, not just near death
        // 100% HP → ×1.0 | 75% → ×0.65 | 50% → ×0.40 | 25% → ×0.25 | 0% → ×0.20
        const healthFactor = 0.20 + 0.80 * (healthRatio * healthRatio);

        // Rotation — slows with damage
        const rotSpeed = movement.rotationSpeed * healthFactor;
        if (input.left) transform.rotation.y += rotSpeed;
        if (input.right) transform.rotation.y -= rotSpeed;

        // Position
        let dx = 0;
        let dz = 0;

        const speed = (input.run ? movement.speed * 2 : movement.speed) * healthFactor;

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

            // Apply directional lean additively on top of base rotation
            if (transform.leanX !== undefined) meshComp.mesh.rotation.x += transform.leanX;
            if (transform.leanZ !== undefined) meshComp.mesh.rotation.z += transform.leanZ;
        }
    }
}