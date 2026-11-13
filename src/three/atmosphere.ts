import * as THREE from 'three';
import type { WeatherType } from '../types/terrarium';
import type { TerrariumMaterials } from './materials';
import type { ProceduralTextureSet } from './textures';
import { POND_WATER_Y } from './terrain';

// Pre-allocated scratch objects for zero-GC per-frame updates
const _skyColor = new THREE.Color();
const _sunColor = new THREE.Color();
const _hemiSky = new THREE.Color();
const _hemiGround = new THREE.Color();
const _floorColor = new THREE.Color();
const _tempColor = new THREE.Color();
const _dummyMatrix = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyQuat = new THREE.Quaternion();
const _dummyScale = new THREE.Vector3();

interface SkyStop {
  hour: number;
  sky: THREE.Color;
  sun: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  floor: THREE.Color;
  keyIntensity: number;
  hemiIntensity: number;
}

const SKY_KEYFRAMES: SkyStop[] = [
  {
    hour: 0,
    sky: new THREE.Color('#0a1016'),
    sun: new THREE.Color('#6f95c9'),
    hemiSky: new THREE.Color('#233854'),
    hemiGround: new THREE.Color('#0c1210'),
    floor: new THREE.Color('#0d1318'),
    keyIntensity: 0.72,
    hemiIntensity: 0.42,
  },
  {
    hour: 5.5,
    sky: new THREE.Color('#272b3b'),
    sun: new THREE.Color('#f4a27e'),
    hemiSky: new THREE.Color('#7887ab'),
    hemiGround: new THREE.Color('#221f1c'),
    floor: new THREE.Color('#20232d'),
    keyIntensity: 1.15,
    hemiIntensity: 0.55,
  },
  {
    hour: 7.5,
    sky: new THREE.Color('#d8c7b2'),
    sun: new THREE.Color('#ffd3a1'),
    hemiSky: new THREE.Color('#d6e5f5'),
    hemiGround: new THREE.Color('#4a4236'),
    floor: new THREE.Color('#7c756b'),
    keyIntensity: 2.35,
    hemiIntensity: 0.8,
  },
  {
    hour: 12.5,
    sky: new THREE.Color('#d7e3df'),
    sun: new THREE.Color('#fff4e3'),
    hemiSky: new THREE.Color('#cbe2f5'),
    hemiGround: new THREE.Color('#4d5243'),
    floor: new THREE.Color('#838c88'),
    keyIntensity: 2.85,
    hemiIntensity: 0.92,
  },
  {
    hour: 17.5,
    sky: new THREE.Color('#d3ae8e'),
    sun: new THREE.Color('#ffb56b'),
    hemiSky: new THREE.Color('#b4c4de'),
    hemiGround: new THREE.Color('#493628'),
    floor: new THREE.Color('#786354'),
    keyIntensity: 2.25,
    hemiIntensity: 0.72,
  },
  {
    hour: 19.5,
    sky: new THREE.Color('#212638'),
    sun: new THREE.Color('#8f84c7'),
    hemiSky: new THREE.Color('#3b486b'),
    hemiGround: new THREE.Color('#131618'),
    floor: new THREE.Color('#1a1e2a'),
    keyIntensity: 0.85,
    hemiIntensity: 0.46,
  },
  {
    hour: 24,
    sky: new THREE.Color('#0a1016'),
    sun: new THREE.Color('#6f95c9'),
    hemiSky: new THREE.Color('#233854'),
    hemiGround: new THREE.Color('#0c1210'),
    floor: new THREE.Color('#0d1318'),
    keyIntensity: 0.72,
    hemiIntensity: 0.42,
  },
];

export class TerrariumAtmosphere {
  public readonly keyLight: THREE.DirectionalLight;
  public readonly hemiLight: THREE.HemisphereLight;
  public readonly rimLight: THREE.DirectionalLight;
  public readonly mushroomLight: THREE.PointLight;
  public readonly lanternLight: THREE.PointLight;

  private readonly rainInst: THREE.InstancedMesh;
  private readonly rainCount = 190;
  private readonly rainSeeds: Float32Array;
  private readonly rainGeo: THREE.CylinderGeometry;
  private readonly rainMat: THREE.MeshBasicMaterial;

  private readonly mistPoints: THREE.Points;
  private readonly mistCount = 46;
  private readonly mistSeeds: Float32Array;
  private readonly mistGeo: THREE.BufferGeometry;
  private readonly mistMat: THREE.PointsMaterial;

  private readonly fireflyPoints: THREE.Points;
  private readonly fireflyCount = 34;
  private readonly fireflySeeds: Float32Array;
  private readonly fireflyGeo: THREE.BufferGeometry;
  private readonly fireflyMat: THREE.PointsMaterial;

  private mistBurstEnvelope = 0;
  private stormTimer = 2.5;
  private lightningEnergy = 0;
  private currentCondensation = 0.04;
  private currentRainOpacity = 0;
  private currentMistOpacity = 0;

  constructor(
    private readonly scene: THREE.Scene,
    textures: ProceduralTextureSet,
    isSoftwareGl: boolean
  ) {
    // 1. Balanced 3-Point Studio + Sky Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0xcbe2f5, 0x4d5243, 0.85);
    this.hemiLight.position.set(0, 8, 0);
    scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff4e3, 2.7);
    this.keyLight.position.set(4.5, 6.8, 3.8);
    this.keyLight.castShadow = !isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1.0;
    this.keyLight.shadow.camera.far = 16.0;
    const d = 2.4;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x9bc4e2, 0.72);
    this.rimLight.position.set(-4.5, 3.5, -4.8);
    scene.add(this.rimLight);

    // Night interior lights: warm conservatory top glow + cyan bioluminescent mushroom glow
    this.lanternLight = new THREE.PointLight(0xffcf8b, 0.0, 4.8, 1.8);
    this.lanternLight.position.set(0, 2.25, 0);
    scene.add(this.lanternLight);

    this.mushroomLight = new THREE.PointLight(0x36f0cc, 0.0, 1.9, 2.0);
    this.mushroomLight.position.set(0.02, 0.56, 0.68);
    scene.add(this.mushroomLight);

    // 2. Interior Rain Streaks (InstancedMesh)
    this.rainGeo = new THREE.CylinderGeometry(0.0035, 0.0018, 0.14, 4);
    this.rainMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#cce7f5'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rainInst = new THREE.InstancedMesh(this.rainGeo, this.rainMat, this.rainCount);
    this.rainInst.frustumCulled = false;
    this.rainInst.renderOrder = 8;
    this.rainInst.visible = false;

    this.rainSeeds = new Float32Array(this.rainCount * 4);
    for (let i = 0; i < this.rainCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 1.32;
      this.rainSeeds[i * 4] = Math.cos(a) * r;
      this.rainSeeds[i * 4 + 1] = Math.random(); // phase 0..1
      this.rainSeeds[i * 4 + 2] = Math.sin(a) * r;
      this.rainSeeds[i * 4 + 3] = 0.85 + Math.random() * 0.45; // speed multiplier
    }
    scene.add(this.rainInst);

    // 3. Soft Interior Mist Clouds (Points)
    this.mistGeo = new THREE.BufferGeometry();
    const mistPos = new Float32Array(this.mistCount * 3);
    this.mistSeeds = new Float32Array(this.mistCount * 3);
    for (let i = 0; i < this.mistCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 1.15;
      mistPos[i * 3] = Math.cos(a) * r;
      mistPos[i * 3 + 1] = 0.55 + Math.random() * 0.85;
      mistPos[i * 3 + 2] = Math.sin(a) * r;
      this.mistSeeds[i * 3] = a;
      this.mistSeeds[i * 3 + 1] = r;
      this.mistSeeds[i * 3 + 2] = 0.5 + Math.random() * 0.7;
    }
    this.mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
    this.mistMat = new THREE.PointsMaterial({
      map: textures.mistPuffMap,
      size: 0.72,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.mistPoints = new THREE.Points(this.mistGeo, this.mistMat);
    this.mistPoints.frustumCulled = false;
    this.mistPoints.renderOrder = 9;
    this.mistPoints.visible = false;
    scene.add(this.mistPoints);

    // 4. Evening / Night Fireflies & Spores (Points)
    this.fireflyGeo = new THREE.BufferGeometry();
    const ffPos = new Float32Array(this.fireflyCount * 3);
    this.fireflySeeds = new Float32Array(this.fireflyCount * 3);
    for (let i = 0; i < this.fireflyCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.15 + Math.sqrt(Math.random()) * 1.1;
      ffPos[i * 3] = Math.cos(a) * r;
      ffPos[i * 3 + 1] = 0.55 + Math.random() * 1.15;
      ffPos[i * 3 + 2] = Math.sin(a) * r;
      this.fireflySeeds[i * 3] = a;
      this.fireflySeeds[i * 3 + 1] = r;
      this.fireflySeeds[i * 3 + 2] = Math.random() * Math.PI * 2;
    }
    this.fireflyGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
    this.fireflyMat = new THREE.PointsMaterial({
      map: textures.particleGlowMap,
      color: new THREE.Color('#c7ff8c'),
      size: 0.11,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.fireflyPoints = new THREE.Points(this.fireflyGeo, this.fireflyMat);
    this.fireflyPoints.frustumCulled = false;
    this.fireflyPoints.renderOrder = 9;
    this.fireflyPoints.visible = false;
    scene.add(this.fireflyPoints);
  }

  public setMushroomAnchor(anchor: THREE.Vector3): void {
    this.mushroomLight.position.copy(anchor);
  }

  public triggerMistBurst(): void {
    this.mistBurstEnvelope = 1.0;
  }

  public update(
    dt: number,
    elapsed: number,
    timeOfDay: number,
    weather: WeatherType,
    materials: TerrariumMaterials
  ): { nightFactor: number; rainIntensity: number } {
    // 1. Sample Day/Night Sky & Sun Keyframes
    const h = ((timeOfDay % 24) + 24) % 24;
    let k0 = SKY_KEYFRAMES[0];
    let k1 = SKY_KEYFRAMES[SKY_KEYFRAMES.length - 1];
    for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
      if (h >= SKY_KEYFRAMES[i].hour && h <= SKY_KEYFRAMES[i + 1].hour) {
        k0 = SKY_KEYFRAMES[i];
        k1 = SKY_KEYFRAMES[i + 1];
        break;
      }
    }
    const span = Math.max(0.001, k1.hour - k0.hour);
    const t = THREE.MathUtils.smoothstep((h - k0.hour) / span, 0, 1);

    _skyColor.copy(k0.sky).lerp(k1.sky, t);
    _sunColor.copy(k0.sun).lerp(k1.sun, t);
    _hemiSky.copy(k0.hemiSky).lerp(k1.hemiSky, t);
    _hemiGround.copy(k0.hemiGround).lerp(k1.hemiGround, t);
    _floorColor.copy(k0.floor).lerp(k1.floor, t);

    const baseKeyInt = THREE.MathUtils.lerp(k0.keyIntensity, k1.keyIntensity, t);
    const baseHemiInt = THREE.MathUtils.lerp(k0.hemiIntensity, k1.hemiIntensity, t);

    // Night factor (0 in midday, 1 at night)
    const nightFactor =
      h < 6.0
        ? 1 - THREE.MathUtils.smoothstep(h, 4.5, 6.5)
        : h > 18.0
          ? THREE.MathUtils.smoothstep(h, 18.0, 20.0)
          : 0;

    // Weather overcast / storm darkening & fog density
    const overcast =
      weather === 'storm' ? 0.56 : weather === 'rain' ? 0.36 : weather === 'mist' ? 0.22 : 0.0;
    _tempColor.set('#2c373d');
    _skyColor.lerp(_tempColor, overcast * (1 - nightFactor * 0.65));
    _floorColor.lerp(_tempColor, overcast * 0.5);

    // Storm lightning flashes
    if (weather === 'storm') {
      this.stormTimer -= dt;
      if (this.stormTimer <= 0) {
        this.lightningEnergy = 2.8 + Math.random() * 2.2;
        this.stormTimer = 3.5 + Math.random() * 6.5;
      }
    } else {
      this.stormTimer = 2.0;
    }
    this.lightningEnergy = THREE.MathUtils.damp(this.lightningEnergy, 0, 11.0, dt);

    if (this.lightningEnergy > 0.05) {
      _tempColor.set('#d8ecff');
      _skyColor.lerp(_tempColor, Math.min(0.45, this.lightningEnergy * 0.14));
    }

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(_skyColor);
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(_skyColor);
      const targetFog =
        weather === 'mist'
          ? 0.042
          : weather === 'storm'
            ? 0.038
            : weather === 'rain'
              ? 0.032
              : 0.022;
      this.scene.fog.density = THREE.MathUtils.damp(this.scene.fog.density, targetFog, 3.0, dt);
    }
    materials.studioFloor.color.copy(_floorColor);

    // Sun / Moon orbital arc around the terrarium
    const dayPhase = ((h - 6) / 12) * Math.PI; // 0 at 6am, PI/2 at noon, PI at 6pm
    const isDay = h >= 6 && h <= 18;
    const elevAngle = isDay ? Math.max(0.22, Math.sin(dayPhase) * 1.15) : 0.78;
    const azimAngle = isDay ? (dayPhase - Math.PI / 2) * 1.15 : -0.65;
    const lightDist = 7.8;

    this.keyLight.position.set(
      Math.sin(azimAngle) * Math.cos(elevAngle) * lightDist,
      Math.sin(elevAngle) * lightDist,
      Math.cos(azimAngle) * Math.cos(elevAngle) * lightDist
    );
    this.keyLight.color.copy(_sunColor);
    this.keyLight.intensity = baseKeyInt * (1 - overcast * 0.45) + this.lightningEnergy;

    this.hemiLight.color.copy(_hemiSky);
    this.hemiLight.groundColor.copy(_hemiGround);
    this.hemiLight.intensity = baseHemiInt + this.lightningEnergy * 0.28;

    this.rimLight.intensity = 0.65 + nightFactor * 0.45 + this.lightningEnergy * 0.45;
    this.rimLight.color.setHex(nightFactor > 0.5 ? 0x6f9fd8 : 0xb2d4ec);

    // Interior night conservatory warmth & bioluminescent glow
    this.lanternLight.intensity = nightFactor * 1.15;
    this.mushroomLight.intensity = nightFactor * (1.35 + Math.sin(elapsed * 2.4) * 0.18);

    // 2. Condensation on glass
    this.mistBurstEnvelope = Math.max(0, this.mistBurstEnvelope - dt * 0.14);
    const targetCond =
      (weather === 'mist' ? 0.22 : weather === 'storm' ? 0.24 : weather === 'rain' ? 0.16 : 0.03) +
      this.mistBurstEnvelope * 0.18;
    this.currentCondensation = THREE.MathUtils.damp(this.currentCondensation, Math.min(0.32, targetCond), 2.5, dt);
    materials.condensationGlass.opacity = this.currentCondensation;

    // 3. Rain Particles
    const targetRain = weather === 'storm' ? 1.0 : weather === 'rain' ? 0.65 : 0.0;
    this.currentRainOpacity = THREE.MathUtils.damp(this.currentRainOpacity, targetRain, 4.0, dt);
    const rainStrength = this.currentRainOpacity;

    if (rainStrength > 0.015) {
      this.rainInst.visible = true;
      this.rainMat.opacity = rainStrength * 0.52;
      const fallSpeed = weather === 'storm' ? 1.95 : 1.35;
      _dummyQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), weather === 'storm' ? 0.12 : 0.03);
      _dummyScale.set(1, weather === 'storm' ? 1.35 : 1.0, 1);

      for (let i = 0; i < this.rainCount; i++) {
        const idx = i * 4;
        let phase = this.rainSeeds[idx + 1] + dt * fallSpeed * this.rainSeeds[idx + 3];
        if (phase > 1) phase -= Math.floor(phase);
        this.rainSeeds[idx + 1] = phase;

        const y = THREE.MathUtils.lerp(2.3, POND_WATER_Y + 0.08, phase);
        _dummyPos.set(this.rainSeeds[idx], y, this.rainSeeds[idx + 2]);
        _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
        this.rainInst.setMatrixAt(i, _dummyMatrix);
      }
      this.rainInst.instanceMatrix.needsUpdate = true;
    } else {
      this.rainInst.visible = false;
    }

    // 4. Mist Particles (active in Mist, Rain, Storm, or Mist Burst)
    const targetMist =
      Math.max(
        weather === 'mist' ? 0.85 : weather === 'storm' ? 0.45 : weather === 'rain' ? 0.35 : 0.0,
        this.mistBurstEnvelope
      );
    this.currentMistOpacity = THREE.MathUtils.damp(this.currentMistOpacity, targetMist, 2.2, dt);

    if (this.currentMistOpacity > 0.015) {
      this.mistPoints.visible = true;
      this.mistMat.opacity = this.currentMistOpacity * 0.48;
      const mPos = this.mistGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < this.mistCount; i++) {
        const a = this.mistSeeds[i * 3] + elapsed * 0.08 * this.mistSeeds[i * 3 + 2];
        const r = this.mistSeeds[i * 3 + 1];
        const baseH = 0.52 + ((i * 19) % 100) / 115;
        mPos.setXYZ(
          i,
          Math.cos(a) * r,
          baseH + Math.sin(elapsed * 0.65 + i) * 0.07,
          Math.sin(a) * r
        );
      }
      mPos.needsUpdate = true;
    } else {
      this.mistPoints.visible = false;
    }

    // 5. Night Fireflies / Spores
    const fireflyStrength = nightFactor * (weather === 'storm' ? 0.25 : 1.0);
    if (fireflyStrength > 0.02) {
      this.fireflyPoints.visible = true;
      this.fireflyMat.opacity = fireflyStrength * 0.88;
      const fPos = this.fireflyGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < this.fireflyCount; i++) {
        const a = this.fireflySeeds[i * 3] + elapsed * 0.22 * (i % 2 === 0 ? 1 : -1);
        const r = this.fireflySeeds[i * 3 + 1] + Math.sin(elapsed * 0.9 + i) * 0.08;
        const p = this.fireflySeeds[i * 3 + 2];
        const y = 0.62 + (i % 7) * 0.16 + Math.sin(elapsed * 1.4 + p) * 0.12;
        fPos.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
      }
      fPos.needsUpdate = true;
    } else {
      this.fireflyPoints.visible = false;
    }

    return { nightFactor, rainIntensity: rainStrength };
  }

  public dispose(): void {
    this.rainGeo.dispose();
    this.rainMat.dispose();
    this.mistGeo.dispose();
    this.mistMat.dispose();
    this.fireflyGeo.dispose();
    this.fireflyMat.dispose();
  }
}
