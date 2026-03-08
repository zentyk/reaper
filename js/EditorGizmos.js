import * as THREE from 'three';

const COLORS = {
    camera: 0xffdd00,  // yellow
    playerSpawn: 0x00cc44,  // green
    zombie: 0xff2222,  // red
    collectible: 0x2288ff,  // blue
    light: 0xffffaa,   // bright yellow-white
    cameraBounds: 0xffdd00, // matching camera color
    selected: 0xffffff,  // white selection ring
};

const GIZMO_SCALE = {
    camera: 0.45,
    playerSpawn: 0.55,
    zombie: 0.35,
    collectible: 0.30,
    light: 0.35,
    cameraBounds: 1.0, // base scale for bounds
};

export class EditorGizmos {
    constructor(scene) {
        this.scene = scene;
        this.gizmos = []; // { mesh, type, id }
        this.selectedId = null;
        this._ringMesh = null; // selection ring
    }

    /** Rebuild all gizmos from level data */
    sync(levelData) {
        this.clear();

        if (!levelData) return;

        // Player spawn
        if (levelData.playerSpawn) {
            const sp = levelData.playerSpawn;
            this._add('playerSpawn', 'playerSpawn', sp.x, sp.y + 1.0, sp.z);
        }

        // Cameras
        (levelData.cameras || []).forEach(c => {
            this._add('camera', c.id, c.pos[0], c.pos[1], c.pos[2]);
        });

        // Zombies
        (levelData.zombies || []).forEach(z => {
            this._add('zombie', z.id, z.pos[0], z.pos[1] + 0.5, z.pos[2]);
        });

        // Collectibles
        (levelData.collectibles || []).forEach(item => {
            this._add('collectible', item.id, item.pos[0], item.pos[1] + 0.3, item.pos[2]);
        });

        // Lights
        (levelData.lights || []).forEach(l => {
            this._add('light', l.id, l.pos[0], l.pos[1], l.pos[2]);
        });
    }

    _add(type, id, x, y, z, w = null, h = null, d = null) {
        let mesh;
        if (type === 'cameraBounds') {
            const width = w || 1;
            const height = h || 2; // Default volume height
            const depth = d || 1;

            const group = new THREE.Group();

            // 1. Semi-transparent core
            const boxGeo = new THREE.BoxGeometry(1, 1, 1);
            const boxMat = new THREE.MeshBasicMaterial({
                color: COLORS[type],
                transparent: true,
                opacity: 0.1,
                depthTest: true, // Allow seeing objects inside
                depthWrite: false
            });
            const box = new THREE.Mesh(boxGeo, boxMat);

            // 2. Wireframe outline
            const edges = new THREE.EdgesGeometry(boxGeo);
            const lineMat = new THREE.LineBasicMaterial({ color: COLORS[type], transparent: true, opacity: 0.5 });
            const wireframe = new THREE.LineSegments(edges, lineMat);

            group.add(box);
            group.add(wireframe);

            group.position.set(x, y + height / 2 + 0.01, z); // Center vertically and slight lift
            group.scale.set(width, height, depth);

            mesh = group;
        } else {
            const radius = GIZMO_SCALE[type] || 0.35;
            const geo = new THREE.SphereGeometry(radius, 10, 10);
            const mat = new THREE.MeshBasicMaterial({
                color: COLORS[type],
                depthTest: false,
                transparent: true,
                opacity: 0.85
            });
            mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
        }

        mesh.raycast = function (raycaster, intersects) {
            // For groups, we need to raycast children
            if (this.isGroup) {
                this.children.forEach(c => {
                    if (c.isMesh) c.raycast(raycaster, intersects);
                });
            } else {
                THREE.Mesh.prototype.raycast.call(this, raycaster, intersects);
            }
        };

        mesh.userData.editorId = id;
        mesh.userData.editorType = type;
        mesh.renderOrder = 999;
        this.scene.add(mesh);
        this.gizmos.push({ mesh, type, id });
        return mesh;
    }

    /** Add a new gizmo at a given world position */
    addGizmo(type, id, x, y, z, w = null, h = null, d = null) {
        return this._add(type, id, x, y, z, w, h, d);
    }

    /** Remove a gizmo by id (removes ALL gizmos sharing this ID, e.g. camera + its bounds) */
    removeById(id) {
        // Collect all matching gizmos
        const toRemove = this.gizmos.filter(g => g.id === id);
        if (toRemove.length === 0) return;

        toRemove.forEach(({ mesh }) => {
            if (window.game && window.game.transformControl && window.game.transformControl.object === mesh) {
                window.game.transformControl.detach();
            }
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });

        this.gizmos = this.gizmos.filter(g => g.id !== id);
    }

    /** Remove all gizmos of a specific type */
    removeByType(type) {
        const toRemove = this.gizmos.filter(g => g.type === type);
        toRemove.forEach(({ mesh }) => {
            if (window.game && window.game.transformControl && window.game.transformControl.object === mesh) {
                window.game.transformControl.detach();
            }
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        this.gizmos = this.gizmos.filter(g => g.type !== type);
    }

    /** Move a gizmo by id */
    moveById(id, x, y, z) {
        const g = this.gizmos.find(g => g.id === id);
        if (g) g.mesh.position.set(x, y, z);
    }

    /** Highlight selected gizmo */
    setSelected(id, type = null) {
        this.selectedId = id;

        // Remove old ring
        if (this._ringMesh) {
            this.scene.remove(this._ringMesh);
            this._ringMesh.geometry.dispose();
            this._ringMesh.material.dispose();
            this._ringMesh = null;
        }

        if (!id) {
            if (window.game && window.game.transformControl) {
                window.game.transformControl.detach();
            }
            return;
        }

        // Prefer exact type match if provided, otherwise first match for id
        const g = type
            ? this.gizmos.find(g => g.id === id && g.type === type)
            : this.gizmos.find(g => g.id === id);

        if (!g) {
            if (window.game && window.game.transformControl) {
                window.game.transformControl.detach();
            }
            return;
        }

        const ringGeo = new THREE.RingGeometry(
            (GIZMO_SCALE[g.type] || 0.35) + 0.08,
            (GIZMO_SCALE[g.type] || 0.35) + 0.22,
            24
        );
        const ringMat = new THREE.MeshBasicMaterial({
            color: COLORS.selected,
            side: THREE.DoubleSide,
            depthTest: false,
            transparent: true,
            opacity: 0.9
        });
        this._ringMesh = new THREE.Mesh(ringGeo, ringMat);
        this._ringMesh.rotation.x = -Math.PI / 2;
        this._ringMesh.position.copy(g.mesh.position);
        this._ringMesh.renderOrder = 1000;
        this.scene.add(this._ringMesh);

        // Attach TransformControl to the selected mesh
        if (window.game && window.game.transformControl) {
            window.game.transformControl.attach(g.mesh);
        }
    }

    /** Raycast against all gizmos, returns closest hit {id, type} or null */
    raycast(raycaster) {
        const meshes = this.gizmos.map(g => g.mesh);
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length === 0) return null;
        const mesh = hits[0].object;
        return { id: mesh.userData.editorId, type: mesh.userData.editorType };
    }

    /** Remove all gizmos */
    clear() {
        if (window.game && window.game.transformControl) {
            window.game.transformControl.detach();
        }

        for (const g of this.gizmos) {
            this.scene.remove(g.mesh);
            g.mesh.geometry.dispose();
            g.mesh.material.dispose();
        }
        this.gizmos = [];
        if (this._ringMesh) {
            this.scene.remove(this._ringMesh);
            this._ringMesh.geometry.dispose();
            this._ringMesh.material.dispose();
            this._ringMesh = null;
        }
        this.selectedId = null;
    }
}
