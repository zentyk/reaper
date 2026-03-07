import { PlayerTag, CollectibleTag, DoorTag, Transform } from '../components.js';
import { Input } from '../core/Input.js';

export class InteractionSystem {
    constructor(game) {
        this.game = game;
        this.input = new Input();
    }

    update(entities, dt) {
        if (this.input.isKeyPressed(' ')) {
            const player = entities.find(e => e.components.PlayerTag);
            if (player) {
                this.checkInteractions(player, entities);
            }
        }
    }

    checkInteractions(player, entities) {
        const pTransform = player.components.Transform;

        for (const entity of entities) {
            if (entity === player) continue;

            const transform = entity.components.Transform;
            if (!transform) continue;

            // 2D distance check
            const dx = pTransform.position.x - transform.position.x;
            const dz = pTransform.position.z - transform.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 2.0) {
                // Ensure we only interact with visible entities
                const meshComp = entity.components.MeshComponent;
                if (meshComp && meshComp.mesh && !meshComp.mesh.visible) {
                    continue;
                }

                if (entity.components.CollectibleTag) {
                    // Delegate to Player controller for UI/Inventory management
                    this.game.player.openPickupPrompt(entity);
                    return;
                } else if (entity.components.DoorTag) {
                    // Delegate to Player controller
                    this.game.player.tryOpenDoor(entity);
                    return;
                }
            }
        }
    }
}