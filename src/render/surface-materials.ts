import * as THREE from 'three';

export type SurfaceKind = 'voxel' | 'asphalt' | 'paving' | 'plaster' | 'roof' | 'metal' | 'glass' | 'earth';
const tiles = new Map<SurfaceKind, THREE.CanvasTexture>();
const paints = new Map<SurfaceKind, THREE.MeshStandardMaterial>();
export const SURFACE_KINDS: SurfaceKind[] = ['voxel', 'asphalt', 'paving', 'plaster', 'roof', 'metal', 'glass', 'earth'];
let atlas: THREE.CanvasTexture | undefined;
let atlasPaint: THREE.MeshStandardMaterial | undefined;
const description: Record<SurfaceKind, { scale: number; strength: number; roughness: number; metalness: number }> = {
  voxel: { scale: .8, strength: .32, roughness: .94, metalness: 0 },
  asphalt: { scale: .125, strength: .82, roughness: .97, metalness: 0 },
  paving: { scale: .25, strength: .68, roughness: .95, metalness: 0 },
  plaster: { scale: .22, strength: .56, roughness: .98, metalness: 0 },
  roof: { scale: .32, strength: .6, roughness: .92, metalness: 0 },
  metal: { scale: .6, strength: .6, roughness: .64, metalness: .28 },
  glass: { scale: .45, strength: .46, roughness: .29, metalness: .38 },
  earth: { scale: .15, strength: .65, roughness: 1, metalness: 0 },
};
const noise = (x: number, y: number, seed = 0): number => {
  let n = Math.imul(x + 43, 374761393) ^ Math.imul(y + seed + 97, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

/** Original, deterministic 256 px detail tiles. World mapping survives all static batching. */
function texture(kind: SurfaceKind): THREE.CanvasTexture {
  const cached = tiles.get(kind); if (cached) return cached;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!, pixels = ctx.createImageData(256, 256);
  const seed = Object.keys(description).indexOf(kind) * 73;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const fine = noise(x, y, seed), coarse = noise(x >> 4, y >> 4, seed), medium = noise(x >> 2, y >> 2, seed);
    let value = 202 + fine * 39 + coarse * 9, r = 1, g = 1, b = 1;
    if (kind === 'asphalt') { value = 187 + fine * 35 + medium * 17; if (fine > .985) value = 247; }
    if (kind === 'paving') value = 203 + fine * 24 + medium * 18;
    if (kind === 'plaster') { value = 192 + fine * 28 + medium * 13 + coarse * 12; if (medium < .12 && coarse < .48) value -= 40; }
    if (kind === 'roof') { value = 185 + medium * 25 + fine * 25; r = 1.025; b = .96; }
    if (kind === 'metal' && medium < .38 && coarse < .58) { r = 1.03; g = .65; b = .43; value = 166 + fine * 38; }
    if (kind === 'glass') value = 215 + fine * 24;
    if (kind === 'earth') { value = 159 + medium * 30 + fine * 40; r = 1.02; b = .92; }
    const i = (x + y * 256) * 4;
    pixels.data[i] = Math.min(255, value * r); pixels.data[i + 1] = Math.min(255, value * g); pixels.data[i + 2] = Math.min(255, value * b); pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  let state = seed + 871; const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  if (kind === 'asphalt' || kind === 'paving') {
    // Repaired islands and angular fractures, with narrow warm aggregate edges.
    for (let i = 0; i < (kind === 'asphalt' ? 9 : 4); i++) {
      const x = random() * 220, y = random() * 220;
      ctx.fillStyle = i % 2 ? 'rgba(27,31,33,.21)' : 'rgba(219,219,211,.18)';
      ctx.fillRect(x, y, 15 + random() * 55, 8 + random() * 37);
    }
    if (kind === 'paving') {
      ctx.strokeStyle = 'rgba(65,64,55,.5)'; ctx.lineWidth = 1.1;
      for (let i = 0; i <= 256; i += 64) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke(); }
      for (let y = 0; y < 256; y += 64) for (let x = (y / 64) % 2 ? 32 : 0; x < 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 64); ctx.stroke(); }
    }
    for (let i = 0; i < 5; i++) {
      const points: [number, number][] = [[24 + random() * 200, 24 + random() * 200]];
      for (let j = 0; j < 5; j++) { const p = points.at(-1)!; points.push([p[0] + (random() - .45) * 19, p[1] + (random() - .25) * 16]); }
      for (const [width, color] of [[2.1, 'rgba(212,197,166,.36)'], [.85, 'rgba(21,23,20,.85)']] as const) {
        ctx.lineWidth = width; ctx.strokeStyle = color; ctx.beginPath(); points.forEach(([x, y], j) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      }
    }
  }
  if (kind === 'plaster' || kind === 'roof' || kind === 'metal' || kind === 'glass') {
    for (let i = 0; i < 22; i++) {
      const x = random() * 256, y = random() * 240, h = 9 + random() * 70;
      const gradient = ctx.createLinearGradient(x, y, x, y + h); gradient.addColorStop(0, 'rgba(52,47,36,.22)'); gradient.addColorStop(1, 'rgba(52,47,36,0)');
      ctx.fillStyle = gradient; ctx.fillRect(x, y, .5 + random() * 4, h);
    }
  }
  if (kind === 'plaster') {
    for (let i = 0; i < 7; i++) {
      const x = random() * 230, y = random() * 245, width = 5 + random() * 18, height = 7 + random() * 14;
      ctx.fillStyle = i % 2 ? 'rgba(64,59,49,.27)' : 'rgba(231,223,201,.15)';
      ctx.fillRect(x, y, width, height); ctx.fillRect(x + width * .18, y - height * .3, width * .64, height * 1.5);
    }
  }
  const result = new THREE.CanvasTexture(canvas); result.name = `last-night:${kind}:original-256`;
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.minFilter = THREE.LinearMipmapLinearFilter; result.magFilter = THREE.LinearFilter; result.anisotropy = 4;
  result.colorSpace = THREE.NoColorSpace; tiles.set(kind, result); return result;
}

/** Keep the physically lit material and voxel vertex colors; add only surface response. */
export function weatherSurface(material: THREE.MeshStandardMaterial, kind: SurfaceKind, useAtlas = false): THREE.MeshStandardMaterial {
  const spec = description[kind];
  material.userData.surfaceKind = kind;
  material.roughness = spec.roughness; material.metalness = spec.metalness;
  material.onBeforeCompile = shader => {
    shader.uniforms.lnSurface = { value: useAtlas ? surfaceAtlas() : texture(kind) };
    shader.uniforms.lnSurfaceScale = { value: spec.scale };
    shader.uniforms.lnSurfaceStrength = { value: spec.strength };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 lnWorldPosition;\nvarying vec3 lnWorldNormal;${useAtlas ? '\nattribute float surfaceType;\nvarying float lnSurfaceType;' : ''}`)
      .replace('#include <project_vertex>', `
        vec4 lnLocalPosition = vec4(transformed, 1.0);
        vec3 lnLocalNormal = objectNormal;
        #ifdef USE_INSTANCING
          lnLocalPosition = instanceMatrix * lnLocalPosition;
          lnLocalNormal = mat3(instanceMatrix) * lnLocalNormal;
        #endif
        lnWorldPosition = (modelMatrix * lnLocalPosition).xyz;
        lnWorldNormal = normalize(mat3(modelMatrix) * lnLocalNormal);
        ${useAtlas ? 'lnSurfaceType = surfaceType;' : ''}
        #include <project_vertex>`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 lnWorldPosition;\nvarying vec3 lnWorldNormal;\nuniform sampler2D lnSurface;\nuniform float lnSurfaceScale;\nuniform float lnSurfaceStrength;${useAtlas ? '\nvarying float lnSurfaceType;' : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 lnN = abs(lnWorldNormal);
        vec2 lnUV = lnN.y > max(lnN.x, lnN.z) ? lnWorldPosition.xz : (lnN.x > lnN.z ? lnWorldPosition.zy : lnWorldPosition.xy);
        ${useAtlas ? `
          float lnKind = floor(lnSurfaceType + .5);
          vec4 lnParams = vec4(.8, .32, .94, 0.0);
          if (lnKind > .5 && lnKind < 1.5) lnParams = vec4(.125, .82, .97, 0.0);
          else if (lnKind < 2.5 && lnKind > 1.5) lnParams = vec4(.25, .68, .95, 0.0);
          else if (lnKind < 3.5 && lnKind > 2.5) lnParams = vec4(.22, .56, .98, 0.0);
          else if (lnKind < 4.5 && lnKind > 3.5) lnParams = vec4(.32, .6, .92, 0.0);
          else if (lnKind < 5.5 && lnKind > 4.5) lnParams = vec4(.6, .6, .64, .28);
          else if (lnKind < 6.5 && lnKind > 5.5) lnParams = vec4(.45, .46, .29, .38);
          else if (lnKind > 6.5) lnParams = vec4(.15, .65, 1.0, 0.0);
          vec2 lnTile = vec2(mod(lnKind, 4.0), 1.0 - floor(lnKind / 4.0));
          vec2 lnAtlasUV = (lnTile + clamp(fract(lnUV * lnParams.x), vec2(.006), vec2(.994))) / vec2(4.0, 2.0);
          vec3 lnDetail = texture2D(lnSurface, lnAtlasUV).rgb;
          diffuseColor.rgb *= mix(vec3(1.0), lnDetail, lnParams.y);
        ` : `vec3 lnDetail = texture2D(lnSurface, lnUV * lnSurfaceScale).rgb;
          diffuseColor.rgb *= mix(vec3(1.0), lnDetail, lnSurfaceStrength);`}
      `).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = clamp(${useAtlas ? 'lnParams.z' : 'roughnessFactor'} + (lnDetail.g - .78) * .12, .12, 1.0);`);
    if (useAtlas) shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = lnParams.w;');
  };
  material.customProgramCacheKey = () => `last-night-surface-v2:${useAtlas ? 'atlas' : kind}`;
  material.needsUpdate = true; return material;
}
function surfaceAtlas(): THREE.CanvasTexture {
  if (atlas) return atlas;
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  SURFACE_KINDS.forEach((kind, i) => ctx.drawImage(texture(kind).image, (i % 4) * 256, Math.floor(i / 4) * 256));
  atlas = new THREE.CanvasTexture(canvas); atlas.name = 'last-night:world-surface-atlas'; atlas.colorSpace = THREE.NoColorSpace;
  atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.magFilter = THREE.LinearFilter; atlas.anisotropy = 4;
  return atlas;
}
/** One static chunk draw; per-vertex family retains distinct PBR responses. */
export function surfaceAtlasMaterial(): THREE.MeshStandardMaterial {
  if (!atlasPaint) atlasPaint = weatherSurface(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, flatShading: true }), 'voxel', true);
  return atlasPaint;
}

/** White vertex-paint targets allow all static surfaces in a family to share a draw. */
export function surfaceBatchMaterial(kind: SurfaceKind): THREE.MeshStandardMaterial {
  let material = paints.get(kind);
  if (!material) { material = weatherSurface(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, flatShading: true }), kind); paints.set(kind, material); }
  return material;
}
export function surfaceStats(): { materialFamilies: number; textureCount: number; textureBytesWithMipmaps: number; resolution: number; atlas: string; staticBatchMaterialCount: number } {
  return { materialFamilies: paints.size, textureCount: tiles.size + (atlas ? 1 : 0), textureBytesWithMipmaps: Math.round((tiles.size * 256 * 256 + (atlas ? 1024 * 512 : 0)) * 4 * 4 / 3), resolution: 256, atlas: atlas ? '1024×512' : 'not compiled', staticBatchMaterialCount: atlasPaint ? 1 : 0 };
}
