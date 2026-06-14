import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { UvPoint, PainZone } from '../models/pain-zone.model';
import { getPainType } from '../models/pain-types';

export interface RaycastHit {
  meshName: string;
  uv: UvPoint;
  worldPoint: THREE.Vector3;
}

/**
 * Calque de peinture par couleur de sommet (vertex color RGBA).
 * Aucune texture UV n'est utilisée pour la peinture : la couleur est stockée
 * directement sur chaque sommet du maillage, ce qui élimine tous les artefacts
 * liés aux chevauchements d'UV (atlas, miroir, coutures cylindriques).
 */
interface PaintLayer {
  mesh: THREE.Mesh;
  overlay: THREE.Mesh;
  /** Géométrie propre au calque (partage position/skinning mais couleur indépendante). */
  overlayGeo: THREE.BufferGeometry;
  /** Attribut RGBA per-vertex : itemSize=4 → Three.js active USE_COLOR_ALPHA. */
  colorAttr: THREE.Float32BufferAttribute;
  /** Positions monde des sommets pré-calculées (pose de repos = pose affichée). */
  worldPositions: Float32Array;
  /** Second overlay pour la carte de zones anatomiques (indépendant du calque douleur). */
  zoneOverlay: THREE.Mesh;
  zoneColorAttr: THREE.Float32BufferAttribute;
}


export class BodySceneEngine {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();

  private paintLayers = new Map<string, PaintLayer>();
  private raycastTargets: THREE.Mesh[] = [];

  private resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private disposed = false;

  onFrame: (() => void) | null = null;

  private modelRoot: THREE.Object3D | null = null;
  private modelRadius = 1;
  get currentModelRadius(): number { return this.modelRadius; }
  private modelCenter = new THREE.Vector3();

  private _focusTarget = new THREE.Vector3();
  private _focusCamPos = new THREE.Vector3();
  private _focusActive = false;
  private modelSize = new THREE.Vector3();

  private _keysPressed = new Set<string>();
  private readonly _arrowSpeed = 0.025;

  private readonly _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Shift') this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      this._keysPressed.add(e.key);
    }
  };
  private readonly _onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    this._keysPressed.delete(e.key);
  };

  constructor(private container: HTMLElement) {
    this.scene.background = new THREE.Color(0xeef3f4);

    const { clientWidth, clientHeight } = container;
    this.camera = new THREE.PerspectiveCamera(35, clientWidth / Math.max(clientHeight, 1), 0.05, 100);
    this.camera.position.set(0, 1.4, 3.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(clientWidth, clientHeight);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 8;
    this.controls.update();

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);

    this.setupLights();

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);

    this.animate();
  }

  get domElement(): HTMLCanvasElement { return this.renderer.domElement; }

  // -------------------------------------------------------------------------
  // Scène / lumières
  // -------------------------------------------------------------------------

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 4, 3);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.45);
    fill.position.set(-3, 1.5, -2);
    this.scene.add(fill);
  }

  async loadModel(url: string): Promise<void> {
    
    try {
      const gltf = await new GLTFLoader().loadAsync(url);
      this.registerModel(gltf.scene);
      this.frameModel();
    } catch (err) {
      console.info(`[doloris] Aucun modèle à "${url}"`, err);
      throw err;
    }
    
  }

  // -------------------------------------------------------------------------
  // Enregistrement du modèle
  // -------------------------------------------------------------------------

  private generateCylindricalUV(geometry: THREE.BufferGeometry, name: string): void {
    const pos = geometry.attributes['position'] as THREE.BufferAttribute | undefined;
    if (!pos) return;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const xR = (box.max.x - box.min.x) || 1;
    const yR = (box.max.y - box.min.y) || 1;
    const zR = (box.max.z - box.min.z) || 1;
    const uv = new Float32Array(pos.count * 2);
    if (xR > yR && xR > zR) {
      const cy = (box.min.y + box.max.y) / 2, cz = (box.min.z + box.max.z) / 2;
      for (let i = 0; i < pos.count; i++) {
        uv[i*2]   = 0.5 + Math.atan2(pos.getZ(i)-cz, pos.getY(i)-cy) / (2*Math.PI);
        uv[i*2+1] = 1 - (pos.getX(i) - box.min.x) / xR;
      }
    } else if (zR > yR && zR > xR) {
      const cx = (box.min.x + box.max.x) / 2, cy = (box.min.y + box.max.y) / 2;
      for (let i = 0; i < pos.count; i++) {
        uv[i*2]   = 0.5 + Math.atan2(pos.getY(i)-cy, pos.getX(i)-cx) / (2*Math.PI);
        uv[i*2+1] = 1 - (pos.getZ(i) - box.min.z) / zR;
      }
    } else {
      const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
      for (let i = 0; i < pos.count; i++) {
        uv[i*2]   = 0.5 + Math.atan2(pos.getZ(i)-cz, pos.getX(i)-cx) / (2*Math.PI);
        uv[i*2+1] = 1 - (pos.getY(i) - box.min.y) / yR;
      }
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    console.log(`[doloris] UV cylindriques pour "${name}"`);
  }

  private registerModel(root: THREE.Object3D, forceGenerateUV = false): void {
    this.modelRoot = root;
    this.scene.add(root);

    const meshes: THREE.Mesh[] = [];
    const usedNames = new Set<string>();
    let idx = 0;
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const attrs = obj.geometry?.attributes;
      if (!attrs) return;
      if (!attrs['uv'] && attrs['uv1']) obj.geometry.setAttribute('uv', attrs['uv1']);
      else if (!attrs['uv'] || forceGenerateUV) this.generateCylindricalUV(obj.geometry, obj.name);
      if (!obj.geometry.attributes['uv']) return;
      let name = obj.name || '';
      if (!name || usedNames.has(name)) { name = `partie-${idx}`; obj.name = name; }
      usedNames.add(name);
      idx++;
      meshes.push(obj);
    });

    console.log(`[doloris] ${meshes.length} maillage(s) : ${meshes.map(m => `"${m.name}"`).join(', ')}`);
    if (!meshes.length) console.warn('[doloris] Aucun maillage peignable.');

    root.updateMatrixWorld(true);
    for (const mesh of meshes) this.createPaintLayer(mesh);
  }

  // -------------------------------------------------------------------------
  // Calque de peinture (vertex color)
  // -------------------------------------------------------------------------

  private createPaintLayer(mesh: THREE.Mesh): void {
    console.log(`[doloris] createPaintLayer "${mesh.name}" (${mesh instanceof THREE.SkinnedMesh ? 'SkinnedMesh' : 'Mesh'}, ${mesh.geometry.attributes['position']?.count ?? 0} sommets)`);
    const posAttr = mesh.geometry.attributes['position'] as THREE.BufferAttribute | undefined;
    if (!posAttr) return;

    const isSkinned = mesh instanceof THREE.SkinnedMesh;
    let overlayGeo: THREE.BufferGeometry;

    if (isSkinned) {
      // SkinnedMesh : partage position + skinning (pas de subdivision pour éviter
      // d'interpoler les poids d'os aux points médians).
      overlayGeo = new THREE.BufferGeometry();
      if (mesh.geometry.index) overlayGeo.setIndex(mesh.geometry.index);
      overlayGeo.setAttribute('position', posAttr);
      const si = mesh.geometry.attributes['skinIndex'];
      const sw = mesh.geometry.attributes['skinWeight'];
      if (si) overlayGeo.setAttribute('skinIndex', si);
      if (sw) overlayGeo.setAttribute('skinWeight', sw);
    } else {
      // Mesh statique : 2 niveaux de subdivision → 16× plus de sommets → meilleure
      // résolution de peinture sans modifier le maillage d'affichage.
      overlayGeo = this.subdivideGeometry(this.subdivideGeometry(mesh.geometry));
    }

    const paintPosAttr = overlayGeo.attributes['position'] as THREE.BufferAttribute;
    const vCount = paintPosAttr.count;
    console.log(`[doloris] overlay : ${vCount} sommets`);

    // itemSize=4 → Three.js détecte USE_COLOR_ALPHA : alpha per-vertex fonctionnel
    const colorAttr = new THREE.Float32BufferAttribute(new Float32Array(vCount * 4), 4);
    overlayGeo.setAttribute('color', colorAttr);

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
    });

    let overlay: THREE.Mesh;
    if (mesh instanceof THREE.SkinnedMesh && mesh.skeleton) {
      const sk = new THREE.SkinnedMesh(overlayGeo, mat);
      sk.bind(mesh.skeleton, mesh.bindMatrix);
      overlay = sk;
    } else {
      overlay = new THREE.Mesh(overlayGeo, mat);
    }
    mesh.add(overlay);

    // --- Second overlay : carte de zones anatomiques (rendu sous le calque douleur) ---
    const zoneGeo = new THREE.BufferGeometry();
    if (overlayGeo.index) zoneGeo.setIndex(overlayGeo.index);
    zoneGeo.setAttribute('position', overlayGeo.attributes['position']);
    if (isSkinned) {
      const si = overlayGeo.attributes['skinIndex'];
      const sw = overlayGeo.attributes['skinWeight'];
      if (si) zoneGeo.setAttribute('skinIndex', si);
      if (sw) zoneGeo.setAttribute('skinWeight', sw);
    }
    const zoneColorAttr = new THREE.Float32BufferAttribute(new Float32Array(vCount * 4), 4);
    zoneGeo.setAttribute('color', zoneColorAttr);

    const zoneMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    });

    let zoneOverlay: THREE.Mesh;
    if (mesh instanceof THREE.SkinnedMesh && mesh.skeleton) {
      const sk = new THREE.SkinnedMesh(zoneGeo, zoneMat);
      sk.bind(mesh.skeleton, mesh.bindMatrix);
      zoneOverlay = sk;
    } else {
      zoneOverlay = new THREE.Mesh(zoneGeo, zoneMat);
    }
    mesh.add(zoneOverlay);

    const worldPositions = this.buildWorldPositions(paintPosAttr, mesh.matrixWorld);
    this.raycastTargets.push(mesh);
    this.paintLayers.set(mesh.name, { mesh, overlay, overlayGeo, colorAttr, worldPositions, zoneOverlay, zoneColorAttr });
  }

  /**
   * Subdivision 1 niveau (midpoint) : chaque triangle → 4 sous-triangles.
   * Les points médians des arêtes partagées sont dédupliqués via une Map.
   * Produit uniquement l'attribut "position" (color sera ajouté ensuite).
   */
  private subdivideGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry {
    const srcPos = geo.attributes['position'] as THREE.BufferAttribute;
    const srcIdx = geo.index;
    const positions: number[] = [];

    for (let i = 0; i < srcPos.count; i++) {
      positions.push(srcPos.getX(i), srcPos.getY(i), srcPos.getZ(i));
    }

    const indices: number[] = [];
    const edgeMap = new Map<string, number>();

    const midpoint = (i1: number, i2: number): number => {
      const key = i1 < i2 ? `${i1}|${i2}` : `${i2}|${i1}`;
      let idx = edgeMap.get(key);
      if (idx !== undefined) return idx;
      idx = positions.length / 3;
      positions.push(
        (srcPos.getX(i1) + srcPos.getX(i2)) / 2,
        (srcPos.getY(i1) + srcPos.getY(i2)) / 2,
        (srcPos.getZ(i1) + srcPos.getZ(i2)) / 2,
      );
      edgeMap.set(key, idx);
      return idx;
    };

    if (srcIdx) {
      const arr = srcIdx.array;
      for (let f = 0; f < arr.length; f += 3) {
        const a = arr[f], b = arr[f + 1], c = arr[f + 2];
        const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
        indices.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      }
    } else {
      for (let f = 0; f < srcPos.count; f += 3) {
        const ab = midpoint(f, f + 1), bc = midpoint(f + 1, f + 2), ca = midpoint(f + 2, f);
        indices.push(f, ab, ca, ab, f + 1, bc, ca, bc, f + 2, ab, bc, ca);
      }
    }

    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3));
    // Uint32 requis si > 65 535 sommets (probable après subdivision)
    result.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    return result;
  }

  private buildWorldPositions(posAttr: THREE.BufferAttribute, matrixWorld: THREE.Matrix4): Float32Array {
    const n = posAttr.count;
    const out = new Float32Array(n * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(matrixWorld);
      out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Caméra / vue
  // -------------------------------------------------------------------------

  private frameModel(): void {
    this.scene.updateMatrixWorld(true);
    if (!this.modelRoot) return;
    const box = new THREE.Box3().expandByObject(this.modelRoot);
    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = size.length() * 0.5 || 0.5;
    this.modelRadius = radius;
    this.modelCenter.copy(center);
    this.modelSize.copy(size);
    this.camera.near = radius / 100;
    this.camera.far  = radius * 1000;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = radius * 0.3;
    this.controls.maxDistance = radius * 12;
    this.resetView();
  }

  resetView(animated = false): void {
    const { clientWidth, clientHeight } = this.container;
    if (clientWidth > 0 && clientHeight > 0) {
      this.camera.aspect = clientWidth / clientHeight;
      this.camera.updateProjectionMatrix();
    }
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const distV = (this.modelSize.y / 2) / Math.tan(vFov / 2);
    const distH = (this.modelSize.x / 2) / Math.tan(hFov / 2);
    const dist  = Math.max(distV, distH, this.modelRadius) * 1.2;
    const targetPos = new THREE.Vector3(this.modelCenter.x, this.modelCenter.y, this.modelCenter.z + dist);
    if (animated) {
      this._focusTarget.copy(this.modelCenter);
      this._focusCamPos.copy(targetPos);
      this._focusActive = true;
    } else {
      this.camera.position.copy(targetPos);
      this.camera.lookAt(this.modelCenter);
      this.controls.target.copy(this.modelCenter);
      this.controls.update();
    }
  }

  // -------------------------------------------------------------------------
  // Focus / capture de zone
  // -------------------------------------------------------------------------

  private resolveZone(
    layer: PaintLayer,
    points: UvPoint[]
  ): { worldPos: THREE.Vector3; dir: THREE.Vector3 } | null {
    const uvAttr  = layer.mesh.geometry.attributes['uv']       as THREE.BufferAttribute | undefined;
    const posAttr = layer.mesh.geometry.attributes['position'] as THREE.BufferAttribute | undefined;
    if (!uvAttr || !posAttr) return null;

    const avgU = points.reduce((s, p) => s + p.u, 0) / points.length;
    const avgV = points.reduce((s, p) => s + p.v, 0) / points.length;
    let maxR2 = 0;
    for (const p of points) {
      const r2 = (p.u-avgU)**2 + (p.v-avgV)**2;
      if (r2 > maxR2) maxR2 = r2;
    }
    const searchR2 = Math.max(maxR2 * 2.25, 0.004);

    let closestIdx = 0, closestDist = Infinity;
    for (let i = 0; i < uvAttr.count; i++) {
      const d = (uvAttr.getX(i)-avgU)**2 + (uvAttr.getY(i)-avgV)**2;
      if (d < closestDist) { closestDist = d; closestIdx = i; }
    }

    const worldPos = new THREE.Vector3(
      posAttr.getX(closestIdx), posAttr.getY(closestIdx), posAttr.getZ(closestIdx)
    ).applyMatrix4(layer.mesh.matrixWorld);

    const normAttr = layer.mesh.geometry.attributes['normal'] as THREE.BufferAttribute | undefined;
    let dir: THREE.Vector3;
    if (normAttr) {
      const avg = new THREE.Vector3();
      let count = 0;
      for (let i = 0; i < uvAttr.count; i++) {
        if ((uvAttr.getX(i)-avgU)**2 + (uvAttr.getY(i)-avgV)**2 <= searchR2) {
          avg.x += normAttr.getX(i); avg.y += normAttr.getY(i); avg.z += normAttr.getZ(i);
          count++;
        }
      }
      dir = count > 0
        ? avg.divideScalar(count).transformDirection(layer.mesh.matrixWorld).normalize()
        : worldPos.clone().sub(this.modelCenter).normalize();
    } else {
      dir = worldPos.clone().sub(this.modelCenter).normalize();
    }
    return { worldPos, dir };
  }

  focusOnZone(meshName: string, points: UvPoint[]): void {
    if (!points.length) return;
    const layer = this.paintLayers.get(meshName);
    if (!layer) return;
    const zone = this.resolveZone(layer, points);
    if (!zone) return;
    this._focusTarget.copy(zone.worldPos);
    this._focusCamPos.copy(zone.worldPos).addScaledVector(zone.dir, this.modelRadius * 0.45);
    this._focusActive = true;
  }

  captureZone(meshName: string, points: UvPoint[]): string {
    if (!points.length || this.disposed) return '';
    const layer = this.paintLayers.get(meshName);
    if (!layer) return '';
    const zone = this.resolveZone(layer, points);
    if (!zone) return '';
    const dist = this.modelRadius * 0.45;
    const savedPos    = this.camera.position.clone();
    const savedTarget = this.controls.target.clone();
    const savedFocus  = this._focusActive;
    this._focusActive = false;
    this.camera.position.copy(zone.worldPos).addScaledVector(zone.dir, dist);
    this.controls.target.copy(zone.worldPos);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/jpeg', 0.82);
    this._focusActive = savedFocus;
    this.camera.position.copy(savedPos);
    this.controls.target.copy(savedTarget);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    return dataUrl;
  }

  // -------------------------------------------------------------------------
  // Raycast
  // -------------------------------------------------------------------------

  raycastFromScreen(clientX: number, clientY: number): RaycastHit | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width)  * 2 - 1,
      -((clientY - rect.top)  / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.raycastTargets, false);
    const hit  = hits.find(h => !!h.uv);
    if (!hit?.uv) return null;
    if (!this.paintLayers.has(hit.object.name)) return null;
    return {
      meshName: hit.object.name,
      uv: { u: hit.uv.x, v: hit.uv.y, wx: hit.point.x, wy: hit.point.y, wz: hit.point.z },
      worldPoint: hit.point.clone(),
    };
  }

  /** Affiche ou masque le calque de zone map sans effacer le buffer peint. */
  setZoneMapVisible(visible: boolean): void {
    for (const layer of this.paintLayers.values()) {
      layer.zoneOverlay.visible = visible;
    }
  }

  /**
   * Peint directement la zone map en appliquant une couleur fixe à tous les
   * sommets du maillage dans le rayon du pinceau.
   * Contrairement à paintAt, pas de dégradé : couvrance totale dans le rayon.
   */
  paintZone(meshName: string, worldPoint: THREE.Vector3, colorHex: string, brushRadius: number): void {
    const layer = this.paintLayers.get(meshName);
    if (!layer) return;
    const { zoneColorAttr, worldPositions } = layer;
    const worldR = brushRadius * this.modelRadius;
    const r2 = worldR * worldR;
    const arr = zoneColorAttr.array as Float32Array;
    const px = worldPoint.x, py = worldPoint.y, pz = worldPoint.z;
    const n = zoneColorAttr.count;
    const r = parseInt(colorHex.slice(1, 3), 16) / 255;
    const g = parseInt(colorHex.slice(3, 5), 16) / 255;
    const b = parseInt(colorHex.slice(5, 7), 16) / 255;
    let dirty = false;
    for (let i = 0; i < n; i++) {
      const dx = px - worldPositions[i * 3];
      const dy = py - worldPositions[i * 3 + 1];
      const dz = pz - worldPositions[i * 3 + 2];
      if (dx * dx + dy * dy + dz * dz >= r2) continue;
      arr[i * 4]     = r;
      arr[i * 4 + 1] = g;
      arr[i * 4 + 2] = b;
      arr[i * 4 + 3] = 0.40;
      dirty = true;
    }
    if (dirty) zoneColorAttr.needsUpdate = true;
  }

  /** Rejoue une liste de tracés de zone (restauration depuis localStorage). */
  replayZoneDrags(drags: ReadonlyArray<{
    meshName: string; colorHex: string; brushRadius: number;
    points: ReadonlyArray<{ wx: number; wy: number; wz: number }>;
  }>): void {
    const v = new THREE.Vector3();
    for (const drag of drags) {
      for (const p of drag.points) {
        this.paintZone(drag.meshName, v.set(p.wx, p.wy, p.wz), drag.colorHex, drag.brushRadius);
      }
    }
  }

  /**
   * Version optimisée de replayZoneDrags : un seul parcours des sommets par mesh
   * au lieu de N_points parcours. Les couleurs et rayons sont pré-calculés par drag.
   * Sémantique identique : last drag wins (les drags sont appliqués dans l'ordre).
   */
  replayZoneDragsBatch(drags: ReadonlyArray<{
    meshName: string; colorHex: string; brushRadius: number;
    points: ReadonlyArray<{ wx: number; wy: number; wz: number }>;
  }>): void {
    type PreparedDrag = {
      r: number; g: number; b: number; r2: number;
      points: ReadonlyArray<{ wx: number; wy: number; wz: number }>;
    };

    // Grouper par meshName en conservant l'ordre d'application
    const byMesh = new Map<string, PreparedDrag[]>();
    for (const drag of drags) {
      const worldR = drag.brushRadius * this.modelRadius;
      const prepared: PreparedDrag = {
        r:  parseInt(drag.colorHex.slice(1, 3), 16) / 255,
        g:  parseInt(drag.colorHex.slice(3, 5), 16) / 255,
        b:  parseInt(drag.colorHex.slice(5, 7), 16) / 255,
        r2: worldR * worldR,
        points: drag.points,
      };
      const list = byMesh.get(drag.meshName);
      if (list) list.push(prepared);
      else byMesh.set(drag.meshName, [prepared]);
    }

    for (const [meshName, meshDrags] of byMesh) {
      const layer = this.paintLayers.get(meshName);
      if (!layer) continue;
      const { zoneColorAttr, worldPositions } = layer;
      const arr = zoneColorAttr.array as Float32Array;
      const n = zoneColorAttr.count;
      let dirty = false;

      for (let i = 0; i < n; i++) {
        const vx = worldPositions[i * 3];
        const vy = worldPositions[i * 3 + 1];
        const vz = worldPositions[i * 3 + 2];

        for (const d of meshDrags) {
          for (const p of d.points) {
            const dx = p.wx - vx, dy = p.wy - vy, dz = p.wz - vz;
            if (dx * dx + dy * dy + dz * dz < d.r2) {
              arr[i * 4]     = d.r;
              arr[i * 4 + 1] = d.g;
              arr[i * 4 + 2] = d.b;
              arr[i * 4 + 3] = 0.40;
              dirty = true;
              break; // un seul point suffit pour ce drag
            }
          }
        }
      }

      if (dirty) zoneColorAttr.needsUpdate = true;
    }
  }

  /** Efface le buffer de zone map (tous les alpha → 0) et masque l'overlay. */
  clearZoneMap(): void {
    for (const layer of this.paintLayers.values()) {
      (layer.zoneColorAttr.array as Float32Array).fill(0);
      layer.zoneColorAttr.needsUpdate = true;
      layer.zoneOverlay.visible = false;
    }
  }

  // -------------------------------------------------------------------------
  // Peinture (vertex color, espace monde)
  // -------------------------------------------------------------------------

  /**
   * Peint un point en espace monde en mettant à jour les couleurs RGBA des
   * sommets situés dans le rayon du pinceau.
   *
   * L'alpha par sommet décroît de façon quadratique avec la distance au centre
   * du pinceau (bords doux). Le compositing "over" préserve les couches déjà
   * peintes et les mélange avec la nouvelle couleur.
   */
  paintAt(meshName: string, worldPoint: THREE.Vector3, colorHex: string, intensity: number, brushRadius: number): void {
    const layer = this.paintLayers.get(meshName);
    if (!layer) return;

    const { colorAttr, worldPositions } = layer;
    const worldRadius = brushRadius * this.modelRadius;
    const r2 = worldRadius * worldRadius;
    const maxAlpha = 0.22 + (intensity / 10) * 0.55;

    // Low intensity → pastel (blend toward white); high intensity → full vivid color
    const intensityT = (intensity - 1) / 9; // 0 at intensity=1, 1 at intensity=10
    const baseRatio = 0.18 + intensityT * 0.82;
    const tc = new THREE.Color(colorHex);
    const pr = tc.r + (1 - tc.r) * (1 - baseRatio);
    const pg = tc.g + (1 - tc.g) * (1 - baseRatio);
    const pb = tc.b + (1 - tc.b) * (1 - baseRatio);
    const arr = colorAttr.array as Float32Array;
    const px = worldPoint.x, py = worldPoint.y, pz = worldPoint.z;
    const n = colorAttr.count;
    let dirty = false;

    for (let i = 0; i < n; i++) {
      const dx = px - worldPositions[i*3];
      const dy = py - worldPositions[i*3+1];
      const dz = pz - worldPositions[i*3+2];
      const d2 = dx*dx + dy*dy + dz*dz;
      if (d2 >= r2) continue;

      const t = 1 - Math.sqrt(d2) / worldRadius; // 0..1
      const strokeA = maxAlpha * t * t;           // décroissance quadratique
      if (strokeA < 0.004) continue;

      const base = i * 4;
      const existA = arr[base + 3];
      const newA   = existA + strokeA * (1 - existA);
      if (newA < 0.001) continue;

      // Compositing "over"
      const blend = strokeA * (1 - existA) / newA;
      arr[base]   += (pr - arr[base])   * blend;
      arr[base+1] += (pg - arr[base+1]) * blend;
      arr[base+2] += (pb - arr[base+2]) * blend;
      arr[base+3]  = newA;
      dirty = true;
    }

    if (dirty) colorAttr.needsUpdate = true;
  }

  /** Efface toutes les couleurs de sommet puis redessine toutes les zones. */
  redrawAll(zones: PainZone[]): void {
    for (const layer of this.paintLayers.values()) {
      (layer.colorAttr.array as Float32Array).fill(0);
      layer.colorAttr.needsUpdate = true;
    }
    for (const zone of zones) {
      const type  = getPainType(zone.type);
      const layer = this.paintLayers.get(zone.meshName);
      if (!layer) continue;
      for (const pt of zone.points) {
        const wp = (pt.wx !== undefined && pt.wy !== undefined && pt.wz !== undefined)
          ? new THREE.Vector3(pt.wx, pt.wy, pt.wz)
          : this.uvToWorldPoint(layer, pt.u, pt.v);
        this.paintAt(zone.meshName, wp, type.color, zone.intensity, zone.brushRadius);
      }
    }
  }

  /** Fallback pour les anciens points sans coordonnées monde : sommet UV le plus proche. */
  private uvToWorldPoint(layer: PaintLayer, u: number, v: number): THREE.Vector3 {
    const uvAttr = layer.mesh.geometry.attributes['uv'] as THREE.BufferAttribute;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < uvAttr.count; i++) {
      const d = (uvAttr.getX(i)-u)**2 + (uvAttr.getY(i)-v)**2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return new THREE.Vector3(
      layer.worldPositions[best*3],
      layer.worldPositions[best*3+1],
      layer.worldPositions[best*3+2],
    );
  }

  private applyKeyboardCamera(): void {
    const hasArrow = this._keysPressed.has('ArrowLeft') || this._keysPressed.has('ArrowRight')
                  || this._keysPressed.has('ArrowUp')   || this._keysPressed.has('ArrowDown');
    if (!hasArrow) return;
    if (this._focusActive) this._focusActive = false;

    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    if (this._keysPressed.has('ArrowLeft'))  spherical.theta -= this._arrowSpeed;
    if (this._keysPressed.has('ArrowRight')) spherical.theta += this._arrowSpeed;
    if (this._keysPressed.has('ArrowUp'))    spherical.phi   -= this._arrowSpeed;
    if (this._keysPressed.has('ArrowDown'))  spherical.phi   += this._arrowSpeed;

    spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi));
    spherical.makeSafe();
    offset.setFromSpherical(spherical);
    this.camera.position.copy(this.controls.target).add(offset);
  }

  setControlsEnabled(enabled: boolean): void { this.controls.enabled = enabled; }

  get paintableMeshNames(): string[] { return Array.from(this.paintLayers.keys()); }

  // -------------------------------------------------------------------------
  // Cycle de vie
  // -------------------------------------------------------------------------

  private onResize(): void {
    const { clientWidth, clientHeight } = this.container;
    if (!clientWidth || !clientHeight) return;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }

  private animate = (): void => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    if (this._focusActive) {
      this.controls.target.lerp(this._focusTarget, 0.09);
      this.camera.position.lerp(this._focusCamPos, 0.09);
      if (this.controls.target.distanceTo(this._focusTarget) < this.modelRadius * 0.002) {
        this.controls.target.copy(this._focusTarget);
        this.camera.position.copy(this._focusCamPos);
        this._focusActive = false;
      }
    }
    this.applyKeyboardCamera();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    this.controls.dispose();

    for (const layer of this.paintLayers.values()) {
      layer.overlayGeo.dispose();
      (layer.overlay.material as THREE.Material).dispose();
      layer.zoneOverlay.geometry.dispose();
      (layer.zoneOverlay.material as THREE.Material).dispose();
    }

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material?.dispose();
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
