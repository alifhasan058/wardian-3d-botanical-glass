import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type {
  CameraPreset,
  SpecimenInfo,
  TerrariumSettings,
} from '../types/terrarium';
import { TerrariumAtmosphere } from './atmosphere';
import { TerrariumAudio } from './audio';
import { createTerrariumFlora, type FloraBuildResult } from './flora';
import { createTerrariumMaterials, type TerrariumMaterials } from './materials';
import { createTerrariumTerrain, POND_CENTER_X, POND_CENTER_Z, type TerrainBuildResult } from './terrain';
import { createProceduralTextures, type ProceduralTextureSet } from './textures';
import { createTerrariumVessel, type VesselBuildResult } from './vessel';

interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

const CAMERA_POSES: Record<CameraPreset, CameraPose> = {
  overview: {
    position: new THREE.Vector3(3.65, 2.35, 4.15),
    target: new THREE.Vector3(0, 1.05, 0),
  },
  canopy: {
    position: new THREE.Vector3(-1.85, 2.15, 2.15),
    target: new THREE.Vector3(-0.32, 1.38, -0.2),
  },
  moss: {
    position: new THREE.Vector3(1.55, 1.08, 2.35),
    target: new THREE.Vector3(-0.08, 0.56, 0.35),
  },
  pond: {
    position: new THREE.Vector3(2.15, 1.28, 1.95),
    target: new THREE.Vector3(POND_CENTER_X, 0.42, POND_CENTER_Z),
  },
};

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export interface EngineCallbacks {
  onSelectSpecimen: (specimen: SpecimenInfo | null) => void;
  onTimeTick?: (hour: number) => void;
  onContextLostChange?: (lost: boolean) => void;
}

export class TerrariumEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly isSoftwareGl: boolean;
  private readonly clock = new THREE.Clock();

  private readonly textures: ProceduralTextureSet;
  private readonly materials: TerrariumMaterials;
  private readonly terrain: TerrainBuildResult;
  private readonly atmosphere: TerrariumAtmosphere;
  private readonly audio = new TerrariumAudio();

  private vessel: VesselBuildResult;
  private flora: FloraBuildResult;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private pointerDownPos = { x: 0, y: 0 };

  private settings: TerrariumSettings;
  private callbacks: EngineCallbacks;
  private activeCameraTransition: CameraPose | null = null;
  private frameId = 0;
  private disposed = false;
  private envRenderTarget: THREE.WebGLRenderTarget;
  private lastUiTimeSync = 0;

  constructor(
    private readonly container: HTMLElement,
    initialSettings: TerrariumSettings,
    callbacks: EngineCallbacks
  ) {
    this.settings = { ...initialSettings };
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#d7e3df');
    this.scene.fog = new THREE.FogExp2('#d7e3df', 0.022);

    // Mandatory Studio PBR Reflection Environment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRenderTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 60);
    this.camera.position.copy(CAMERA_POSES.overview.position);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(CAMERA_POSES.overview.target);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 2.1;
    this.controls.maxDistance = 9.0;
    this.controls.minPolarAngle = 0.22;
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.enablePan = true;
    this.controls.update();

    // Cancel scripted camera transition immediately if user grabs orbit controls
    this.controls.addEventListener('start', () => {
      this.activeCameraTransition = null;
    });

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);
    this.materials = createTerrariumMaterials(this.textures, this.isSoftwareGl);
    this.terrain = createTerrariumTerrain(this.materials, this.textures);
    this.scene.add(this.terrain.group);

    this.vessel = createTerrariumVessel(this.settings.vesselStyle, this.materials);
    this.scene.add(this.vessel.group);

    this.flora = createTerrariumFlora(this.settings.biomeSeed, this.materials);
    this.scene.add(this.flora.group);

    this.atmosphere = new TerrariumAtmosphere(this.scene, this.textures, this.isSoftwareGl);
    this.atmosphere.setMushroomAnchor(this.flora.mushroomLightAnchor);

    // Raycaster strictly targets simplified proxy hitboxes on layer 1
    this.raycaster.layers.set(1);

    this.bindEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.clock.start();
    this.tick();
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.callbacks.onContextLostChange?.(true);
  };

  private handleContextRestored = (): void => {
    this.callbacks.onContextLostChange?.(false);
    this.clock.start();
    this.tick();
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handlePointerDown = (e: PointerEvent): void => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private handlePointerUp = (e: PointerEvent): void => {
    // Only treat as a click if pointer didn't drag the camera
    const moveDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (moveDist > 6) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.flora.interactables, false);
    if (hits.length > 0) {
      const specimen = hits[0].object.userData.specimen as SpecimenInfo | undefined;
      this.callbacks.onSelectSpecimen(specimen ?? null);
    } else {
      this.callbacks.onSelectSpecimen(null);
    }
  };

  public updateSettings(next: TerrariumSettings): void {
    const vesselChanged = next.vesselStyle !== this.settings.vesselStyle;
    const seedChanged = next.biomeSeed !== this.settings.biomeSeed;
    const soundChanged = next.soundEnabled !== this.settings.soundEnabled;

    this.settings = { ...next };

    if (vesselChanged) {
      this.scene.remove(this.vessel.group);
      this.vessel.dispose();
      this.vessel = createTerrariumVessel(next.vesselStyle, this.materials);
      this.scene.add(this.vessel.group);
    }

    if (seedChanged) {
      this.scene.remove(this.flora.group);
      this.flora.dispose();
      this.flora = createTerrariumFlora(next.biomeSeed, this.materials);
      this.scene.add(this.flora.group);
      this.atmosphere.setMushroomAnchor(this.flora.mushroomLightAnchor);
      this.callbacks.onSelectSpecimen(null);
    }

    if (soundChanged) {
      this.audio.setEnabled(next.soundEnabled);
    }
    this.audio.setEnvironment(next.weather, next.timeOfDay);
  }

  public setCameraPreset(preset: CameraPreset): void {
    const pose = CAMERA_POSES[preset];
    this.activeCameraTransition = {
      position: pose.position.clone(),
      target: pose.target.clone(),
    };
  }

  public triggerMistBurst(): void {
    this.atmosphere.triggerMistBurst();
    this.audio.triggerMistBurst();
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    // Auto-cycle day/night clock smoothly
    if (this.settings.autoCycle) {
      this.settings.timeOfDay = (this.settings.timeOfDay + dt * 0.55) % 24;
      if (elapsed - this.lastUiTimeSync > 0.12) {
        this.lastUiTimeSync = elapsed;
        this.callbacks.onTimeTick?.(this.settings.timeOfDay);
      }
    }

    // Smooth exponential camera preset transition
    if (this.activeCameraTransition) {
      const k = 4.6;
      const alpha = 1 - Math.exp(-k * dt);
      this.camera.position.lerp(this.activeCameraTransition.position, alpha);
      this.controls.target.lerp(this.activeCameraTransition.target, alpha);

      if (
        this.camera.position.distanceTo(this.activeCameraTransition.position) < 0.015 &&
        this.controls.target.distanceTo(this.activeCameraTransition.target) < 0.015
      ) {
        this.camera.position.copy(this.activeCameraTransition.position);
        this.controls.target.copy(this.activeCameraTransition.target);
        this.activeCameraTransition = null;
      }
    }

    this.controls.update();

    const { nightFactor, rainIntensity } = this.atmosphere.update(
      dt,
      elapsed,
      this.settings.timeOfDay,
      this.settings.weather,
      this.materials
    );

    const windStrength =
      this.settings.weather === 'storm'
        ? 1.55
        : this.settings.weather === 'rain'
          ? 0.85
          : this.settings.weather === 'mist'
            ? 0.45
            : 0.35;

    this.materials.updateTime(elapsed, windStrength, rainIntensity, nightFactor);

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.controls.dispose();
    this.terrain.dispose();
    this.vessel.dispose();
    this.flora.dispose();
    this.atmosphere.dispose();
    this.textures.dispose();
    this.materials.dispose();
    this.envRenderTarget.dispose();
    this.audio.dispose();
    this.renderer.dispose();

    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
