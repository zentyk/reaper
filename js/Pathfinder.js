import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';

export class Pathfinder {
    constructor(width, depth, obstacles) {
        this.width = width;
        this.depth = depth;
        this.gridSize = 1; 
        this.gridWidth = Math.ceil(width / this.gridSize);
        this.gridDepth = Math.ceil(depth / this.gridSize);
        this.grid = []; 
        
        this.initGrid(obstacles);
    }

    initGrid(obstacles) {
        for (let x = 0; x < this.gridWidth; x++) {
            this.grid[x] = new Array(this.gridDepth).fill(0);
        }

        obstacles.forEach(obs => {
            const box = obs.userData.boundingBox;
            // Expand bounds slightly for safety radius
            const safety = 0.4; 
            const minX = Math.floor((box.min.x - safety + this.width/2) / this.gridSize);
            const maxX = Math.ceil((box.max.x + safety + this.width/2) / this.gridSize);
            const minZ = Math.floor((box.min.z - safety + this.depth/2) / this.gridSize);
            const maxZ = Math.ceil((box.max.z + safety + this.depth/2) / this.gridSize);

            for (let x = minX; x < maxX; x++) {
                for (let z = minZ; z < maxZ; z++) {
                    if (this.isValid(x, z)) {
                        this.grid[x][z] = 1;
                    }
                }
            }
        });
    }

    isValid(x, z) {
        return x >= 0 && x < this.gridWidth && z >= 0 && z < this.gridDepth;
    }
    
    isWalkable(x, z) {
        return this.isValid(x, z) && this.grid[x][z] === 0;
    }

    findPath(startPos, endPos) {
        const startNode = this.worldToGrid(startPos);
        const endNode = this.worldToGrid(endPos);
        
        // If start or end is invalid, return null
        if (!this.isValid(startNode.x, startNode.z) || !this.isValid(endNode.x, endNode.z)) return null;
        
        // If end is blocked, try to find a close walkable neighbor
        let targetNode = endNode;
        if (!this.isWalkable(targetNode.x, targetNode.z)) {
             // Simple search for neighbor
             const neighbors = this.getNeighbors(targetNode);
             if (neighbors.length > 0) targetNode = neighbors[0];
             else return null;
        }

        // A*
        const openSet = [];
        const closedSet = new Set();
        const cameFrom = {};
        const gScore = {};
        const fScore = {};
        
        const startKey = `${startNode.x},${startNode.z}`;
        gScore[startKey] = 0;
        fScore[startKey] = this.heuristic(startNode, targetNode);
        
        openSet.push({ x: startNode.x, z: startNode.z, f: fScore[startKey] });
        
        while (openSet.length > 0) {
            // Get node with lowest fScore
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentKey = `${current.x},${current.z}`;
            
            if (current.x === targetNode.x && current.z === targetNode.z) {
                return this.reconstructPath(cameFrom, current);
            }
            
            closedSet.add(currentKey);
            
            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.z}`;
                if (closedSet.has(neighborKey)) continue;
                
                const tentativeG = gScore[currentKey] + 1;
                
                if (tentativeG < (gScore[neighborKey] || Infinity)) {
                    cameFrom[neighborKey] = current;
                    gScore[neighborKey] = tentativeG;
                    fScore[neighborKey] = tentativeG + this.heuristic(neighbor, targetNode);
                    
                    if (!openSet.some(n => n.x === neighbor.x && n.z === neighbor.z)) {
                        openSet.push({ x: neighbor.x, z: neighbor.z, f: fScore[neighborKey] });
                    }
                }
            }
        }
        
        return null; // No path
    }
    
    getNeighbors(node) {
        const dirs = [[0,1], [1,0], [0,-1], [-1,0]]; // 4-way
        const neighbors = [];
        for (const d of dirs) {
            const nx = node.x + d[0];
            const nz = node.z + d[1];
            if (this.isWalkable(nx, nz)) {
                neighbors.push({ x: nx, z: nz });
            }
        }
        return neighbors;
    }
    
    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.z - b.z); // Manhattan
    }
    
    reconstructPath(cameFrom, current) {
        const totalPath = [this.gridToWorld(current.x, current.z)];
        let key = `${current.x},${current.z}`;
        while (key in cameFrom) {
            current = cameFrom[key];
            key = `${current.x},${current.z}`;
            totalPath.unshift(this.gridToWorld(current.x, current.z));
        }
        return totalPath;
    }

    worldToGrid(pos) {
        return {
            x: Math.floor((pos.x + this.width/2) / this.gridSize),
            z: Math.floor((pos.z + this.depth/2) / this.gridSize)
        };
    }
    
    gridToWorld(x, z) {
        return new THREE.Vector3(
            (x * this.gridSize) - this.width/2 + this.gridSize/2,
            0,
            (z * this.gridSize) - this.depth/2 + this.gridSize/2
        );
    }
}