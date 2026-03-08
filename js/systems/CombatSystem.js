import { PlayerTag, ZombieTag, Transform, Health, Weapon, MeshComponent, InputState, Inventory, Grapple, AI } from '../components.js';
import * as THREE from 'three';
import { store } from '../../src/store.js';

export class CombatSystem {
    constructor(game) {
        this.game = game;
        this.raycaster = new THREE.Raycaster();

        // GC Optimizations: Pre-allocate vectors
        this._tempDir = new THREE.Vector3();
        this._tempOrigin = new THREE.Vector3();
        this._tempEndPoint = new THREE.Vector3();
        this._tempPushDir = new THREE.Vector3();

        // Object Pooling: Pre-allocate the bullet tracer line 
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(6); // 2 vertices x 3 axes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
        this.tracerLine = new THREE.Line(geometry, material);
        this.tracerLine.visible = false;
        this.game.scene.add(this.tracerLine);
    }

    update(entities, dt) {
        const player = entities.find(e => e.components.PlayerTag);
        if (!player) return;

        // Ensure player has Grapple component
        if (!player.components.Grapple) {
            player.components.Grapple = new Grapple();
        }

        const grapple = player.components.Grapple;

        if (grapple.isGrappled) {
            this.handleGrapple(player, grapple, dt);
        } else {
            this.handlePlayerCombat(player, entities, dt);
            this.handleZombieAttacks(player, entities, dt);
        }
    }

    handleGrapple(player, grapple, dt) {
        const input = player.components.InputState;
        const grappler = grapple.grappler;

        // Damage over time
        grapple.damageTimer += dt;
        if (grapple.damageTimer > 0.5) {
            grapple.damageTimer = 0;
            this.damageEntity(player, 10);
        }

        // Struggle
        if (input && input.interact) {
            grapple.struggleCount++;
        }

        // Break free
        if (grapple.struggleCount > 10) {
            console.log("Escaped!");
            grapple.isGrappled = false;
            grapple.struggleCount = 0;
            grapple.damageTimer = 0;

            if (grappler) {
                const ai = grappler.components.AI;
                if (ai) {
                    ai.state = 'knocked_down';
                    ai.knockDownTimer = 5.0;
                }

                const gTransform = grappler.components.Transform;
                const pTransform = player.components.Transform;

                this._tempPushDir.subVectors(gTransform.position, pTransform.position);
                this._tempPushDir.y = 0; // Keep push horizontal
                if (this._tempPushDir.lengthSq() > 0) this._tempPushDir.normalize();
                else this._tempPushDir.set(0, 0, 1);

                gTransform.position.add(this._tempPushDir.multiplyScalar(1.5));

                if (grappler.rigidBody) {
                    grappler.rigidBody.setNextKinematicTranslation(gTransform.position);
                }

                if (grappler.components.MeshComponent) {
                    this.flashEntity(grappler, 0x0000ff); // Reset color
                    grappler.components.MeshComponent.mesh.rotation.x = -Math.PI / 2;
                    grappler.components.MeshComponent.mesh.position.y = 0.25;
                }
            }
            grapple.grappler = null;
        }
    }

    handlePlayerCombat(player, entities, dt) {
        const weapon = player.components.Weapon;
        const input = player.components.InputState;
        const meshComp = player.components.MeshComponent;

        if (!weapon || !weapon.isEquipped || !input || !meshComp) return;

        // Cooldowns
        if (weapon.cooldown > 0) weapon.cooldown -= dt;
        if (weapon.reloadTimer > 0) {
            weapon.reloadTimer -= dt;
            if (weapon.reloadTimer <= 0) {
                this.finishReload(player);
            }
            return; // Can't shoot while reloading
        }

        // Reload Input
        if (input.reload && weapon.ammo < weapon.maxAmmo) {
            this.startReload(player);
            return;
        }

        // Aiming Visuals
        if (meshComp.gun) {
            if (input.aim) {
                meshComp.gun.rotation.x = 0;
            } else {
                meshComp.gun.rotation.x = Math.PI / 3;
            }
        }

        // Shooting Logic
        if (input.aim && input.shoot && weapon.cooldown <= 0) {
            if (weapon.ammo > 0) {
                this.shoot(player, entities);
                weapon.ammo--;
                weapon.cooldown = weapon.fireRate;

                this.updateAmmoUI(weapon);

                // Trigger Tofu knife stab animation
                if (window.game && window.game.player && !window.game.player.knifeStabbing) {
                    window.game.player.knifeStabbing = true;
                    window.game.player.knifeStabTimer = 0;
                }
            } else {
                console.log("Click! Empty.");
            }
        }
    }

    updateAmmoUI(weapon) {
        let totalAmmo = 0;

        if (this.game.player && this.game.player.inventory) {
            const ammoItem = this.game.player.inventory.find(i => i && i.id === 'ammo');
            if (ammoItem) {
                totalAmmo = ammoItem.count;
            } else {
                // console.warn("Ammo item not found in inventory!");
            }
        } else {
            console.warn("Player or inventory not found!");
        }
        this.game.ui.updateAmmo(weapon.ammo, totalAmmo);
    }

    startReload(player) {
        const weapon = player.components.Weapon;

        // Check if we have ammo
        let totalAmmo = 0;
        if (this.game.player && this.game.player.inventory) {
            const ammoItem = this.game.player.inventory.find(i => i && i.id === 'ammo');
            if (ammoItem) totalAmmo = ammoItem.count;
        }

        if (totalAmmo <= 0) {
            this.game.ui.showFeedback("No ammo.");
            return;
        }

        console.log("Reloading...");
        weapon.reloadTimer = 1.5; // 1.5s reload
        this.game.ui.showFeedback("Reloading...");

        // Visuals
        if (player.components.MeshComponent && player.components.MeshComponent.gun) {
            player.components.MeshComponent.gun.material.color.setHex(0x888888);
        }
    }

    finishReload(player) {
        const weapon = player.components.Weapon;

        // Calculate ammo
        let ammoItem = null;
        if (this.game.player && this.game.player.inventory) {
            const ammoItem = this.game.player.inventory.find(i => i && i.id === 'ammo');
        }

        // Re-fetch to be safe
        if (this.game.player && this.game.player.inventory) {
            ammoItem = this.game.player.inventory.find(i => i && i.id === 'ammo');
        }

        if (ammoItem) {
            const needed = weapon.maxAmmo - weapon.ammo;
            const toLoad = Math.min(needed, ammoItem.count);

            weapon.ammo += toLoad;
            ammoItem.count -= toLoad;

            this.updateAmmoUI(weapon);
        }

        console.log("Reloaded!");
        this.game.ui.showFeedback("Reloaded!");

        // Reset Visuals
        if (player.components.MeshComponent && player.components.MeshComponent.gun) {
            player.components.MeshComponent.gun.material.color.setHex(0x333333);
        }
    }

    shoot(player, entities) {
        console.log("Bang!");
        const transform = player.components.Transform;

        this._tempDir.set(0, 0, -1);
        this._tempDir.applyEuler(transform.rotation);

        this._tempOrigin.copy(transform.position);
        this._tempOrigin.y += 1.4;

        // ── Auto-aim (Normal / Easy only) ────────────────────────────────
        if (store.difficulty !== 'hard') {
            const AUTO_AIM_RANGE = 15;          // max distance
            const AUTO_AIM_CONE = Math.cos(Math.PI / 4); // 45° half-angle dot threshold

            let bestDot = AUTO_AIM_CONE;
            let bestDir = null;

            const liveZombies = entities.filter(e =>
                e.components.ZombieTag &&
                e.components.Transform &&
                (!e.components.AI || e.components.AI.state !== 'dead')
            );

            for (const zombie of liveZombies) {
                const zPos = zombie.components.Transform.position;
                const toZombie = new THREE.Vector3(
                    zPos.x - this._tempOrigin.x,
                    0,
                    zPos.z - this._tempOrigin.z
                );
                const dist = toZombie.length();
                if (dist > AUTO_AIM_RANGE || dist === 0) continue;

                toZombie.normalize();
                const flatDir = this._tempDir.clone().setY(0).normalize();
                const dot = flatDir.dot(toZombie);

                if (dot > bestDot) {
                    bestDot = dot;
                    bestDir = toZombie;
                }
            }

            if (bestDir) {
                // Snap shot direction
                this._tempDir.set(bestDir.x, this._tempDir.y, bestDir.z).normalize();
                // Rotate player to face the target
                transform.rotation.y = Math.atan2(-bestDir.x, -bestDir.z);
                const meshComp = player.components.MeshComponent;
                if (meshComp && meshComp.mesh) meshComp.mesh.rotation.y = transform.rotation.y;
            }
        }
        // ─────────────────────────────────────────────────────────────────

        this.raycaster.set(this._tempOrigin, this._tempDir);

        this._tempEndPoint.copy(this._tempOrigin).add(this._tempDir.clone().multiplyScalar(100));

        // Use object pooled line instead of new allocations
        const positions = this.tracerLine.geometry.attributes.position.array;
        positions[0] = this._tempOrigin.x;
        positions[1] = this._tempOrigin.y;
        positions[2] = this._tempOrigin.z;
        positions[3] = this._tempEndPoint.x;
        positions[4] = this._tempEndPoint.y;
        positions[5] = this._tempEndPoint.z;
        this.tracerLine.geometry.attributes.position.needsUpdate = true;
        this.tracerLine.visible = true;

        if (this.tracerTimeout) clearTimeout(this.tracerTimeout);
        this.tracerTimeout = setTimeout(() => {
            this.tracerLine.visible = false;
        }, 50);

        const zombies = entities.filter(e => e.components.ZombieTag && e.components.MeshComponent && (!e.components.AI || e.components.AI.state !== 'dead'));
        const zombieMeshes = zombies.map(e => e.components.MeshComponent.mesh);

        const intersects = this.raycaster.intersectObjects(zombieMeshes);
        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            const hitEntity = zombies.find(e => e.components.MeshComponent.mesh === hitObject);

            if (hitEntity && hitEntity.components.Health) {
                console.log("Hit Zombie!");
                this.damageEntity(hitEntity, 1);
            }
        }
    }

    damageEntity(entity, amount) {
        const health = entity.components.Health;

        // Apply Insta-Kill cheat to non-player entities
        if (store.instaKillCheat && !entity.components.PlayerTag) {
            amount = health.current;
        }

        health.current -= amount;

        // Visual feedback
        this.flashEntity(entity, 0xff0000);

        if (entity.components.PlayerTag) {
            this.game.ui.updateHealth(Math.max(0, health.current), health.max);

            // Trigger Tofu hit-stagger body animation
            if (window.game && window.game.player) {
                window.game.player.triggerHitStagger();
            }

            if (health.current <= 0) {
                if (this.game.gameOver) this.game.gameOver();
            }
        } else {
            // Hit effects for enemies
            const playerEntity = this.game.world.entities.find(e => e.components.PlayerTag);
            this.spawnBloodParticles(entity);
            this.applyZombieRecoil(entity, playerEntity);

            if (health.current <= 0) {
                this.killEntity(entity);
            }
        }
    }

    spawnBloodParticles(entity) {
        const meshComp = entity.components.MeshComponent;
        if (!meshComp || !meshComp.mesh) return;

        const origin = meshComp.mesh.position.clone();
        origin.y += 0.9; // Target center torso

        const particleCount = 10;
        const particles = [];
        const scene = this.game.scene;

        for (let i = 0; i < particleCount; i++) {
            const geo = new THREE.SphereGeometry(0.035, 4, 4);
            const mat = new THREE.MeshBasicMaterial({ color: 0xcc0000, transparent: true });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(origin);

            // Random burst velocity
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 0.14,
                Math.random() * 0.18 + 0.05,
                (Math.random() - 0.5) * 0.14
            );

            scene.add(p);
            particles.push({ mesh: p, vel, life: 1.0 });
        }

        const gravity = -0.008;
        const tick = () => {
            let alive = false;
            for (const particle of particles) {
                if (particle.life <= 0) continue;
                alive = true;
                particle.vel.y += gravity;
                particle.mesh.position.addScaledVector(particle.vel, 1);
                particle.life -= 0.06;
                particle.mesh.material.opacity = Math.max(0, particle.life);
            }

            if (alive) {
                requestAnimationFrame(tick);
            } else {
                for (const particle of particles) {
                    scene.remove(particle.mesh);
                    particle.mesh.geometry.dispose();
                    particle.mesh.material.dispose();
                }
            }
        };
        requestAnimationFrame(tick);
    }

    applyZombieRecoil(entity, playerEntity) {
        const ai = entity.components.AI;
        const transform = entity.components.Transform;
        const rigidBody = entity.rigidBody;

        if (!ai || !transform || !rigidBody || ai.state === 'dead') return;

        // Push direction: away from the player
        const pushDir = new THREE.Vector3(0, 0, 1);
        if (playerEntity && playerEntity.components.Transform) {
            pushDir.subVectors(transform.position, playerEntity.components.Transform.position);
            pushDir.y = 0;
            pushDir.normalize();
        }

        // Pause AI movement during recoil
        ai.previousState = ai.state;
        ai.state = 'recoiling';
        ai.recoilTimer = 0.3;

        const kickDist = 1.4;   // Much more visible
        const duration = 0.3;
        let elapsed = 0;
        const startX = transform.position.x;
        const startZ = transform.position.z;

        const recoilTick = () => {
            elapsed += 0.016;
            const t = Math.min(elapsed / duration, 1.0);
            const arc = Math.sin(t * Math.PI); // Peak at center, return to 0

            const newX = startX + pushDir.x * arc * kickDist;
            const newZ = startZ + pushDir.z * arc * kickDist;

            // Drive via rigid body so it syncs with the physics world
            rigidBody.setNextKinematicTranslation({
                x: newX,
                y: rigidBody.translation().y,
                z: newZ
            });

            if (t < 1.0) {
                requestAnimationFrame(recoilTick);
            } else {
                // Snap back to start
                rigidBody.setNextKinematicTranslation({
                    x: startX,
                    y: rigidBody.translation().y,
                    z: startZ
                });
            }
        };
        requestAnimationFrame(recoilTick);
    }

    flashEntity(entity, colorHex) {
        if (entity.components.MeshComponent) {
            const mesh = entity.components.MeshComponent.mesh;

            const setColor = (material) => {
                if (material && material.color) {
                    if (!material.userData.originalColor) {
                        material.userData.originalColor = material.color.getHex();
                    }
                    material.color.setHex(colorHex);

                    setTimeout(() => {
                        if (material) {
                            material.color.setHex(material.userData.originalColor);
                        }
                    }, 100);
                }
            };

            if (mesh.isGroup) {
                mesh.traverse((child) => {
                    if (child.isMesh) {
                        setColor(child.material);
                    }
                });
            } else {
                setColor(mesh.material);
            }
        }
    }

    killEntity(entity) {
        console.log("Entity Killed");

        if (entity.components.ZombieTag) {
            // Keep the entity in the world but mark it dead
            if (entity.components.AI) {
                entity.components.AI.state = 'dead';
            }

            // Visual feedback: lay flat on the ground and darken
            if (entity.components.MeshComponent && entity.components.MeshComponent.mesh) {
                const mesh = entity.components.MeshComponent.mesh;
                mesh.rotation.x = -Math.PI / 2;
                mesh.position.y = 0.25;

                // Set color to dark red
                if (mesh.material && mesh.material.color) {
                    mesh.material.color.setHex(0x550000);
                }

                if (mesh.userData && mesh.userData.id) {
                    this.game.zombieKilled(mesh.userData.id);
                }
            }

            // Lay the physics collider flat as well
            if (entity.rigidBody) {
                const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
                entity.rigidBody.setNextKinematicRotation(quat);

                const currentPos = entity.rigidBody.translation();
                entity.rigidBody.setNextKinematicTranslation({
                    x: currentPos.x,
                    y: 0.25,
                    z: currentPos.z
                });
            }
            // Do NOT set entity.isDestroyed = true so the physics collider remains in the world.
        } else {
            // Fallback for non-zombies
            if (entity.components.MeshComponent && entity.components.MeshComponent.mesh) {
                this.game.scene.remove(entity.components.MeshComponent.mesh);
            }
            entity.isDestroyed = true;
        }
    }

    handleZombieAttacks(player, entities, dt) {
        const pTransform = player.components.Transform;
        const grapple = player.components.Grapple;

        if (!grapple) return;

        for (const entity of entities) {
            if (entity.components.ZombieTag && !entity.isDestroyed) {
                const zTransform = entity.components.Transform;
                const ai = entity.components.AI;

                if (ai.state === 'knocked_down' || ai.state === 'dead') continue;

                const dx = zTransform.position.x - pTransform.position.x;
                const dz = zTransform.position.z - pTransform.position.z;
                const distSq = dx * dx + dz * dz;

                if (distSq < 1.2) {
                    console.log("Grappled!");
                    grapple.isGrappled = true;
                    grapple.grappler = entity;
                    grapple.struggleCount = 0;
                    grapple.damageTimer = 0;

                    ai.state = 'biting';

                    // Visuals
                    if (entity.components.MeshComponent) {
                        const mesh = entity.components.MeshComponent.mesh;
                        if (mesh.material) mesh.material.color.setHex(0xff00ff);
                    }

                    const biteDamage = store.difficulty === 'hard' ? 30 : 10;
                    this.damageEntity(player, biteDamage);
                    return;
                }
            }
        }
    }
}