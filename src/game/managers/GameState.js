export class GameState {
    constructor() {
        this.levelStates = new Map();
    }

    _ensureLevel(level) {
        if (!this.levelStates.has(level)) {
            this.levelStates.set(level, {
                dead: new Set(),
                items: new Set(),
                unlockedDoors: new Set()
            });
        }
        return this.levelStates.get(level);
    }

    recordZombieDeath(level, id) {
        this._ensureLevel(level).dead.add(id);
    }

    recordItemCollected(level, id) {
        this._ensureLevel(level).items.add(id);
    }

    recordDoorUnlocked(level, id) {
        this._ensureLevel(level).unlockedDoors.add(id);
    }

    isZombieDead(level, id) {
        return this.levelStates.has(level) && this.levelStates.get(level).dead.has(id);
    }

    isItemCollected(level, id) {
        return this.levelStates.has(level) && this.levelStates.get(level).items.has(id);
    }

    isDoorUnlocked(level, id) {
        return this.levelStates.has(level) && this.levelStates.get(level).unlockedDoors.has(id);
    }
}