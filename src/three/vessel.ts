import * as THREE from 'three';
import type { VesselStyle } from '../types/terrarium';
import type { TerrariumMaterials } from './materials';
import { TERRARIUM_RADIUS } from './terrain';

export interface VesselBuildResult {
  group: THREE.Group;
  dispose: () => void;
}

export function createTerrariumVessel(
  style: VesselStyle,
  materials: TerrariumMaterials
): VesselBuildResult {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];

  const R = TERRARIUM_RADIUS;

  // --- 1. Shared Turned Walnut Plinth & Brushed Brass Collar ---
  const plinthPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(R + 0.24, 0.0),
    new THREE.Vector2(R + 0.24, 0.045),
    new THREE.Vector2(R + 0.19, 0.065),
    new THREE.Vector2(R + 0.16, 0.105),
    new THREE.Vector2(R + 0.06, 0.115),
    new THREE.Vector2(R + 0.03, 0.08),
    new THREE.Vector2(0.0, 0.08),
  ];
  const plinthGeo = new THREE.LatheGeometry(plinthPoints, style === 'wardian' ? 8 : 64);
  if (style === 'wardian') plinthGeo.rotateY(Math.PI / 8);
  const plinthMesh = new THREE.Mesh(plinthGeo, materials.walnut);
  plinthMesh.castShadow = true;
  plinthMesh.receiveShadow = true;
  group.add(plinthMesh);
  geometries.push(plinthGeo);

  // Recessed dark slate tray at bottom of soil
  const slateTrayGeo = new THREE.CylinderGeometry(R + 0.01, R + 0.01, 0.03, style === 'wardian' ? 8 : 64);
  if (style === 'wardian') slateTrayGeo.rotateY(Math.PI / 8);
  const slateTray = new THREE.Mesh(slateTrayGeo, materials.slateBase);
  slateTray.position.y = 0.065;
  slateTray.receiveShadow = true;
  group.add(slateTray);
  geometries.push(slateTrayGeo);

  // Brushed brass perimeter trim ring cradling the glass base
  const brassRingGeo = new THREE.TorusGeometry(R + 0.04, 0.022, 16, style === 'wardian' ? 8 : 64);
  brassRingGeo.rotateX(Math.PI / 2);
  if (style === 'wardian') brassRingGeo.rotateY(Math.PI / 8);
  const brassRing = new THREE.Mesh(brassRingGeo, materials.brass);
  brassRing.position.y = 0.11;
  brassRing.castShadow = true;
  group.add(brassRing);
  geometries.push(brassRingGeo);

  // 4 Machined brass plinth feet
  const footGeo = new THREE.CylinderGeometry(0.07, 0.05, 0.035, 16);
  geometries.push(footGeo);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const foot = new THREE.Mesh(footGeo, materials.brass);
    foot.position.set(Math.cos(angle) * (R + 0.08), -0.004, Math.sin(angle) * (R + 0.08));
    group.add(foot);
  }

  // --- 2. Style-Specific Glass & Architectural Frame ---
  if (style === 'wardian') {
    const wallH = 1.92;
    const baseWallY = 0.11;
    const eaveY = baseWallY + wallH;
    const apexY = eaveY + 1.12;
    const octR = R + 0.04;
    const topVentR = 0.24;

    // Glass walls (octagonal prism) + hipped roof frustum
    const wallGlassGeo = new THREE.CylinderGeometry(octR, octR, wallH, 8, 1, true);
    wallGlassGeo.rotateY(Math.PI / 8);
    const wallGlass = new THREE.Mesh(wallGlassGeo, materials.glass);
    wallGlass.position.y = baseWallY + wallH / 2;
    wallGlass.renderOrder = 10;
    group.add(wallGlass);
    geometries.push(wallGlassGeo);

    const roofGlassGeo = new THREE.CylinderGeometry(topVentR, octR, apexY - eaveY, 8, 1, true);
    roofGlassGeo.rotateY(Math.PI / 8);
    const roofGlass = new THREE.Mesh(roofGlassGeo, materials.glass);
    roofGlass.position.y = eaveY + (apexY - eaveY) / 2;
    roofGlass.renderOrder = 10;
    group.add(roofGlass);
    geometries.push(roofGlassGeo);

    // Condensation inner mist glass layer
    const condWallGeo = new THREE.CylinderGeometry(octR - 0.015, octR - 0.015, wallH - 0.04, 8, 1, true);
    condWallGeo.rotateY(Math.PI / 8);
    const condWall = new THREE.Mesh(condWallGeo, materials.condensationGlass);
    condWall.position.y = baseWallY + wallH / 2;
    condWall.renderOrder = 11;
    group.add(condWall);
    geometries.push(condWallGeo);

    const condRoofGeo = new THREE.CylinderGeometry(topVentR - 0.01, octR - 0.015, apexY - eaveY - 0.02, 8, 1, true);
    condRoofGeo.rotateY(Math.PI / 8);
    const condRoof = new THREE.Mesh(condRoofGeo, materials.condensationGlass);
    condRoof.position.y = eaveY + (apexY - eaveY) / 2;
    condRoof.renderOrder = 11;
    group.add(condRoof);
    geometries.push(condRoofGeo);

    // Architectural bronze mullions & roof rafters
    const cornerRadius = octR / Math.cos(Math.PI / 8);
    const topVentCornerR = topVentR / Math.cos(Math.PI / 8);
    const mullionGeo = new THREE.CylinderGeometry(0.02, 0.02, wallH, 8);
    const collarGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.045, 8);
    geometries.push(mullionGeo, collarGeo);

    const rafterLen = Math.hypot(cornerRadius - topVentCornerR, apexY - eaveY);
    const rafterGeo = new THREE.CylinderGeometry(0.018, 0.018, rafterLen, 8);
    geometries.push(rafterGeo);

    const up = new THREE.Vector3(0, 1, 0);
    const pBottom = new THREE.Vector3();
    const pTop = new THREE.Vector3();
    const dir = new THREE.Vector3();

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const cx = Math.cos(a) * cornerRadius;
      const cz = Math.sin(a) * cornerRadius;

      const mullion = new THREE.Mesh(mullionGeo, materials.bronzeFrame);
      mullion.position.set(cx, baseWallY + wallH / 2, cz);
      mullion.castShadow = true;
      group.add(mullion);

      const collar = new THREE.Mesh(collarGeo, materials.brass);
      collar.position.set(cx, eaveY, cz);
      group.add(collar);

      // Sloped roof rafter connecting eave corner to lantern vent ring
      pBottom.set(cx, eaveY, cz);
      pTop.set(Math.cos(a) * topVentCornerR, apexY, Math.sin(a) * topVentCornerR);
      dir.subVectors(pTop, pBottom).normalize();

      const rafter = new THREE.Mesh(rafterGeo, materials.bronzeFrame);
      rafter.position.copy(pBottom).add(pTop).multiplyScalar(0.5);
      rafter.quaternion.setFromUnitVectors(up, dir);
      rafter.castShadow = true;
      group.add(rafter);
    }

    // Eave cornice ring & top lantern collar
    const eaveRingGeo = new THREE.TorusGeometry(cornerRadius, 0.022, 8, 8);
    eaveRingGeo.rotateX(Math.PI / 2);
    const eaveRing = new THREE.Mesh(eaveRingGeo, materials.bronzeFrame);
    eaveRing.position.y = eaveY;
    eaveRing.castShadow = true;
    group.add(eaveRing);
    geometries.push(eaveRingGeo);

    const ventRingGeo = new THREE.TorusGeometry(topVentCornerR, 0.022, 10, 8);
    ventRingGeo.rotateX(Math.PI / 2);
    const ventRing = new THREE.Mesh(ventRingGeo, materials.brass);
    ventRing.position.y = apexY;
    group.add(ventRing);
    geometries.push(ventRingGeo);

    // Turned brass lantern cap + finial spire
    const capPoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(topVentCornerR + 0.04, 0.0),
      new THREE.Vector2(topVentCornerR + 0.03, 0.04),
      new THREE.Vector2(0.11, 0.14),
      new THREE.Vector2(0.035, 0.2),
      new THREE.Vector2(0.06, 0.25),
      new THREE.Vector2(0.022, 0.31),
      new THREE.Vector2(0.0, 0.36),
    ];
    const finialGeo = new THREE.LatheGeometry(capPoints, 16);
    const finial = new THREE.Mesh(finialGeo, materials.brass);
    finial.position.y = apexY + 0.01;
    finial.castShadow = true;
    group.add(finial);
    geometries.push(finialGeo);
  } else if (style === 'cloche') {
    // Hand-blown Bell Cloche profile via LatheGeometry
    const clocheR = R + 0.01;
    const bellPts: THREE.Vector2[] = [
      new THREE.Vector2(clocheR + 0.02, 0.11),
      new THREE.Vector2(clocheR, 0.16),
      new THREE.Vector2(clocheR, 1.98),
    ];
    const domeSegs = 20;
    for (let i = 1; i <= domeSegs; i++) {
      const t = (i / domeSegs) * (Math.PI / 2);
      bellPts.push(new THREE.Vector2(Math.cos(t) * clocheR, 1.98 + Math.sin(t) * 1.15));
    }

    const clocheGeo = new THREE.LatheGeometry(bellPts, 64);
    const clocheMesh = new THREE.Mesh(clocheGeo, materials.glass);
    clocheMesh.renderOrder = 10;
    group.add(clocheMesh);
    geometries.push(clocheGeo);

    // Inner condensation bell layer
    const condPts = bellPts.map((p) => new THREE.Vector2(Math.max(0, p.x - 0.018), p.y - 0.01));
    const condGeo = new THREE.LatheGeometry(condPts, 48);
    const condMesh = new THREE.Mesh(condGeo, materials.condensationGlass);
    condMesh.renderOrder = 11;
    group.add(condMesh);
    geometries.push(condGeo);

    // Turned brass top handle finial + collar escutcheon
    const knobPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.18, 0.0),
      new THREE.Vector2(0.16, 0.03),
      new THREE.Vector2(0.06, 0.045),
      new THREE.Vector2(0.045, 0.11),
      new THREE.Vector2(0.1, 0.16),
      new THREE.Vector2(0.09, 0.21),
      new THREE.Vector2(0.0, 0.23),
    ];
    const knobGeo = new THREE.LatheGeometry(knobPts, 32);
    const knobMesh = new THREE.Mesh(knobGeo, materials.brass);
    knobMesh.position.y = 3.12;
    knobMesh.castShadow = true;
    group.add(knobMesh);
    geometries.push(knobGeo);
  } else {
    // Geodesic Conservatory Dome on low cylindrical wall
    const wallH = 0.72;
    const baseY = 0.11;
    const domeCenterY = baseY + wallH;
    const domeR = R + 0.025;

    // Lower cylindrical glass skirt
    const skirtGeo = new THREE.CylinderGeometry(domeR, domeR, wallH, 40, 1, true);
    const skirtGlass = new THREE.Mesh(skirtGeo, materials.glass);
    skirtGlass.position.y = baseY + wallH / 2;
    skirtGlass.renderOrder = 10;
    group.add(skirtGlass);
    geometries.push(skirtGeo);

    // Geodesic dome hemisphere glass
    const domeGlassGeo = new THREE.IcosahedronGeometry(domeR, 1);
    // Clip bottom hemisphere by scaling/filtering or using Hemisphere Sphere with 10-sided icosahedral feel
    const hemiGeo = new THREE.SphereGeometry(domeR, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeGlass = new THREE.Mesh(hemiGeo, materials.glass);
    domeGlass.position.y = domeCenterY;
    domeGlass.renderOrder = 10;
    group.add(domeGlass);
    geometries.push(hemiGeo, domeGlassGeo);

    // Inner condensation dome + skirt
    const condSkirtGeo = new THREE.CylinderGeometry(domeR - 0.015, domeR - 0.015, wallH - 0.02, 32, 1, true);
    const condSkirt = new THREE.Mesh(condSkirtGeo, materials.condensationGlass);
    condSkirt.position.y = baseY + wallH / 2;
    condSkirt.renderOrder = 11;
    group.add(condSkirt);

    const condHemiGeo = new THREE.SphereGeometry(domeR - 0.015, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const condDome = new THREE.Mesh(condHemiGeo, materials.condensationGlass);
    condDome.position.y = domeCenterY;
    condDome.renderOrder = 11;
    group.add(condDome);
    geometries.push(condSkirtGeo, condHemiGeo);

    // Equator bronze ring
    const eqRingGeo = new THREE.TorusGeometry(domeR, 0.024, 12, 40);
    eqRingGeo.rotateX(Math.PI / 2);
    const eqRing = new THREE.Mesh(eqRingGeo, materials.bronzeFrame);
    eqRing.position.y = domeCenterY;
    eqRing.castShadow = true;
    group.add(eqRing);
    geometries.push(eqRingGeo);

    // Build genuine 3D geodesic struts from an icosahedron (detail 1) upper hemisphere edges
    const edgesGeo = new THREE.EdgesGeometry(domeGlassGeo, 1);
    const edgePos = edgesGeo.attributes.position;
    const strutRadius = 0.014;
    const unitStrutGeo = new THREE.CylinderGeometry(strutRadius, strutRadius, 1, 6);
    const hubGeo = new THREE.SphereGeometry(0.028, 10, 10);
    geometries.push(edgesGeo, unitStrutGeo, hubGeo);

    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const mid = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const hubSet = new Set<string>();

    for (let i = 0; i < edgePos.count; i += 2) {
      vA.fromBufferAttribute(edgePos, i);
      vB.fromBufferAttribute(edgePos, i + 1);
      // Keep struts in the upper dome (y >= -0.25)
      if (vA.y < -0.22 && vB.y < -0.22) continue;

      const cA = vA.clone();
      const cB = vB.clone();
      if (cA.y < 0) cA.y = 0;
      if (cB.y < 0) cB.y = 0;
      cA.normalize().multiplyScalar(domeR);
      cB.normalize().multiplyScalar(domeR);

      const dist = cA.distanceTo(cB);
      if (dist < 0.05) continue;

      mid.addVectors(cA, cB).multiplyScalar(0.5);
      dir.subVectors(cB, cA).normalize();

      const strut = new THREE.Mesh(unitStrutGeo, materials.bronzeFrame);
      strut.position.set(mid.x, domeCenterY + mid.y, mid.z);
      strut.scale.set(1, dist, 1);
      strut.quaternion.setFromUnitVectors(up, dir);
      strut.castShadow = true;
      group.add(strut);

      for (const pt of [cA, cB]) {
        const key = `${pt.x.toFixed(2)},${pt.y.toFixed(2)},${pt.z.toFixed(2)}`;
        if (!hubSet.has(key)) {
          hubSet.add(key);
          const hub = new THREE.Mesh(hubGeo, materials.brass);
          hub.position.set(pt.x, domeCenterY + pt.y, pt.z);
          group.add(hub);
        }
      }
    }

    // Lower vertical struts around the glass skirt
    const vStrutGeo = new THREE.CylinderGeometry(0.016, 0.016, wallH, 8);
    geometries.push(vStrutGeo);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const vs = new THREE.Mesh(vStrutGeo, materials.bronzeFrame);
      vs.position.set(Math.cos(a) * domeR, baseY + wallH / 2, Math.sin(a) * domeR);
      group.add(vs);
    }

    // Brass skylight vent ring at apex
    const apexRingGeo = new THREE.TorusGeometry(0.22, 0.022, 10, 24);
    apexRingGeo.rotateX(Math.PI / 2);
    const apexRing = new THREE.Mesh(apexRingGeo, materials.brass);
    apexRing.position.y = domeCenterY + domeR;
    group.add(apexRing);
    geometries.push(apexRingGeo);
  }

  return {
    group,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
    },
  };
}
