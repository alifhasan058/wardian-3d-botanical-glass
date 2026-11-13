import * as THREE from 'three';
import type { SpecimenInfo } from '../types/terrarium';
import type { TerrariumMaterials } from './materials';
import { groundHeightAt, POND_CENTER_X, POND_CENTER_Z, TERRARIUM_RADIUS } from './terrain';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface FloraBuildResult {
  group: THREE.Group;
  interactables: THREE.Object3D[];
  mushroomLightAnchor: THREE.Vector3;
  dispose: () => void;
}

function attachSpecimenProxy(
  parent: THREE.Group,
  specimen: SpecimenInfo,
  radius: number,
  height: number,
  interactables: THREE.Object3D[],
  geometries: THREE.BufferGeometry[],
  materialsToDispose: THREE.Material[]
): void {
  parent.userData.specimen = specimen;
  const proxyGeo = new THREE.CylinderGeometry(radius, radius, height, 10);
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const proxy = new THREE.Mesh(proxyGeo, proxyMat);
  proxy.position.y = height * 0.5;
  proxy.layers.set(1);
  proxy.userData.specimen = specimen;
  proxy.userData.parentGroup = parent;
  parent.add(proxy);
  interactables.push(proxy);
  geometries.push(proxyGeo);
  materialsToDispose.push(proxyMat);
}

export function createTerrariumFlora(
  seed: number,
  materials: TerrariumMaterials
): FloraBuildResult {
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const localMaterials: THREE.Material[] = [];
  const interactables: THREE.Object3D[] = [];

  // Shared helper to avoid placing flora inside the pond
  const isNearPond = (x: number, z: number, margin = 0.64) =>
    Math.hypot(x - POND_CENTER_X, z - POND_CENTER_Z) < margin;

  // -------------------------------------------------------------------------
  // 1. Hero Bonsai Ficus / Japanese Maple Tree (Composite 10-part sculpture)
  // -------------------------------------------------------------------------
  const bonsaiPos = new THREE.Vector2(-0.56 + (rand() - 0.5) * 0.14, -0.36 + (rand() - 0.5) * 0.14);
  const bonsaiGroup = new THREE.Group();
  bonsaiGroup.position.set(bonsaiPos.x, groundHeightAt(bonsaiPos.x, bonsaiPos.y) - 0.02, bonsaiPos.y);
  bonsaiGroup.rotation.y = rand() * Math.PI * 2;

  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.08, 0.34, 0.04),
    new THREE.Vector3(-0.07, 0.72, -0.04),
    new THREE.Vector3(0.05, 1.12, 0.03),
    new THREE.Vector3(0.14, 1.42, -0.02),
  ]);
  const trunkGeo = new THREE.TubeGeometry(trunkCurve, 22, 0.075, 10, false);
  // Taper trunk radius slightly by height
  const tPos = trunkGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const py = tPos.getY(i);
    const taper = THREE.MathUtils.lerp(1.25, 0.42, THREE.MathUtils.clamp(py / 1.45, 0, 1));
    const center = trunkCurve.getPointAt(THREE.MathUtils.clamp(py / 1.45, 0, 1));
    tPos.setX(i, center.x + (tPos.getX(i) - center.x) * taper);
    tPos.setZ(i, center.z + (tPos.getZ(i) - center.z) * taper);
  }
  trunkGeo.computeVertexNormals();
  const trunkMesh = new THREE.Mesh(trunkGeo, materials.bark);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  bonsaiGroup.add(trunkMesh);
  geometries.push(trunkGeo);

  // Exposed surface root buttresses (3 parts)
  for (let r = 0; r < 3; r++) {
    const ra = (r / 3) * Math.PI * 2 + 0.4;
    const rootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(ra) * 0.05, 0.14, Math.sin(ra) * 0.05),
      new THREE.Vector3(Math.cos(ra) * 0.14, 0.04, Math.sin(ra) * 0.14),
      new THREE.Vector3(Math.cos(ra) * 0.24, -0.02, Math.sin(ra) * 0.24),
    ]);
    const rootGeo = new THREE.TubeGeometry(rootCurve, 8, 0.026, 7, false);
    const rootMesh = new THREE.Mesh(rootGeo, materials.bark);
    rootMesh.castShadow = true;
    bonsaiGroup.add(rootMesh);
    geometries.push(rootGeo);
  }

  // Secondary limbs + layered foliage canopy pads (5 organic cloud pads)
  const branchConfigs = [
    { start: new THREE.Vector3(-0.04, 0.78, -0.02), end: new THREE.Vector3(-0.38, 1.04, 0.16), padR: 0.26 },
    { start: new THREE.Vector3(0.03, 1.0, 0.02), end: new THREE.Vector3(0.36, 1.22, 0.22), padR: 0.24 },
    { start: new THREE.Vector3(0.06, 1.18, -0.01), end: new THREE.Vector3(-0.18, 1.4, -0.26), padR: 0.23 },
    { start: new THREE.Vector3(0.14, 1.42, -0.02), end: new THREE.Vector3(0.18, 1.62, -0.04), padR: 0.31 },
  ];

  const padGeo = new THREE.IcosahedronGeometry(1, 2);
  // Sculpt slightly flattened, bumpy organic foliage cloud
  const pAttr = padGeo.attributes.position;
  for (let i = 0; i < pAttr.count; i++) {
    const px = pAttr.getX(i);
    const py = pAttr.getY(i);
    const pz = pAttr.getZ(i);
    const bump = 1.0 + 0.16 * Math.sin(px * 5.2 + pz * 4.1) * Math.cos(py * 6.0);
    pAttr.setXYZ(i, px * bump, py * 0.52 * bump, pz * bump);
  }
  padGeo.computeVertexNormals();
  geometries.push(padGeo);

  branchConfigs.forEach((b, idx) => {
    const mid = b.start.clone().lerp(b.end, 0.5);
    mid.y += 0.08;
    const bCurve = new THREE.CatmullRomCurve3([b.start, mid, b.end]);
    const bGeo = new THREE.TubeGeometry(bCurve, 10, 0.024, 7, false);
    const bMesh = new THREE.Mesh(bGeo, materials.bark);
    bMesh.castShadow = true;
    bonsaiGroup.add(bMesh);
    geometries.push(bGeo);

    const padMat = materials.canopyLeaf.clone();
    padMat.color.offsetHSL((idx - 1.5) * 0.015, 0.04, (idx % 2 === 0 ? 1 : -1) * 0.03);
    // Copy onBeforeCompile so wind sway still runs on cloned canopy material
    padMat.onBeforeCompile = materials.canopyLeaf.onBeforeCompile;
    localMaterials.push(padMat);

    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.copy(b.end);
    pad.scale.set(b.padR, b.padR * 0.85, b.padR * 0.92);
    pad.rotation.y = rand() * Math.PI;
    pad.castShadow = true;
    pad.receiveShadow = true;
    bonsaiGroup.add(pad);
  });

  // Top sub-crown accent pad
  const topCrown = new THREE.Mesh(padGeo, materials.canopyLeaf);
  topCrown.position.set(0.06, 1.72, 0.04);
  topCrown.scale.set(0.22, 0.18, 0.22);
  topCrown.castShadow = true;
  bonsaiGroup.add(topCrown);

  attachSpecimenProxy(
    bonsaiGroup,
    {
      id: 'bonsai-ficus',
      commonName: 'Dwarf Banyan Ficus',
      latinName: 'Ficus microcarpa',
      category: 'Canopy',
      humidityPreference: '65% - 85% RH',
      notes: 'Aerial roots and dense evergreen crown anchor the humid upper canopy.',
    },
    0.48,
    1.85,
    interactables,
    geometries,
    localMaterials
  );
  group.add(bonsaiGroup);

  // -------------------------------------------------------------------------
  // 2. Sculpted Driftwood Bough (Composite 6-part driftwood + perched moss)
  // -------------------------------------------------------------------------
  const driftGroup = new THREE.Group();
  const driftX = -0.18 + (rand() - 0.5) * 0.12;
  const driftZ = 0.25 + (rand() - 0.5) * 0.12;
  driftGroup.position.set(driftX, groundHeightAt(driftX, driftZ) - 0.02, driftZ);
  driftGroup.rotation.y = -0.45 + (rand() - 0.5) * 0.5;

  const mainLogCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.36, 0.02, 0.12),
    new THREE.Vector3(-0.08, 0.18, 0.02),
    new THREE.Vector3(0.26, 0.34, -0.08),
    new THREE.Vector3(0.52, 0.42, -0.16),
  ]);
  const mainLogGeo = new THREE.TubeGeometry(mainLogCurve, 20, 0.068, 9, false);
  const mlPos = mainLogGeo.attributes.position;
  for (let i = 0; i < mlPos.count; i++) {
    const px = mlPos.getX(i);
    const t = THREE.MathUtils.clamp((px + 0.36) / 0.88, 0, 1);
    const taper = THREE.MathUtils.lerp(1.2, 0.38, t);
    const c = mainLogCurve.getPointAt(t);
    mlPos.setY(i, c.y + (mlPos.getY(i) - c.y) * taper);
    mlPos.setZ(i, c.z + (mlPos.getZ(i) - c.z) * taper);
  }
  mainLogGeo.computeVertexNormals();
  const mainLogMesh = new THREE.Mesh(mainLogGeo, materials.bark);
  mainLogMesh.castShadow = true;
  mainLogMesh.receiveShadow = true;
  driftGroup.add(mainLogMesh);
  geometries.push(mainLogGeo);

  const spurCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, 0.2, 0.0),
    new THREE.Vector3(0.12, 0.38, 0.14),
    new THREE.Vector3(0.22, 0.52, 0.22),
  ]);
  const spurGeo = new THREE.TubeGeometry(spurCurve, 12, 0.028, 7, false);
  const spurMesh = new THREE.Mesh(spurGeo, materials.bark);
  spurMesh.castShadow = true;
  driftGroup.add(spurMesh);
  geometries.push(spurGeo);

  const mossCapGeo = new THREE.SphereGeometry(0.075, 10, 8);
  mossCapGeo.scale(1.3, 0.48, 0.95);
  geometries.push(mossCapGeo);
  for (let m = 0; m < 3; m++) {
    const pt = mainLogCurve.getPointAt(0.25 + m * 0.22);
    const cap = new THREE.Mesh(mossCapGeo, materials.moss);
    cap.position.set(pt.x, pt.y + 0.042, pt.z);
    cap.rotation.z = 0.25;
    cap.receiveShadow = true;
    driftGroup.add(cap);
  }

  attachSpecimenProxy(
    driftGroup,
    {
      id: 'driftwood',
      commonName: 'Bogwood & Velvet Moss',
      latinName: 'Bryophyta on Taxodium',
      category: 'Hardscape',
      humidityPreference: '70% - 90% RH',
      notes: 'Aged hardwood branch colonized by cushion moss along its upper grain.',
    },
    0.34,
    0.55,
    interactables,
    geometries,
    localMaterials
  );
  group.add(driftGroup);

  // -------------------------------------------------------------------------
  // 3. Layered Slate Stone Outcrop (4 sculpted stones + moss pads)
  // -------------------------------------------------------------------------
  const rockCluster = new THREE.Group();
  const rockBaseX = 0.58;
  const rockBaseZ = -0.36;
  rockCluster.position.set(rockBaseX, groundHeightAt(rockBaseX, rockBaseZ) - 0.02, rockBaseZ);

  const rawRockGeo = new THREE.DodecahedronGeometry(0.2, 1);
  const rPos = rawRockGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const rx = rPos.getX(i);
    const ry = rPos.getY(i);
    const rz = rPos.getZ(i);
    const n = 1 + 0.22 * Math.sin(rx * 11 + rz * 7) * Math.cos(ry * 9);
    rPos.setXYZ(i, rx * n * 1.25, ry * n * 0.65, rz * n * 0.95);
  }
  rawRockGeo.computeVertexNormals();
  geometries.push(rawRockGeo);

  const rockOffsets = [
    { x: 0, y: 0.06, z: 0, s: 1.35, ry: 0.3 },
    { x: -0.22, y: 0.04, z: 0.16, s: 0.9, ry: 1.2 },
    { x: 0.18, y: 0.05, z: -0.14, s: 0.85, ry: 2.1 },
    { x: -0.05, y: 0.16, z: -0.05, s: 0.72, ry: 0.8 },
  ];
  rockOffsets.forEach((ro) => {
    const stone = new THREE.Mesh(rawRockGeo, materials.slateRock);
    stone.position.set(ro.x, ro.y, ro.z);
    stone.scale.setScalar(ro.s);
    stone.rotation.y = ro.ry;
    stone.castShadow = true;
    stone.receiveShadow = true;
    rockCluster.add(stone);
  });

  const rockMoss = new THREE.Mesh(mossCapGeo, materials.moss);
  rockMoss.position.set(-0.04, 0.24, -0.04);
  rockMoss.scale.set(1.5, 0.8, 1.3);
  rockCluster.add(rockMoss);

  attachSpecimenProxy(
    rockCluster,
    {
      id: 'slate-outcrop',
      commonName: 'Weathered Seiryu Slate',
      latinName: 'Metamorphic Shale',
      category: 'Hardscape',
      humidityPreference: 'All biomes',
      notes: 'Stratified mineral outcrop buffering moisture around the upper terrace.',
    },
    0.34,
    0.36,
    interactables,
    geometries,
    localMaterials
  );
  group.add(rockCluster);

  // -------------------------------------------------------------------------
  // 4. Arching Sword Ferns (2 lush multi-frond composite fern groups)
  // -------------------------------------------------------------------------
  const pinnaShape = new THREE.Shape();
  pinnaShape.moveTo(0, 0);
  pinnaShape.quadraticCurveTo(0.055, 0.028, 0.12, 0.004);
  pinnaShape.quadraticCurveTo(0.055, -0.022, 0, 0);
  const pinnaGeo = new THREE.ShapeGeometry(pinnaShape, 6);
  geometries.push(pinnaGeo);

  const buildFern = (fx: number, fz: number, scale: number, frondsCount: number, id: string) => {
    const fern = new THREE.Group();
    fern.position.set(fx, groundHeightAt(fx, fz) - 0.015, fz);

    for (let f = 0; f < frondsCount; f++) {
      const angle = (f / frondsCount) * Math.PI * 2 + (rand() - 0.5) * 0.25;
      const reach = (0.34 + rand() * 0.16) * scale;
      const archH = (0.32 + rand() * 0.18) * scale;

      const frondGroup = new THREE.Group();
      frondGroup.rotation.y = angle;

      const stemCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(reach * 0.35, archH, 0),
        new THREE.Vector3(reach * 0.78, archH * 0.86, 0),
        new THREE.Vector3(reach, archH * 0.42, 0),
      ]);
      const stemGeo = new THREE.TubeGeometry(stemCurve, 12, 0.008 * scale, 5, false);
      const stemMesh = new THREE.Mesh(stemGeo, materials.fernLeaf);
      stemMesh.castShadow = true;
      frondGroup.add(stemMesh);
      geometries.push(stemGeo);

      // Arrange paired leaflets (pinnae) along the arched rachis
      const leafletPairs = 7;
      for (let p = 1; p <= leafletPairs; p++) {
        const t = 0.22 + (p / (leafletPairs + 0.5)) * 0.74;
        const pt = stemCurve.getPointAt(t);
        const tangent = stemCurve.getTangentAt(t);
        const taper = Math.sin(((p / leafletPairs) * Math.PI) * 0.85 + 0.2) * scale;

        for (const side of [-1, 1]) {
          const leaf = new THREE.Mesh(pinnaGeo, materials.fernLeaf);
          leaf.position.copy(pt);
          leaf.scale.set(taper * 0.85, taper * 0.72, 1);
          leaf.rotation.x = Math.PI / 2 - 0.28;
          leaf.rotation.z = side * (Math.PI / 2 - 0.25);
          leaf.rotation.y = -Math.atan2(tangent.y, tangent.x) * 0.35 * side;
          leaf.castShadow = true;
          frondGroup.add(leaf);
        }
      }
      fern.add(frondGroup);
    }

    attachSpecimenProxy(
      fern,
      {
        id,
        commonName: 'Boston Sword Fern',
        latinName: 'Nephrolepis exaltata',
        category: 'Understory',
        humidityPreference: '70% - 90% RH',
        notes: 'Arching pinnate fronds thrive in filtered canopy light and high condensation.',
      },
      0.34 * scale,
      0.48 * scale,
      interactables,
      geometries,
      localMaterials
    );
    group.add(fern);
  };

  buildFern(0.14, -0.78, 1.08, 9, 'sword-fern-north');
  buildFern(-0.96, 0.38, 0.92, 8, 'sword-fern-west');

  // -------------------------------------------------------------------------
  // 5. Fenestrated Monstera / Tropical Broadleaf Cluster (Composite 6-part)
  // -------------------------------------------------------------------------
  const monsteraShape = new THREE.Shape();
  monsteraShape.moveTo(0, 0);
  monsteraShape.bezierCurveTo(0.14, -0.02, 0.22, 0.14, 0.16, 0.28);
  monsteraShape.bezierCurveTo(0.1, 0.38, 0.02, 0.44, 0, 0.46);
  monsteraShape.bezierCurveTo(-0.02, 0.44, -0.1, 0.38, -0.16, 0.28);
  monsteraShape.bezierCurveTo(-0.22, 0.14, -0.14, -0.02, 0, 0);

  // Subtle fenestration holes
  const hole1 = new THREE.Path();
  hole1.absellipse(0.075, 0.18, 0.032, 0.015, 0, Math.PI * 2, false, 0.3);
  const hole2 = new THREE.Path();
  hole2.absellipse(-0.075, 0.22, 0.032, 0.015, 0, Math.PI * 2, false, -0.3);
  monsteraShape.holes.push(hole1, hole2);

  const monsteraLeafGeo = new THREE.ExtrudeGeometry(monsteraShape, {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 12,
  });
  // Curve leaf gently along its length for realistic botanical camber
  const mPos = monsteraLeafGeo.attributes.position;
  for (let i = 0; i < mPos.count; i++) {
    const ly = mPos.getY(i);
    mPos.setZ(i, mPos.getZ(i) - ly * ly * 0.38);
  }
  monsteraLeafGeo.computeVertexNormals();
  geometries.push(monsteraLeafGeo);

  const monsteraGroup = new THREE.Group();
  const monX = -0.58 + (rand() - 0.5) * 0.15;
  const monZ = 0.72 + (rand() - 0.5) * 0.12;
  monsteraGroup.position.set(monX, groundHeightAt(monX, monZ) - 0.02, monZ);

  const leafCount = 5;
  for (let i = 0; i < leafCount; i++) {
    const a = (i / leafCount) * Math.PI * 2 + rand() * 0.4;
    const h = 0.38 + (i % 3) * 0.13;
    const out = 0.16 + (i % 2) * 0.08;
    const tip = new THREE.Vector3(Math.cos(a) * out, h, Math.sin(a) * out);
    const petioleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(tip.x * 0.45, h * 0.65, tip.z * 0.45),
      tip,
    ]);
    const petioleGeo = new THREE.TubeGeometry(petioleCurve, 10, 0.014, 6, false);
    const petioleMesh = new THREE.Mesh(petioleGeo, materials.fernLeaf);
    petioleMesh.castShadow = true;
    monsteraGroup.add(petioleMesh);
    geometries.push(petioleGeo);

    const leafMesh = new THREE.Mesh(monsteraLeafGeo, materials.monsteraLeaf);
    leafMesh.position.copy(tip);
    leafMesh.rotation.y = -a + Math.PI / 2;
    leafMesh.rotation.x = Math.PI / 2 - 0.45;
    leafMesh.scale.setScalar(0.82 + (i % 2) * 0.22);
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;
    monsteraGroup.add(leafMesh);
  }

  attachSpecimenProxy(
    monsteraGroup,
    {
      id: 'monstera',
      commonName: 'Mini Monstera',
      latinName: 'Rhaphidophora tetrasperma',
      category: 'Understory',
      humidityPreference: '60% - 80% RH',
      notes: 'Glossy fenestrated foliage sheds condensation droplets toward the root zone.',
    },
    0.36,
    0.72,
    interactables,
    geometries,
    localMaterials
  );
  group.add(monsteraGroup);

  // -------------------------------------------------------------------------
  // 6. Echeveria Succulent Rosette Cluster (Phyllotaxis spiral petals)
  // -------------------------------------------------------------------------
  const petalPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.032, 0.025),
    new THREE.Vector2(0.044, 0.085),
    new THREE.Vector2(0.022, 0.135),
    new THREE.Vector2(0.0, 0.15),
  ];
  const petalGeo = new THREE.LatheGeometry(petalPts, 8);
  petalGeo.scale(1.0, 1.0, 0.36);
  geometries.push(petalGeo);

  const buildSucculent = (sx: number, sz: number, scale: number, id: string) => {
    const succGroup = new THREE.Group();
    succGroup.position.set(sx, groundHeightAt(sx, sz) - 0.01, sz);
    const petalCount = 21;
    const goldenAngle = 2.39996323;

    for (let i = 0; i < petalCount; i++) {
      const t = i / petalCount;
      const angle = i * goldenAngle;
      const tilt = THREE.MathUtils.lerp(0.24, 1.08, t);
      const radial = t * 0.065 * scale;

      const pMat = materials.succulent.clone();
      // Subtle jade-to-rose tip tinting
      pMat.color.setHSL(0.42 - t * 0.05, 0.32, 0.44 + (1 - t) * 0.08);
      localMaterials.push(pMat);

      const petal = new THREE.Mesh(petalGeo, pMat);
      petal.position.set(Math.cos(angle) * radial, 0.01, Math.sin(angle) * radial);
      petal.rotation.order = 'YXZ';
      petal.rotation.y = -angle + Math.PI / 2;
      petal.rotation.x = tilt;
      petal.scale.setScalar((0.55 + t * 0.65) * scale);
      petal.castShadow = true;
      petal.receiveShadow = true;
      succGroup.add(petal);
    }

    attachSpecimenProxy(
      succGroup,
      {
        id,
        commonName: 'Jade Echeveria Rosette',
        latinName: 'Echeveria elegans',
        category: 'Succulent',
        humidityPreference: '40% - 65% RH',
        notes: 'Fibonacci spiral rosette perched on well-drained slate gravel.',
      },
      0.22 * scale,
      0.22 * scale,
      interactables,
      geometries,
      localMaterials
    );
    group.add(succGroup);
  };

  buildSucculent(0.95, -0.1, 1.05, 'succulent-east');
  buildSucculent(0.72, -0.62, 0.78, 'succulent-ne');

  // -------------------------------------------------------------------------
  // 7. Bioluminescent Mycena Mushrooms (Glow softly at dusk & night)
  // -------------------------------------------------------------------------
  const mushCapPts = [
    new THREE.Vector2(0.0, 0.07),
    new THREE.Vector2(0.032, 0.062),
    new THREE.Vector2(0.068, 0.03),
    new THREE.Vector2(0.075, 0.0),
    new THREE.Vector2(0.02, 0.008),
  ];
  const mushCapGeo = new THREE.LatheGeometry(mushCapPts, 16);
  geometries.push(mushCapGeo);

  const mushGroup = new THREE.Group();
  const mx = 0.02 + (rand() - 0.5) * 0.14;
  const mz = 0.68 + (rand() - 0.5) * 0.12;
  const my = groundHeightAt(mx, mz);
  mushGroup.position.set(mx, my - 0.01, mz);

  const mushConfigs = [
    { x: 0, z: 0, h: 0.22, s: 1.15, tilt: 0.12 },
    { x: 0.09, z: 0.04, h: 0.16, s: 0.85, tilt: -0.18 },
    { x: -0.07, z: 0.06, h: 0.18, s: 0.92, tilt: 0.22 },
    { x: 0.04, z: -0.08, h: 0.12, s: 0.68, tilt: -0.1 },
    { x: -0.1, z: -0.04, h: 0.11, s: 0.62, tilt: 0.15 },
  ];

  mushConfigs.forEach((mc) => {
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(mc.x, 0, mc.z),
      new THREE.Vector3(mc.x + mc.tilt * 0.18, mc.h * 0.55, mc.z + mc.tilt * 0.1),
      new THREE.Vector3(mc.x + mc.tilt * 0.12, mc.h, mc.z),
    ]);
    const stemGeo = new THREE.TubeGeometry(stemCurve, 8, 0.009 * mc.s, 6, false);
    const stem = new THREE.Mesh(stemGeo, materials.mushroomStem);
    mushGroup.add(stem);
    geometries.push(stemGeo);

    const cap = new THREE.Mesh(mushCapGeo, materials.mushroomCap);
    cap.position.set(mc.x + mc.tilt * 0.12, mc.h - 0.005, mc.z);
    cap.scale.setScalar(mc.s);
    cap.rotation.z = -mc.tilt * 0.8;
    mushGroup.add(cap);
  });

  attachSpecimenProxy(
    mushGroup,
    {
      id: 'bioluminescent-fungi',
      commonName: 'Glowcap Mycena',
      latinName: 'Mycena chlorophos',
      category: 'Fungi',
      humidityPreference: '80% - 95% RH',
      notes: 'Saprotrophic forest fungi emitting cool cyan-green bioluminescence after dusk.',
    },
    0.2,
    0.28,
    interactables,
    geometries,
    localMaterials
  );
  group.add(mushGroup);

  const mushroomLightAnchor = new THREE.Vector3(mx, my + 0.18, mz);

  // -------------------------------------------------------------------------
  // 8. Instanced Velvet Moss Cushions & Micro-Grass Tufts (> 220 instances)
  // -------------------------------------------------------------------------
  const mossCount = 120;
  const mossGeo = new THREE.SphereGeometry(0.08, 10, 8);
  mossGeo.scale(1.3, 0.45, 1.15);
  const mossInst = new THREE.InstancedMesh(mossGeo, materials.moss, mossCount);
  mossInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let placedMoss = 0;
  let attempts = 0;
  while (placedMoss < mossCount && attempts < 600) {
    attempts++;
    const a = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * (TERRARIUM_RADIUS - 0.18);
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (isNearPond(x, z, 0.56)) continue;

    const y = groundHeightAt(x, z);
    dummy.position.set(x, y - 0.008, z);
    dummy.rotation.set((rand() - 0.5) * 0.25, rand() * Math.PI * 2, (rand() - 0.5) * 0.25);
    const sc = 0.75 + rand() * 0.7;
    dummy.scale.set(sc * (0.9 + rand() * 0.25), sc * (0.8 + rand() * 0.35), sc * (0.9 + rand() * 0.25));
    dummy.updateMatrix();
    mossInst.setMatrixAt(placedMoss, dummy.matrix);

    tint.setHSL(0.24 + (rand() - 0.5) * 0.05, 0.44 + rand() * 0.14, 0.34 + rand() * 0.14);
    mossInst.setColorAt(placedMoss, tint);
    placedMoss++;
  }
  mossInst.count = placedMoss;
  mossInst.instanceMatrix.needsUpdate = true;
  if (mossInst.instanceColor) mossInst.instanceColor.needsUpdate = true;
  mossInst.computeBoundingSphere();
  group.add(mossInst);
  geometries.push(mossGeo);

  // Micro-Grass / Haircap Blades
  const bladeCount = 150;
  const bladeGeo = new THREE.ConeGeometry(0.012, 0.14, 4);
  bladeGeo.translate(0, 0.07, 0);
  const bladeInst = new THREE.InstancedMesh(bladeGeo, materials.fernLeaf, bladeCount);

  let placedBlades = 0;
  attempts = 0;
  while (placedBlades < bladeCount && attempts < 700) {
    attempts++;
    const a = rand() * Math.PI * 2;
    const rad = Math.sqrt(rand()) * (TERRARIUM_RADIUS - 0.2);
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (isNearPond(x, z, 0.52)) continue;

    const y = groundHeightAt(x, z);
    dummy.position.set(x, y - 0.01, z);
    dummy.rotation.set((rand() - 0.5) * 0.35, rand() * Math.PI * 2, (rand() - 0.5) * 0.35);
    const sc = 0.75 + rand() * 0.65;
    dummy.scale.set(sc, sc * (0.85 + rand() * 0.55), sc);
    dummy.updateMatrix();
    bladeInst.setMatrixAt(placedBlades, dummy.matrix);

    tint.setHSL(0.28 + (rand() - 0.5) * 0.06, 0.42 + rand() * 0.15, 0.38 + rand() * 0.14);
    bladeInst.setColorAt(placedBlades, tint);
    placedBlades++;
  }
  bladeInst.count = placedBlades;
  bladeInst.instanceMatrix.needsUpdate = true;
  if (bladeInst.instanceColor) bladeInst.instanceColor.needsUpdate = true;
  bladeInst.computeBoundingSphere();
  group.add(bladeInst);
  geometries.push(bladeGeo);

  return {
    group,
    interactables,
    mushroomLightAnchor,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      localMaterials.forEach((m) => m.dispose());
    },
  };
}
