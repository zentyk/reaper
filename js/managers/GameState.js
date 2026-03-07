export class GameState {
    constructor() {
        this.levelStates = new Map();
    }

    recordZombieDeath(level, id) {
        if (!this.levelStates.has(level)) this.levelStates.set(level, { dead: new Set(), items: new Set() });
        this.levelStates.get(level).dead.add(id);
    }

    recordItemCollected(level, id) {
        if (!this.levelStates.has(level)) this.levelStates.set(level, { dead: new Set(), items: new Set() });
        this.levelStates.get(level).items.add(id);
    }

    isZombieDead(level, id) {
        return this.levelStates.has(level) && this.levelStates.get(level).dead.has(id);
    }

    isItemCollected(level, id) {
        return this.levelStates.has(level) && this.levelStates.get(level).items.has(id);
    }
}