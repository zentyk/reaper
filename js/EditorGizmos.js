import * as THREE from 'three';

const COLORS = {
    camera: 0xffdd00,  // yellow
    playerSpawn: 0x00cc44,  // green
    zombie: 0xff2222,  // red
    collectible: 0x2288ff,  // blue
    selected: 0xffffff,  // white selection ring
};

const GIZMO_SCALE = {
    camera: 0.45,
    playerSpawn: 0.55,
    zombie: 0.35,
    collectible: 0.30,
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
    }

    _add(type, id, x, y, z) {
        const radius = GIZMO_SCALE[type] || 0.35;
        const geo = new THREE.SphereGeometry(radius, 10, 10);
        const mat = new THREE.MeshBasicMaterial({
            color: COLORS[type],
            depthTest: false,
            transparent: true,
            opacity: 0.85
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.raycast = THREE.Mesh.prototype.raycast; // ensure raycastable
        mesh.userData.editorId = id;
        mesh.userData.editorType = type;
        mesh.renderOrder = 999;
        this.scene.add(mesh);
        this.gizmos.push({ mesh, type, id });
        return mesh;
    }

    /** Add a new gizmo at a given world position */
    addGizmo(type, id, x, y, z) {
        return this._add(type, id, x, y, z);
    }

    /** Remove a gizmo by id */
    removeById(id) {
        const idx = this.gizmos.findIndex(g => g.id === id);
        if (idx === -1) return;
        const { mesh } = this.gizmos[idx];
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.gizmos.splice(idx, 1);
    }

    /** Move a gizmo by id */
    moveById(id, x, y, z) {
        const g = this.gizmos.find(g => g.id === id);
        if (g) g.mesh.position.set(x, y, z);
    }

    /** Highlight selected gizmo */
    setSelected(id) {
        this.selectedId = id;

        // Remove old ring
        if (this._ringMesh) {
            this.scene.remove(this._ringMesh);
            this._ringMesh.geometry.dispose();
            this._ringMesh.material.dispose();
            this._ringMesh = null;
        }

        if (!id) return;
        const g = this.gizmos.find(g => g.id === id);
        if (!g) return;

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
    }

    /** Raycast against all gizmos, returns closest hit id or null */
    raycast(raycaster) {
        const meshes = this.gizmos.map(g => g.mesh);
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length === 0) return null;
        return hits[0].object.userData.editorId;
    }

    /** Remove all gizmos */
    clear() {
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
