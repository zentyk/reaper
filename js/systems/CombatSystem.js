import { PlayerTag, ZombieTag, Transform, Health, Weapon, MeshComponent, InputState, Inventory, Grapple, AI } from '../components.js';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';

export class CombatSystem {
    constructor(game) {
        this.game = game;
        this.raycaster = new THREE.Raycaster();
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
                const pushDir = new THREE.Vector3().subVectors(gTransform.position, pTransform.position).normalize();
                gTransform.position.add(pushDir.multiplyScalar(1.5));

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

        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyEuler(transform.rotation);

        const origin = transform.position.clone();
        origin.y += 1.4;

        this.raycaster.set(origin, direction);

        const endPoint = origin.clone().add(direction.multiplyScalar(100));
        const points = [origin, endPoint];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
        const line = new THREE.Line(geometry, material);
        this.game.scene.add(line);
        setTimeout(() => {
            this.game.scene.remove(line);
            geometry.dispose();
            material.dispose();
        }, 50);

        const zombies = entities.filter(e => e.components.ZombieTag && e.components.MeshComponent);
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
        health.current -= amount;

        // Visual feedback
        this.flashEntity(entity, 0xff0000);

        if (entity.components.PlayerTag) {
            this.game.ui.updateHealth(Math.max(0, health.current), health.max);
            if (health.current <= 0) {
                if (this.game.gameOver) this.game.gameOver();
            }
        } else {
            if (health.current <= 0) {
                this.killEntity(entity);
            }
        }
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
        if (entity.components.MeshComponent) {
            this.game.scene.remove(entity.components.MeshComponent.mesh);
        }
        entity.isDestroyed = true;

        if (entity.components.ZombieTag) {
            if (entity.components.MeshComponent && entity.components.MeshComponent.mesh.userData.id) {
                this.game.zombieKilled(entity.components.MeshComponent.mesh.userData.id);
            }
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

                if (zTransform.position.distanceTo(pTransform.position) < 1.0) {
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

                    this.damageEntity(player, 10);
                    return;
                }
            }
        }
    }
}