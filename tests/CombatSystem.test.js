import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatSystem } from '../js/systems/CombatSystem.js';

// Mock Three.js to avoid WebGL context requirements in Node
vi.mock('three', () => {
    return {
        Raycaster: class {
            set() { }
            intersectObjects() { return []; }
        },
        Vector3: class {
            constructor() { this.x = 0; this.y = 0; this.z = 0; }
            set() { }
            applyEuler() { }
            copy() { return this; }
            add() { return this; }
            multiplyScalar() { return this; }
            normalize() { return this; }
            subVectors() { return this; }
            lengthSq() { return 0; }
        },
        BufferGeometry: class {
            setAttribute() { }
        },
        BufferAttribute: class { },
        LineBasicMaterial: class { },
        Line: class {
            constructor() { this.visible = false; }
        }
    };
});

describe('Combat System Logic', () => {
    let combatSystem;
    let mockGame;
    let mockUI;

    beforeEach(() => {
        mockUI = {
            updateHealth: vi.fn(),
            showFeedback: vi.fn(),
            updateAmmo: vi.fn()
        };

        mockGame = {
            scene: { add: vi.fn(), remove: vi.fn() },
            ui: mockUI,
            gameOver: vi.fn(),
            zombieKilled: vi.fn()
        };

        combatSystem = new CombatSystem(mockGame);
    });

    it('handleZombieAttacks() should aggressively grapple the player within 1.2 distSq XZ', () => {
        const player = {
            components: {
                PlayerTag: true,
                Transform: { position: { x: 0, y: 0, z: 0 } },
                Grapple: { isGrappled: false },
                Health: { current: 100, max: 100 }
            }
        };

        const zombie = {
            components: {
                ZombieTag: true,
                Transform: { position: { x: 0.8, y: 0.9, z: 0.4 } }, // 0.8^2 + 0.4^2 = 0.64 + 0.16 = 0.80 (< 1.2)
                AI: { state: 'chase' },
                MeshComponent: { mesh: { material: { color: { setHex: vi.fn() } } } }
            }
        };

        combatSystem.handleZombieAttacks(player, [player, zombie], 0.016);

        expect(player.components.Grapple.isGrappled).toBe(true);
        expect(zombie.components.AI.state).toBe('biting');
        expect(player.components.Health.current).toBe(90); // Player takes 10 damage instantly on grapple
        expect(mockUI.updateHealth).toHaveBeenCalledWith(90, 100);
    });

    it('handleZombieAttacks() should strictly ignore Y axis height differences when grappling', () => {
        const player = {
            components: {
                PlayerTag: true,
                Transform: { position: { x: 0, y: 0, z: 0 } },
                Grapple: { isGrappled: false, grappler: null },
                Health: { current: 100, max: 100 }
            }
        };

        const zombie = {
            components: {
                ZombieTag: true,
                Transform: { position: { x: 0.5, y: 100.0, z: 0.5 } }, // Y=100.0, but XZ is 0.5^2 + 0.5^2 = 0.50 (< 1.2)
                AI: { state: 'chase' },
            }
        };

        combatSystem.handleZombieAttacks(player, [player, zombie], 0.016);

        expect(player.components.Grapple.isGrappled).toBe(true);
    });

    it('handleZombieAttacks() should never grapple if distSq is >= 1.2', () => {
        const player = {
            components: {
                PlayerTag: true,
                Transform: { position: { x: 0, y: 0, z: 0 } },
                Grapple: { isGrappled: false },
                Health: { current: 100, max: 100 }
            }
        };

        const zombie = {
            components: {
                ZombieTag: true,
                Transform: { position: { x: 1.0, y: 0.9, z: 1.0 } }, // 1.0^2 + 1.0^2 = 2.0 (>= 1.2)
                AI: { state: 'chase' },
            }
        };

        combatSystem.handleZombieAttacks(player, [player, zombie], 0.016);

        expect(player.components.Grapple.isGrappled).toBe(false);
    });
});
