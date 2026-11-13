import * as THREE from 'three';
import type { ProceduralTextureSet } from './textures';

export interface TerrariumMaterials {
  walnut: THREE.MeshStandardMaterial;
  brass: THREE.MeshPhysicalMaterial;
  bronzeFrame: THREE.MeshStandardMaterial;
  slateBase: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  condensationGlass: THREE.MeshPhysicalMaterial;
  soil: THREE.MeshStandardMaterial;
  charcoal: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial;
  slateRock: THREE.MeshStandardMaterial;
  pondWater: THREE.MeshPhysicalMaterial;
  fernLeaf: THREE.MeshStandardMaterial;
  monsteraLeaf: THREE.MeshPhysicalMaterial;
  canopyLeaf: THREE.MeshStandardMaterial;
  moss: THREE.MeshStandardMaterial;
  succulent: THREE.MeshStandardMaterial;
  mushroomStem: THREE.MeshStandardMaterial;
  mushroomCap: THREE.MeshStandardMaterial;
  studioFloor: THREE.MeshStandardMaterial;
  updateTime: (time: number, windStrength: number, rainIntensity: number, nightFactor: number) => void;
  dispose: () => void;
}

function attachWindSway(mat: THREE.MeshStandardMaterial, swayAmplitude: number, phaseOffset: number): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWind = { value: 0.25 };
    mat.userData.shader = shader;

    shader.vertexShader =
      `uniform float uTime;\nuniform float uWind;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float swayMask = clamp(transformed.y * 1.4, 0.0, 1.5);
        float phase = uTime * 1.65 + ${phaseOffset.toFixed(2)} + position.x * 2.1 + position.z * 1.7;
        transformed.x += sin(phase) * ${swayAmplitude.toFixed(4)} * uWind * swayMask;
        transformed.z += cos(phase * 0.83) * ${(swayAmplitude * 0.75).toFixed(4)} * uWind * swayMask;
        `
      );
  };
}

export function createTerrariumMaterials(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean
): TerrariumMaterials {
  const walnut = new THREE.MeshStandardMaterial({
    map: textures.walnutMap,
    bumpMap: textures.walnutBump,
    bumpScale: 0.008,
    roughness: 0.42,
    metalness: 0.06,
  });

  const brass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#c8a258'),
    metalness: 0.92,
    roughness: 0.24,
    roughnessMap: textures.brassRoughness,
    anisotropy: 0.75,
    clearcoat: 0.25,
    clearcoatRoughness: 0.2,
  });

  const bronzeFrame = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3c352c'),
    metalness: 0.82,
    roughness: 0.34,
  });

  const slateBase = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#202423'),
    roughness: 0.86,
    metalness: 0.08,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#eef7f4'),
    metalness: 0.0,
    roughness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.93,
    transparent: isSoftwareGl,
    opacity: isSoftwareGl ? 0.19 : 1.0,
    ior: 1.52,
    thickness: 0.09,
    attenuationColor: new THREE.Color('#d8efe8'),
    attenuationDistance: 4.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.45,
    depthWrite: false,
  });

  const condensationGlass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#dcebe8'),
    metalness: 0.0,
    roughness: 0.48,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  const soil = new THREE.MeshStandardMaterial({
    map: textures.soilMap,
    bumpMap: textures.soilBump,
    bumpScale: 0.032,
    roughness: 0.94,
    metalness: 0.02,
  });

  const charcoal = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#18191b'),
    bumpMap: textures.soilBump,
    bumpScale: 0.025,
    roughness: 0.96,
    metalness: 0.05,
  });

  const bark = new THREE.MeshStandardMaterial({
    map: textures.barkMap,
    bumpMap: textures.barkBump,
    bumpScale: 0.024,
    roughness: 0.88,
    metalness: 0.02,
  });

  const slateRock = new THREE.MeshStandardMaterial({
    map: textures.slateMap,
    bumpMap: textures.slateBump,
    bumpScale: 0.022,
    roughness: 0.78,
    metalness: 0.06,
  });

  const pondWater = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#21585e'),
    roughness: 0.06,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.72,
    transparent: true,
    opacity: isSoftwareGl ? 0.78 : 0.92,
    ior: 1.333,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.6,
  });

  pondWater.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uRain = { value: 0 };
    pondWater.userData.shader = shader;

    shader.vertexShader =
      `uniform float uTime;\nuniform float uRain;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float dist1 = length(transformed.xz - vec2(0.18, 0.12));
        float dist2 = length(transformed.xz - vec2(-0.14, -0.18));
        float breeze = sin(transformed.x * 16.0 + uTime * 2.1) * cos(transformed.z * 14.0 - uTime * 1.7) * 0.0035;
        float r1 = sin(dist1 * 38.0 - uTime * 8.5) * exp(-dist1 * 3.8);
        float r2 = sin(dist2 * 44.0 - uTime * 9.8 + 1.9) * exp(-dist2 * 4.2);
        transformed.y += breeze + (r1 + r2) * 0.0085 * uRain;
        `
      );
  };

  const fernLeaf = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3f8446'),
    roughness: 0.56,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  attachWindSway(fernLeaf, 0.032, 0.4);

  const monsteraLeaf = new THREE.MeshPhysicalMaterial({
    map: textures.leafMap,
    color: new THREE.Color('#ffffff'),
    roughness: 0.3,
    metalness: 0.04,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
    side: THREE.DoubleSide,
  });
  attachWindSway(monsteraLeaf, 0.024, 1.7);

  const canopyLeaf = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4b8b42'),
    roughness: 0.65,
    metalness: 0.02,
  });
  attachWindSway(canopyLeaf, 0.018, 2.5);

  const moss = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#5a8f3d'),
    roughness: 0.94,
    metalness: 0.0,
  });

  const succulent = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#6ca289'),
    roughness: 0.42,
    metalness: 0.04,
  });

  const mushroomStem = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d8e2dc'),
    roughness: 0.55,
    metalness: 0.0,
    emissive: new THREE.Color('#27c7a9'),
    emissiveIntensity: 0.1,
  });

  const mushroomCap = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#7de2d1'),
    roughness: 0.34,
    metalness: 0.05,
    emissive: new THREE.Color('#32e8c6'),
    emissiveIntensity: 0.15,
  });

  const studioFloor = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#191f1d'),
    roughness: 0.92,
    metalness: 0.02,
  });

  const allMaterials: THREE.Material[] = [
    walnut,
    brass,
    bronzeFrame,
    slateBase,
    glass,
    condensationGlass,
    soil,
    charcoal,
    bark,
    slateRock,
    pondWater,
    fernLeaf,
    monsteraLeaf,
    canopyLeaf,
    moss,
    succulent,
    mushroomStem,
    mushroomCap,
    studioFloor,
  ];

  return {
    walnut,
    brass,
    bronzeFrame,
    slateBase,
    glass,
    condensationGlass,
    soil,
    charcoal,
    bark,
    slateRock,
    pondWater,
    fernLeaf,
    monsteraLeaf,
    canopyLeaf,
    moss,
    succulent,
    mushroomStem,
    mushroomCap,
    studioFloor,
    updateTime: (time: number, windStrength: number, rainIntensity: number, nightFactor: number) => {
      if (pondWater.userData.shader) {
        pondWater.userData.shader.uniforms.uTime.value = time;
        pondWater.userData.shader.uniforms.uRain.value = rainIntensity;
      }
      for (const m of [fernLeaf, monsteraLeaf, canopyLeaf]) {
        if (m.userData.shader) {
          m.userData.shader.uniforms.uTime.value = time;
          m.userData.shader.uniforms.uWind.value = windStrength;
        }
      }
      mushroomCap.emissiveIntensity = 0.08 + nightFactor * 1.45;
      mushroomStem.emissiveIntensity = 0.04 + nightFactor * 0.55;
    },
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
    },
  };
}
