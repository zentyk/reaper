import * as THREE from 'three';
import { store } from '../store.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EditorGizmos } from './tools/EditorGizmos.js';

export class EditorCore {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.renderer = game.renderer;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.editorGizmos = new EditorGizmos(this.scene);

        // Transform Controls (Unity/UE5 Style Gizmos)
        this.editorCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.editorCamera.position.set(0, 15, 15);
        this.editorCamera.lookAt(0, 0, 0);

        this.orbitControls = new OrbitControls(this.editorCamera, this.renderer.domElement);
        this.orbitControls.enabled = false; // Disabled by default until editor opens

        this.transformControl = new TransformControls(this.editorCamera, this.renderer.domElement);
        this.isGizmoDragging = false;

        this.transformControl.addEventListener('dragging-changed', (event) => {
            this.isGizmoDragging = event.value;
            this.orbitControls.enabled = !event.value;
        });

        this.transformControl.addEventListener('change', () => this._onTransformChange());
        this.scene.add(this.transformControl);

        // Editor Viewport Interaction
        this._onClickBound = this._onEditorClick.bind(this);
        window.addEventListener('pointerdown', this._onClickBound);

        // Editor Hotkeys (W, E, R for Translate, Rotate, Scale)
        this._onKeyDownBound = (e) => {
            if (!store.showLevelEditor) return;
            switch (e.key.toLowerCase()) {
                case 'w': this.transformControl.setMode('translate'); break;
                case 'e': this.transformControl.setMode('rotate'); break;
                case 'r': this.transformControl.setMode('scale'); break;
            }
        };
        window.addEventListener('keydown', this._onKeyDownBound);
    }

    _onTransformChange() {
        if (!this.transformControl.object) return;

        const mesh = this.transformControl.object;

        if (this.editorGizmos && this.editorGizmos._ringMesh) {
            this.editorGizmos._ringMesh.position.copy(mesh.position);
        }

        if (this.isGizmoDragging && this.game.currentLevelData) {
            const type = mesh.userData.editorType;
            const id = mesh.userData.editorId;
            const pos = mesh.position;

            const syncItem = (list, yOffset = 0) => {
                if (!list) return;
                const it = list.find(i => i.id === id);
                if (it) {
                    if (it.pos) {
                        it.pos[0] = pos.x;
                        it.pos[1] = pos.y - yOffset;
                        it.pos[2] = pos.z;
                    }
                    if (mesh.rotation) {
                        it.rot = [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z];
                    }
                }
            };

            if (type === 'playerSpawn') {
                this.game.currentLevelData.playerSpawn.x = pos.x;
                this.game.currentLevelData.playerSpawn.y = pos.y - 1.0;
                this.game.currentLevelData.playerSpawn.z = pos.z;
                if (mesh.rotation) {
                    this.game.currentLevelData.playerSpawn.rot = [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z];
                }
            } else if (type === 'camera') {
                syncItem(this.game.currentLevelData.cameras, 0);
                if (this.game.cameras && this.game.cameras[this.game.currentLevelIndex]) {
                    const camObj = this.game.cameras[this.game.currentLevelIndex].find(c => c.camera.userData.id === id);
                    if (camObj) {
                        camObj.camera.position.copy(pos);
                        camObj.pos = [pos.x, pos.y, pos.z];
                        if (mesh.rotation) {
                            camObj.camera.rotation.copy(mesh.rotation);
                            camObj.rot = [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z];
                        }
                    }
                }
            } else if (type === 'light') {
                syncItem(this.game.currentLevelData.lights, 0);
                const light = this.scene.children.find(c => c.isPointLight && c.userData.id === id);
                if (light) {
                    light.position.copy(pos);
                }
            } else if (type === 'zombie') {
                syncItem(this.game.currentLevelData.zombies, 0.5);
            } else if (type === 'collectible') {
                syncItem(this.game.currentLevelData.collectibles, 0.3);
            } else if (type === 'cameraBounds') {
                const cam = this.game.currentLevelData.cameras.find(c => c.id === id);
                if (cam) {
                    const w = mesh.scale.x;
                    const d = mesh.scale.y;
                    cam.bounds.minX = pos.x - w / 2;
                    cam.bounds.maxX = pos.x + w / 2;
                    cam.bounds.minZ = pos.z - d / 2;
                    cam.bounds.maxZ = pos.z + d / 2;
                }
            }

            let entity = this.game.world.entities.find(e => e.persistentId === id);
            if (!entity && id === 'playerSpawn') {
                entity = this.game.playerEntity;
            }

            if (entity) {
                const transform = entity.components.Transform;
                if (transform) {
                    const yOffset = type === 'zombie' ? 0.5 : (type === 'collectible' ? 0.3 : (type === 'playerSpawn' ? 1.0 : 0));
                    const finalY = (type === 'cameraBounds') ? 0.05 : (pos.y - yOffset);
                    transform.position.set(pos.x, finalY, pos.z);
                    if (entity.rigidBody) {
                        entity.rigidBody.setTranslation({ x: pos.x, y: pos.y - yOffset, z: pos.z }, true);
                    }

                    if (mesh.rotation) {
                        transform.rotation.copy(mesh.rotation);
                    }

                    const meshComp = entity.components.MeshComponent;
                    if (meshComp && meshComp.mesh) {
                        meshComp.mesh.position.copy(transform.position);
                        meshComp.mesh.rotation.copy(transform.rotation);
                        meshComp.mesh.scale.copy(mesh.scale);
                    }
                }
            }

            store.editorLevelData = { ...this.game.currentLevelData };
        }
    }

    _onEditorClick(event) {
        if (!store.showLevelEditor) return;
        if (this.isGizmoDragging) return;

        if (event.target.closest('.editor-sidebar')) return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.transformControl.camera = this.editorCamera;
        this.raycaster.setFromCamera(this.mouse, this.editorCamera);

        const hit = this.editorGizmos.raycast(this.raycaster);
        const hitId = hit ? hit.id : null;
        const hitType = hit ? hit.type : null;

        if (store.editorTool === 'select') {
            store.editorSelectedId = hitId;
            this.editorGizmos.setSelected(hitId, hitType);

            if (hitId) {
                const g = this.editorGizmos.gizmos.find(x => x.id === hitId && (hitType ? x.type === hitType : true));
                if (g && g.mesh) {
                    this.transformControl.attach(g.mesh);
                }
            } else {
                this.transformControl.detach();
            }
            return;
        }

        if (this.game.levelManager.commonFloorMesh) {
            const intersects = this.raycaster.intersectObject(this.game.levelManager.commonFloorMesh);
            if (intersects.length > 0) {
                const p = intersects[0].point;
                this._placeEditorObject(store.editorTool, p.x, p.y, p.z);
            }
        }
    }

    _placeEditorObject(type, x, y, z) {
        if (!this.game.currentLevelData) return;

        const id = `${type}_${Date.now()}`;
        let newObj = null;

        if (type === 'playerSpawn') {
            this.game.currentLevelData.playerSpawn = { x, y, z, rot: [0, 0, 0] };
            newObj = { id: 'playerSpawn', pos: [x, y, z], rot: [0, 0, 0] };
        } else if (type === 'camera') {
            if (!this.game.currentLevelData.cameras) this.game.currentLevelData.cameras = [];
            newObj = { id, pos: [x, y + 10, z], lookAt: [x, 0, z], bounds: { minX: x - 5, maxX: x + 5, minZ: z - 5, maxZ: z + 5 } };
            this.game.currentLevelData.cameras.push(newObj);
        } else if (type === 'zombie') {
            if (!this.game.currentLevelData.zombies) this.game.currentLevelData.zombies = [];
            newObj = { id, pos: [x, y, z] };
            this.game.currentLevelData.zombies.push(newObj);
        } else if (type === 'collectible') {
            if (!this.game.currentLevelData.collectibles) this.game.currentLevelData.collectibles = [];
            newObj = { id, type: 'ammo', name: 'Handgun Ammo', amount: 15, pos: [x, y, z] };
            this.game.currentLevelData.collectibles.push(newObj);
        } else if (type === 'light') {
            if (!this.game.currentLevelData.lights) this.game.currentLevelData.lights = [];
            newObj = { id, pos: [x, y + 2, z], color: 16768426, intensity: 5, distance: 10 };
            this.game.currentLevelData.lights.push(newObj);

            const pLight = new THREE.PointLight(newObj.color, newObj.intensity, newObj.distance);
            pLight.position.set(x, y + 2, z);
            pLight.userData.id = id;
            this.scene.add(pLight);
        }

        store.editorLevelData = { ...this.game.currentLevelData };

        if (type === 'playerSpawn') {
            this.editorGizmos.removeById('playerSpawn');
            this.editorGizmos.addGizmo('playerSpawn', 'playerSpawn', x, y + 1, z);
        } else {
            let yOffset = 0;
            if (type === 'zombie') yOffset = 0.5;
            if (type === 'collectible') yOffset = 0.3;
            this.editorGizmos.addGizmo(type, id, newObj.pos[0], newObj.pos[1] + yOffset, newObj.pos[2]);
        }

        store.editorSelectedId = newObj.id;
        this.editorGizmos.setSelected(newObj.id);
    }

    update(dt) {
        if (!store.showLevelEditor) {
            if (this.orbitControls) this.orbitControls.enabled = false;
            return;
        }

        if (this.orbitControls) {
            if (!this.isGizmoDragging) this.orbitControls.enabled = true;
            this.orbitControls.update();
        }

        // Sync gizmo spheres back to ECS entities if they move
        if (this.editorGizmos && !this.isGizmoDragging) {
            this.editorGizmos.gizmos.forEach(g => {
                const id = g.id;
                if (g.type === 'camera') {
                    const camObj = this.game.cameras && this.game.cameras[this.game.currentLevelIndex] && this.game.cameras[this.game.currentLevelIndex].find(c => c.camera.userData.id === id);
                    if (camObj) {
                        g.mesh.position.copy(camObj.camera.position);
                        if (this.editorGizmos.selectedId === id && this.editorGizmos._ringMesh) {
                            this.editorGizmos._ringMesh.position.copy(g.mesh.position);
                        }
                    }
                } else if (g.type === 'light') {
                    const light = this.scene.children.find(c => c.isPointLight && c.userData.id === id);
                    if (light) {
                        g.mesh.position.copy(light.position);
                        if (this.editorGizmos.selectedId === id && this.editorGizmos._ringMesh) {
                            this.editorGizmos._ringMesh.position.copy(g.mesh.position);
                        }
                    }
                } else {
                    let entity = this.game.world.entities.find(e => e.persistentId === id);
                    if (!entity && id === 'playerSpawn') {
                        entity = this.game.playerEntity;
                    }

                    if (entity && entity.components.Transform) {
                        const tPos = entity.components.Transform.position;
                        const yOffset = g.type === 'zombie' ? 0.5 : (g.type === 'collectible' ? 0.3 : (g.type === 'playerSpawn' ? 1.0 : 0));
                        g.mesh.position.set(tPos.x, tPos.y + yOffset, tPos.z);

                        if (this.editorGizmos.selectedId === id && this.editorGizmos._ringMesh) {
                            this.editorGizmos._ringMesh.position.copy(g.mesh.position);
                        }

                        const meshComp = entity.components.MeshComponent;
                        if (meshComp && meshComp.mesh) {
                            meshComp.mesh.position.copy(entity.components.Transform.position);
                            meshComp.mesh.rotation.copy(entity.components.Transform.rotation);
                        }
                    }
                }
            });
        }
    }
}
