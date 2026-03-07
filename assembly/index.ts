let gridWidth: i32 = 0;
let gridDepth: i32 = 0;
let grid: Uint8Array = new Uint8Array(0);
let searchId: i32 = 0;

export function initGrid(width: i32, depth: i32): void {
  gridWidth = width;
  gridDepth = depth;
  grid = new Uint8Array(width * depth);
}

export function setObstacle(x: i32, z: i32): void {
  if (x >= 0 && x < gridWidth && z >= 0 && z < gridDepth) {
    unchecked(grid[x * gridDepth + z] = 1);
  }
}

function isValid(x: i32, z: i32): boolean {
  return x >= 0 && x < gridWidth && z >= 0 && z < gridDepth;
}

function isWalkable(x: i32, z: i32): boolean {
  if (!isValid(x, z)) return false;
  return unchecked(grid[x * gridDepth + z]) === 0;
}

function getKey(x: i32, z: i32): i32 {
  return x * 100 + z;
}

// Flat statically-sized arrays for absolute zero-allocation pathfinding
let cameFrom = new Int32Array(10000);
let gScore = new Int32Array(10000);
let fScore = new Int32Array(10000);

let nodeSearchId = new Int32Array(10000);
let inOpenSet = new Uint8Array(10000);
let inClosedSet = new Uint8Array(10000);

let openSetKeys = new Int32Array(10000);
let openSetSize: i32 = 0;

let resultPath = new Int32Array(20000);
let pathKeysTemp = new Int32Array(10000);

function initNode(key: i32): void {
  if (unchecked(nodeSearchId[key]) !== searchId) {
    unchecked(nodeSearchId[key] = searchId);
    unchecked(gScore[key] = 2147483647); // INT32_MAX
    unchecked(fScore[key] = 2147483647);
    unchecked(inOpenSet[key] = 0);
    unchecked(inClosedSet[key] = 0);
  }
}

export function findPath(startX: i32, startZ: i32, targetX: i32, targetZ: i32): i32 {
  if (!isValid(startX, startZ) || !isValid(targetX, targetZ)) {
    return 0;
  }

  // Generational counter prevents needing to manually loop and zero-out 10000 memory addresses
  searchId++;
  if (searchId > 2000000000) searchId = 1;

  // Find nearest walkable neighbor if target is blocked
  let targetNodeX = targetX;
  let targetNodeZ = targetZ;

  if (!isWalkable(targetNodeX, targetNodeZ)) {
    let dx: StaticArray<i32> = [0, 1, 0, -1];
    let dz: StaticArray<i32> = [1, 0, -1, 0];
    let found = false;
    for (let i = 0; i < 4; i++) {
      let nx = targetNodeX + dx[i];
      let nz = targetNodeZ + dz[i];
      if (isWalkable(nx, nz)) {
        targetNodeX = nx;
        targetNodeZ = nz;
        found = true;
        break;
      }
    }
    if (!found) return 0;
  }

  openSetSize = 0;

  let startKey = getKey(startX, startZ);
  let targetKey = getKey(targetNodeX, targetNodeZ);

  initNode(startKey);
  unchecked(gScore[startKey] = 0);
  unchecked(fScore[startKey] = heuristic(startX, startZ, targetNodeX, targetNodeZ));
  unchecked(inOpenSet[startKey] = 1);
  unchecked(openSetKeys[openSetSize++] = startKey);

  let dx: StaticArray<i32> = [0, 1, 0, -1];
  let dz: StaticArray<i32> = [1, 0, -1, 0];

  while (openSetSize > 0) {
    let lowestIndex = 0;
    let lowestF = unchecked(fScore[openSetKeys[0]]);
    for (let i = 1; i < openSetSize; i++) {
      let f = unchecked(fScore[openSetKeys[i]]);
      if (f < lowestF) {
        lowestIndex = i;
        lowestF = f;
      }
    }

    let currentKey = unchecked(openSetKeys[lowestIndex]);

    // Remove from openSet linearly
    openSetSize--;
    for (let i = lowestIndex; i < openSetSize; i++) {
      unchecked(openSetKeys[i] = openSetKeys[i + 1]);
    }
    unchecked(inOpenSet[currentKey] = 0);

    let currentZ = currentKey % 100;
    let currentX = (currentKey - currentZ) / 100;

    if (currentX == targetNodeX && currentZ == targetNodeZ) {
      return reconstructPath(currentKey, startKey);
    }

    unchecked(inClosedSet[currentKey] = 1);

    for (let i = 0; i < 4; i++) {
      let nx = currentX + unchecked(dx[i]);
      let nz = currentZ + unchecked(dz[i]);
      if (isWalkable(nx, nz)) {
        let neighborKey = getKey(nx, nz);
        initNode(neighborKey);

        if (unchecked(inClosedSet[neighborKey])) continue;

        let tentativeG = unchecked(gScore[currentKey]) + 1;

        if (tentativeG < unchecked(gScore[neighborKey])) {
          unchecked(cameFrom[neighborKey] = currentKey);
          unchecked(gScore[neighborKey] = tentativeG);
          let h = heuristic(nx, nz, targetNodeX, targetNodeZ);
          unchecked(fScore[neighborKey] = tentativeG + h);

          if (!unchecked(inOpenSet[neighborKey])) {
            unchecked(inOpenSet[neighborKey] = 1);
            unchecked(openSetKeys[openSetSize++] = neighborKey);
          }
        }
      }
    }
  }

  return 0; // No path found
}

function heuristic(x1: i32, z1: i32, x2: i32, z2: i32): i32 {
  let dx = x1 - x2;
  let dz = z1 - z2;
  if (dx < 0) dx = -dx;
  if (dz < 0) dz = -dz;
  return dx + dz;
}

function reconstructPath(currentKey: i32, startKey: i32): i32 {
  let pathLen = 0;
  unchecked(pathKeysTemp[pathLen++] = currentKey);

  while (currentKey !== startKey) {
    if (unchecked(nodeSearchId[currentKey]) !== searchId) break; // safety breakout
    currentKey = unchecked(cameFrom[currentKey]);
    unchecked(pathKeysTemp[pathLen++] = currentKey);
    if (pathLen >= 10000) break; // hard limit safety
  }

  // Reverse into final flat tuple positions ready for JS pointers
  for (let i = 0; i < pathLen; i++) {
    let key = unchecked(pathKeysTemp[pathLen - 1 - i]);
    let z = key % 100;
    let x = (key - z) / 100;
    unchecked(resultPath[i * 2] = x);
    unchecked(resultPath[i * 2 + 1] = z);
  }

  return pathLen;
}

export function getPathNodeX(index: i32): i32 {
  return unchecked(resultPath[index * 2]);
}

export function getPathNodeZ(index: i32): i32 {
  return unchecked(resultPath[index * 2 + 1]);
}
