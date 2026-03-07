export class World {
    constructor() {
        this.entities = [];
        this.systems = [];
        this.nextId = 0;
    }

    createEntity() {
        const entity = { id: this.nextId++, components: {} };
        this.entities.push(entity);
        return entity;
    }

    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index > -1) {
            this.entities.splice(index, 1);
        }
    }

    addComponent(entity, component) {
        entity.components[component.constructor.name] = component;
    }

    getComponent(entity, componentClass) {
        return entity.components[componentClass.name];
    }

    hasComponent(entity, componentClass) {
        return !!entity.components[componentClass.name];
    }

    addSystem(system) {
        this.systems.push(system);
    }

    update(dt) {
        for (const system of this.systems) {
            system.update(this.entities, dt);
        }
    }
}