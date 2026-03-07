import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Player } from '../js/Player.js';

// Mock the DOM-bound Input class to prevent reference errors in Node
vi.mock('../js/core/Input.js', () => {
    return {
        Input: class {
            isKeyDown() { return false; }
            getMouseDelta() { return { x: 0, y: 0 }; }
        }
    };
});

// Polyfill document for UI toggles built into constructor
global.document = {
    addEventListener: vi.fn(),
};

describe('Player Logic', () => {
    let player;
    let mockGame;
    let mockUI;

    beforeEach(() => {
        // Build a lightweight mock Game with UI event trackers and simulated ECS entities
        mockUI = {
            examineItem: vi.fn(),
            updateAmmo: vi.fn(),
            showFeedback: vi.fn(),
            openPickupMode: vi.fn(),
            closePickupMode: vi.fn(),
            toggleInventory: vi.fn(),
            renderInventory: vi.fn()
        };

        mockGame = {
            world: {
                entities: [
                    {
                        components: {
                            PlayerTag: true,
                            Weapon: { ammo: 15, maxAmmo: 15, isEquipped: true }
                        }
                    }
                ]
            },
            ui: mockUI
        };

        // Pass a dummy {} as the Three.js scene
        player = new Player({}, mockGame);
    });

    it('instantReload() should reject reloading if clip is full', () => {
        const ammoItem = { count: 30 };
        player.instantReload(ammoItem);

        expect(mockUI.examineItem).toHaveBeenCalledWith("Clip is already full.");
        expect(ammoItem.count).toBe(30);
    });

    it('instantReload() should reload weapon and decrement ammo item', () => {
        const ammoItem = { count: 30 };

        // Manually empty 5 bullets from the ECS weapon
        mockGame.world.entities[0].components.Weapon.ammo = 10;

        player.instantReload(ammoItem);

        expect(mockUI.examineItem).toHaveBeenCalledWith("Reloaded!");
        expect(mockGame.world.entities[0].components.Weapon.ammo).toBe(15);
        expect(ammoItem.count).toBe(25); // 30 - 5
    });

    it('instantReload() should gracefully handle ammo boxes smaller than missing clip capacity', () => {
        const ammoItem = { count: 3 };

        // Missing 5 bullets, but we only have 3 to give
        mockGame.world.entities[0].components.Weapon.ammo = 10;

        player.instantReload(ammoItem);

        expect(mockUI.examineItem).toHaveBeenCalledWith("Reloaded!");
        expect(mockGame.world.entities[0].components.Weapon.ammo).toBe(13); // Loaded all 3
        expect(ammoItem.count).toBe(0); // Depleted
    });

    it('combineItem() should correctly invoke instantReload for handgun + ammo logic via UI slots', () => {
        // Setup inventory state
        player.inventory[0] = { id: 'handgun', type: 'weapon' };
        player.inventory[1] = { id: 'ammo', count: 10 };

        // Empty weapon
        mockGame.world.entities[0].components.Weapon.ammo = 0;

        // Perform UI clicks
        player.combineItem(0); // Select slot 0 (Handgun)
        player.finishCombination(1); // Try to combine with slot 1 (Ammo)

        // Verify state change
        expect(mockGame.world.entities[0].components.Weapon.ammo).toBe(10);
        expect(player.inventory[1].count).toBe(0);
    });

    it('finishCombination() should reject invalid item combinations', () => {
        player.inventory[0] = { id: 'handgun', type: 'weapon' };
        player.inventory[1] = { id: 'herb', type: 'health' };

        player.combineItem(0);
        player.finishCombination(1);

        expect(mockUI.examineItem).toHaveBeenCalledWith("This action cannot be done");
    });
});
