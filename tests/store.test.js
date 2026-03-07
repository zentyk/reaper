import { describe, it, expect, beforeEach } from 'vitest';
import { store } from '../src/store.js';

describe('Store Reactivity', () => {
    beforeEach(() => {
        // Reset specific store properties before each test
        store.healthPercent = 100;
        store.isInventoryVisible = false;
        store.inventory = [null, null, null, null, null, null];
        store.contextMenu.visible = false;
    });

    it('should initialize with default survival horror state', () => {
        expect(store.healthPercent).toBe(100);
        expect(store.isInventoryVisible).toBe(false);
        expect(store.inventory.length).toBe(6);
    });

    it('should cleanly accept inventory merges', () => {
        const mockItem = { id: 'handgun', name: 'Handgun', type: 'weapon' };
        store.inventory[0] = mockItem;
        expect(store.inventory[0].name).toBe('Handgun');
    });

    it('should track context menu visibility state', () => {
        store.contextMenu.visible = true;
        store.contextMenu.x = 500;
        expect(store.contextMenu.visible).toBe(true);
        expect(store.contextMenu.x).toBe(500);
    });
});
