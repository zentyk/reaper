import RAPIER from '@dimforge/rapier3d-compat';

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const bodyDesc = RAPIER.RigidBodyDesc.dynamic();
const body = world.createRigidBody(bodyDesc);
const colliderDesc = RAPIER.ColliderDesc.cuboid(1, 1, 1);
world.createCollider(colliderDesc, body);

console.log("Before remove: ", world.bodies.len());
world.removeRigidBody(body);
console.log("After remove: ", world.bodies.len());
