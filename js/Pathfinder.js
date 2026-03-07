import * as THREE from 'three';
import wasmUrl from '../build/release.wasm?url';

export class Pathfinder {
    constructor(width, depth, obstacles) {
        this.width = width;
        this.depth = depth;
        this.gridSize = 1;
        this.gridWidth = Math.ceil(width / this.gridSize);
        this.gridDepth = Math.ceil(depth / this.gridSize);

        this.wasmInstance = null;
        this.ready = false;

        const imports = {
            env: {
                abort: (msg, file, line, col) => console.error(`WASM abort at ${line}:${col}`)
            }
        };

        WebAssembly.instantiateStreaming(fetch(wasmUrl), imports).then(obj => {
            this.wasmInstance = obj.instance.exports;
            this.wasmInstance.initGrid(this.gridWidth, this.gridDepth);

            obstacles.forEach(obs => {
                const transform = obs.components.Transform;
                const collider = obs.components.Collider;

                if (!transform || !collider) return;

                const safety = 0.4;
                // Assuming collider radius is roughly half the width/depth
                const extent = collider.radius + safety;

                const minX = Math.floor((transform.position.x - extent + this.width / 2) / this.gridSize);
                const maxX = Math.ceil((transform.position.x + extent + this.width / 2) / this.gridSize);
                const minZ = Math.floor((transform.position.z - extent + this.depth / 2) / this.gridSize);
                const maxZ = Math.ceil((transform.position.z + extent + this.depth / 2) / this.gridSize);

                for (let x = minX; x < maxX; x++) {
                    for (let z = minZ; z < maxZ; z++) {
                        this.wasmInstance.setObstacle(x, z);
                    }
                }
            });

            this.ready = true;
            console.log("AssemblyScript Pathfinder Ready.");
        }).catch(err => {
            console.error("Failed to load Wasm Pathfinder:", err);
        });
    }

    findPath(startPos, endPos) {
        if (!this.ready) return null;

        const startNode = this.worldToGrid(startPos);
        const endNode = this.worldToGrid(endPos);

        const pathLength = this.wasmInstance.findPath(startNode.x, startNode.z, endNode.x, endNode.z);

        if (pathLength === 0) return null;

        const totalPath = [];
        for (let i = 0; i < pathLength; i++) {
            const px = this.wasmInstance.getPathNodeX(i);
            const pz = this.wasmInstance.getPathNodeZ(i);
            totalPath.push(this.gridToWorld(px, pz));
        }

        return totalPath;
    }

    worldToGrid(pos) {
        return {
            x: Math.floor((pos.x + this.width / 2) / this.gridSize),
            z: Math.floor((pos.z + this.depth / 2) / this.gridSize)
        };
    }

    gridToWorld(x, z) {
        return new THREE.Vector3(
            (x * this.gridSize) - this.width / 2 + this.gridSize / 2,
            0,
            (z * this.gridSize) - this.depth / 2 + this.gridSize / 2
        );
    }
}