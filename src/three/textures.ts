import * as THREE from 'three';

export interface ProceduralTextureSet {
  walnutMap: THREE.CanvasTexture;
  walnutBump: THREE.CanvasTexture;
  soilMap: THREE.CanvasTexture;
  soilBump: THREE.CanvasTexture;
  barkMap: THREE.CanvasTexture;
  barkBump: THREE.CanvasTexture;
  slateMap: THREE.CanvasTexture;
  slateBump: THREE.CanvasTexture;
  leafMap: THREE.CanvasTexture;
  brassRoughness: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  particleGlowMap: THREE.CanvasTexture;
  mistPuffMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

// Deterministic pseudo-random helper for textures
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy));

  // 1. Turned Dark Walnut Woodgrain (Color + Bump)
  const [walnutC, wCtx] = makeCanvas(512, 512);
  const [walnutBC, wbCtx] = makeCanvas(512, 512);
  wCtx.fillStyle = '#2d1c13';
  wCtx.fillRect(0, 0, 512, 512);
  wbCtx.fillStyle = '#808080';
  wbCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y++) {
    const wave = Math.sin(y * 0.08) * 14 + Math.sin(y * 0.23) * 6;
    const tone = Math.floor(32 + Math.sin(y * 0.14 + wave * 0.05) * 14 + hash2(y, 1) * 10);
    wCtx.fillStyle = `rgb(${tone + 18}, ${Math.floor(tone * 0.72)}, ${Math.floor(tone * 0.48)})`;
    wCtx.fillRect(0, y, 512, 1);
    const bumpVal = Math.floor(110 + Math.sin(y * 0.18 + wave * 0.08) * 35);
    wbCtx.fillStyle = `rgb(${bumpVal},${bumpVal},${bumpVal})`;
    wbCtx.fillRect(0, y, 512, 1);
  }
  for (let i = 0; i < 650; i++) {
    const x = hash2(i, 3) * 512;
    const y = hash2(i, 7) * 512;
    const len = 30 + hash2(i, 11) * 120;
    wCtx.fillStyle = 'rgba(18, 10, 6, 0.25)';
    wCtx.fillRect(x, y, len, 1.5);
    wbCtx.fillStyle = 'rgba(60, 60, 60, 0.35)';
    wbCtx.fillRect(x, y, len, 1.5);
  }
  const walnutMap = finalizeTexture(walnutC, aniso, true, 2, 1);
  const walnutBump = finalizeTexture(walnutBC, aniso, false, 2, 1);

  // 2. Loamy Moss-Dappled Soil (Color + Bump)
  const [soilC, sCtx] = makeCanvas(512, 512);
  const [soilBC, sbCtx] = makeCanvas(512, 512);
  sCtx.fillStyle = '#241b14';
  sCtx.fillRect(0, 0, 512, 512);
  sbCtx.fillStyle = '#707070';
  sbCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5500; i++) {
    const x = hash2(i, 1) * 512;
    const y = hash2(i, 2) * 512;
    const r = 1 + hash2(i, 3) * 4.2;
    const mossChance = hash2(Math.floor(x / 32), Math.floor(y / 32));
    if (mossChance > 0.56 && hash2(i, 9) > 0.35) {
      const g = Math.floor(72 + hash2(i, 5) * 48);
      sCtx.fillStyle = `rgba(${Math.floor(g * 0.55)}, ${g}, ${Math.floor(g * 0.42)}, 0.58)`;
    } else {
      const d = Math.floor(24 + hash2(i, 4) * 32);
      sCtx.fillStyle = `rgba(${d + 14}, ${d + 5}, ${d}, 0.72)`;
    }
    sCtx.beginPath();
    sCtx.arc(x, y, r, 0, Math.PI * 2);
    sCtx.fill();

    const bv = Math.floor(70 + hash2(i, 6) * 155);
    sbCtx.fillStyle = `rgba(${bv},${bv},${bv},0.6)`;
    sbCtx.beginPath();
    sbCtx.arc(x, y, r * 0.9, 0, Math.PI * 2);
    sbCtx.fill();
  }
  const soilMap = finalizeTexture(soilC, aniso, true, 2, 2);
  const soilBump = finalizeTexture(soilBC, aniso, false, 2, 2);

  // 3. Textured Driftwood & Bonsai Bark
  const [barkC, bCtx] = makeCanvas(256, 512);
  const [barkBC, bbCtx] = makeCanvas(256, 512);
  bCtx.fillStyle = '#4a3a2d';
  bCtx.fillRect(0, 0, 256, 512);
  bbCtx.fillStyle = '#808080';
  bbCtx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 900; i++) {
    const x = hash2(i, 10) * 256;
    const y = hash2(i, 20) * 512;
    const w = 1.2 + hash2(i, 30) * 4;
    const h = 18 + hash2(i, 40) * 70;
    const light = hash2(i, 50) > 0.5;
    bCtx.fillStyle = light ? 'rgba(116, 98, 80, 0.32)' : 'rgba(32, 22, 16, 0.42)';
    bCtx.fillRect(x, y, w, h);
    bbCtx.fillStyle = light ? 'rgba(210,210,210,0.4)' : 'rgba(35,35,35,0.45)';
    bbCtx.fillRect(x, y, w, h);
  }
  const barkMap = finalizeTexture(barkC, aniso, true, 1, 2);
  const barkBump = finalizeTexture(barkBC, aniso, false, 1, 2);

  // 4. Layered Slate Stone
  const [slateC, slCtx] = makeCanvas(256, 256);
  const [slateBC, slbCtx] = makeCanvas(256, 256);
  slCtx.fillStyle = '#464d4f';
  slCtx.fillRect(0, 0, 256, 256);
  slbCtx.fillStyle = '#808080';
  slbCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) {
    const n = hash2(y, 13);
    const v = Math.floor(56 + n * 30);
    slCtx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 6})`;
    slCtx.fillRect(0, y, 256, 3);
    const bv = Math.floor(90 + n * 100);
    slbCtx.fillStyle = `rgb(${bv}, ${bv}, ${bv})`;
    slbCtx.fillRect(0, y, 256, 3);
  }
  for (let i = 0; i < 400; i++) {
    const x = hash2(i, 8) * 256;
    const y = hash2(i, 9) * 256;
    slCtx.fillStyle = 'rgba(130, 145, 130, 0.14)';
    slCtx.fillRect(x, y, 14, 2);
  }
  const slateMap = finalizeTexture(slateC, aniso, true, 1, 1);
  const slateBump = finalizeTexture(slateBC, aniso, false, 1, 1);

  // 5. Botanical Leaf Venation Map
  const [leafC, lCtx] = makeCanvas(256, 256);
  const grad = lCtx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#3e7f48');
  grad.addColorStop(0.6, '#2d6a38');
  grad.addColorStop(1, '#1e4d28');
  lCtx.fillStyle = grad;
  lCtx.fillRect(0, 0, 256, 256);
  lCtx.strokeStyle = 'rgba(145, 205, 130, 0.35)';
  lCtx.lineWidth = 3;
  lCtx.beginPath();
  lCtx.moveTo(128, 256);
  lCtx.lineTo(128, 12);
  lCtx.stroke();
  lCtx.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    const y = 40 + i * 30;
    lCtx.beginPath();
    lCtx.moveTo(128, y);
    lCtx.quadraticCurveTo(85, y - 14, 30, y - 34);
    lCtx.moveTo(128, y);
    lCtx.quadraticCurveTo(171, y - 14, 226, y - 34);
    lCtx.stroke();
  }
  const leafMap = finalizeTexture(leafC, aniso, true);

  // 6. Brushed Brass Micro-Roughness Map
  const [brassC, brCtx] = makeCanvas(256, 256);
  brCtx.fillStyle = '#505050';
  brCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const v = Math.floor(42 + hash2(y, 77) * 58);
    brCtx.fillStyle = `rgb(${v},${v},${v})`;
    brCtx.fillRect(0, y, 256, 1);
  }
  const brassRoughness = finalizeTexture(brassC, aniso, false, 2, 2);

  // 7. Radial Soft Contact Shadow
  const [shadC, shCtx] = makeCanvas(256, 256);
  const shGrad = shCtx.createRadialGradient(128, 128, 28, 128, 128, 126);
  shGrad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  shGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.36)');
  shGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 256, 256);
  const contactShadowMap = finalizeTexture(shadC, aniso, true);

  // 8. Soft Firefly / Spore Glow Sprite
  const [glowC, gCtx] = makeCanvas(128, 128);
  const gGrad = gCtx.createRadialGradient(64, 64, 2, 64, 64, 62);
  gGrad.addColorStop(0, 'rgba(255, 255, 240, 1)');
  gGrad.addColorStop(0.25, 'rgba(210, 255, 165, 0.85)');
  gGrad.addColorStop(0.65, 'rgba(130, 230, 140, 0.22)');
  gGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  gCtx.fillStyle = gGrad;
  gCtx.fillRect(0, 0, 128, 128);
  const particleGlowMap = finalizeTexture(glowC, 1, true);

  // 9. Soft Volumetric Mist Puff Sprite
  const [mistC, mCtx] = makeCanvas(128, 128);
  const mGrad = mCtx.createRadialGradient(64, 64, 8, 64, 64, 62);
  mGrad.addColorStop(0, 'rgba(235, 245, 248, 0.42)');
  mGrad.addColorStop(0.5, 'rgba(220, 236, 242, 0.16)');
  mGrad.addColorStop(1, 'rgba(220, 236, 242, 0)');
  mCtx.fillStyle = mGrad;
  mCtx.fillRect(0, 0, 128, 128);
  const mistPuffMap = finalizeTexture(mistC, 1, true);

  return {
    walnutMap,
    walnutBump,
    soilMap,
    soilBump,
    barkMap,
    barkBump,
    slateMap,
    slateBump,
    leafMap,
    brassRoughness,
    contactShadowMap,
    particleGlowMap,
    mistPuffMap,
    dispose: () => {
      walnutMap.dispose();
      walnutBump.dispose();
      soilMap.dispose();
      soilBump.dispose();
      barkMap.dispose();
      barkBump.dispose();
      slateMap.dispose();
      slateBump.dispose();
      leafMap.dispose();
      brassRoughness.dispose();
      contactShadowMap.dispose();
      particleGlowMap.dispose();
      mistPuffMap.dispose();
    },
  };
}
