import * as THREE from 'three';
import type { TerrariumMaterials } from './materials';
import type { ProceduralTextureSet } from './textures';

export const TERRARIUM_RADIUS = 1.65;
export const POND_CENTER_X = 0.52;
export const POND_CENTER_Z = 0.42;
export const POND_WATER_Y = 0.34;
export const SUBSTRATE_BASE_Y = 0.06;

/**
 * Continuous heightmap for the interior soil bed inside the terrarium.
 * All flora, rocks, driftwood, and moss cushions query this so nothing floats.
 */
export function groundHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const edgeTaper = THREE.MathUtils.smoothstep(r, TERRARIUM_RADIUS * 0.72, TERRARIUM_RADIUS);

  // Rolling mossy ridge in back-left (-x, -z)
  const hillDist = Math.hypot(x + 0.55, z + 0.42);
  const hill = 0.38 * Math.exp(-(hillDist * hillDist) / 0.72);

  // Secondary gentle mound right-back
  const moundDist = Math.hypot(x - 0.58, z + 0.46);
  const mound = 0.2 * Math.exp(-(moundDist * moundDist) / 0.48);

  // Sunken pond basin front-right
  const pondDist = Math.hypot(x - POND_CENTER_X, z - POND_CENTER_Z);
  const pondDip = -0.24 * Math.exp(-(pondDist * pondDist) / 0.24);

  // Fine organic micro-undulation
  const micro = Math.sin(x * 3.1) * Math.cos(z * 2.8) * 0.025;

  const baseHeight = 0.42 + hill + mound + pondDip + micro;
  return THREE.MathUtils.lerp(baseHeight, 0.36, edgeTaper * 0.55);
}

export interface TerrainBuildResult {
  group: THREE.Group;
  dispose: () => void;
}

export function createTerrariumTerrain(
  materials: TerrariumMaterials,
  textures: ProceduralTextureSet
): TerrainBuildResult {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const localMaterials: THREE.Material[] = [];

  // 1. Studio floor & soft radial contact shadow beneath plinth
  const floorGeo = new THREE.CircleGeometry(28, 64);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMesh = new THREE.Mesh(floorGeo, materials.studioFloor);
  floorMesh.position.y = -0.015;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);
  geometries.push(floorGeo);

  const shadowPlaneGeo = new THREE.PlaneGeometry(5.6, 5.6);
  shadowPlaneGeo.rotateX(-Math.PI / 2);
  const shadowPlaneMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadowMap,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
  shadowPlane.position.y = -0.002;
  group.add(shadowPlane);
  geometries.push(shadowPlaneGeo);
  localMaterials.push(shadowPlaneMat);

  // 2. Stratified Cross-Section Layers (visible through bottom edge of glass)
  const innerRadius = TERRARIUM_RADIUS - 0.03;

  // Drainage pebble band (InstancedMesh around bottom perimeter + visible base)
  const drainageBedGeo = new THREE.CylinderGeometry(innerRadius, innerRadius, 0.11, 48);
  const drainageBedMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#343532'),
    roughness: 0.9,
    metalness: 0.05,
  });
  const drainageBed = new THREE.Mesh(drainageBedGeo, drainageBedMat);
  drainageBed.position.y = SUBSTRATE_BASE_Y + 0.055;
  drainageBed.receiveShadow = true;
  group.add(drainageBed);
  geometries.push(drainageBedGeo);
  localMaterials.push(drainageBedMat);

  // Perimeter river pebbles (InstancedMesh > 20 items)
  const pebbleGeo = new THREE.DodecahedronGeometry(0.052, 1);
  pebbleGeo.scale(1.25, 0.68, 1.0);
  const pebbleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#7a7872'),
    roughness: 0.72,
    metalness: 0.05,
  });
  const pebbleCount = 96;
  const pebbleInst = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < pebbleCount; i++) {
    const angle = (i / pebbleCount) * Math.PI * 2 + (i % 2) * 0.03;
    const rad = innerRadius - 0.06 - (i % 3) * 0.04;
    const yOff = SUBSTRATE_BASE_Y + 0.04 + (i % 2) * 0.045;
    dummy.position.set(Math.cos(angle) * rad, yOff, Math.sin(angle) * rad);
    dummy.rotation.set(i * 0.4, angle + i * 0.3, i * 0.2);
    const s = 0.8 + ((i * 37) % 100) / 220;
    dummy.scale.set(s, s * 0.85, s);
    dummy.updateMatrix();
    pebbleInst.setMatrixAt(i, dummy.matrix);
    const shade = 0.72 + ((i * 53) % 100) / 280;
    color.setRGB(shade * 0.56, shade * 0.54, shade * 0.5);
    pebbleInst.setColorAt(i, color);
  }
  pebbleInst.instanceMatrix.needsUpdate = true;
  if (pebbleInst.instanceColor) pebbleInst.instanceColor.needsUpdate = true;
  pebbleInst.computeBoundingSphere();
  group.add(pebbleInst);
  geometries.push(pebbleGeo);
  localMaterials.push(pebbleMat);

  // Activated charcoal middle filtration layer
  const charcoalGeo = new THREE.CylinderGeometry(innerRadius, innerRadius, 0.075, 48);
  const charcoalMesh = new THREE.Mesh(charcoalGeo, materials.charcoal);
  charcoalMesh.position.y = SUBSTRATE_BASE_Y + 0.145;
  group.add(charcoalMesh);
  geometries.push(charcoalGeo);

  // Rich organic soil side wall skirt (connects charcoal layer up to sculpted terrain perimeter)
  const skirtSegs = 64;
  const skirtGeo = new THREE.CylinderGeometry(innerRadius, innerRadius, 1, skirtSegs, 1, true);
  const posAttr = skirtGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    if (vy > 0) {
      posAttr.setY(i, groundHeightAt(vx, vz));
    } else {
      posAttr.setY(i, SUBSTRATE_BASE_Y + 0.18);
    }
  }
  skirtGeo.computeVertexNormals();
  const skirtMesh = new THREE.Mesh(skirtGeo, materials.soil);
  skirtMesh.receiveShadow = true;
  group.add(skirtMesh);
  geometries.push(skirtGeo);

  // 3. Sculpted Top Soil Surface Disc
  const rings = 40;
  const segs = 64;
  const terrainGeo = new THREE.RingGeometry(0.001, innerRadius, segs, rings);
  terrainGeo.rotateX(-Math.PI / 2);
  const tPos = terrainGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getZ(i);
    tPos.setY(i, groundHeightAt(x, z));
  }
  terrainGeo.computeVertexNormals();
  const terrainMesh = new THREE.Mesh(terrainGeo, materials.soil);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  group.add(terrainMesh);
  geometries.push(terrainGeo);

  // 4. Micro-Pond Water Surface + Submerged Pebbles
  const pondGeo = new THREE.CircleGeometry(0.62, 48);
  pondGeo.rotateX(-Math.PI / 2);
  const pondMesh = new THREE.Mesh(pondGeo, materials.pondWater);
  pondMesh.position.set(POND_CENTER_X, POND_WATER_Y, POND_CENTER_Z);
  pondMesh.receiveShadow = true;
  group.add(pondMesh);
  geometries.push(pondGeo);

  // Submerged smooth pond stones
  const pondStoneGeo = new THREE.IcosahedronGeometry(0.045, 1);
  pondStoneGeo.scale(1.2, 0.55, 1.0);
  const pondStoneCount = 24;
  const pondStoneInst = new THREE.InstancedMesh(pondStoneGeo, pebbleMat, pondStoneCount);
  for (let i = 0; i < pondStoneCount; i++) {
    const a = (i / pondStoneCount) * Math.PI * 2 + i * 0.7;
    const rad = 0.08 + ((i * 29) % 100) / 280;
    const px = POND_CENTER_X + Math.cos(a) * rad;
    const pz = POND_CENTER_Z + Math.sin(a) * rad;
    const py = groundHeightAt(px, pz) + 0.012;
    dummy.position.set(px, py, pz);
    dummy.rotation.set(0.1 * i, a, 0.08 * i);
    const s = 0.65 + ((i * 41) % 100) / 180;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    pondStoneInst.setMatrixAt(i, dummy.matrix);
    const g = 0.36 + ((i * 19) % 100) / 300;
    color.setRGB(g * 0.85, g * 0.9, g * 0.92);
    pondStoneInst.setColorAt(i, color);
  }
  pondStoneInst.instanceMatrix.needsUpdate = true;
  if (pondStoneInst.instanceColor) pondStoneInst.instanceColor.needsUpdate = true;
  pondStoneInst.computeBoundingSphere();
  group.add(pondStoneInst);
  geometries.push(pondStoneGeo);

  return {
    group,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      localMaterials.forEach((m) => m.dispose());
    },
  };
}
