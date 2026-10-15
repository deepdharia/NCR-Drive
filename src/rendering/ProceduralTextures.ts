import * as THREE from 'three';

export type SurfaceKind = 'asphalt' | 'paving' | 'concrete' | 'plaster' | 'denim' | 'cloth';

function canvas(size: number): { image: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const image = document.createElement('canvas'); image.width = image.height = size;
  const ctx = image.getContext('2d'); if (!ctx) throw new Error('Procedural materials require Canvas 2D.');
  return { image, ctx };
}

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

function texture(image: HTMLCanvasElement, color = true): THREE.CanvasTexture {
  const map = new THREE.CanvasTexture(image);
  map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4; return map;
}

/** Deterministic, tileable albedo/height/roughness maps; no network image requests. */
export function surfaceMaterial(kind: SurfaceKind, roadLines = false): THREE.MeshStandardMaterial {
  const size = kind === 'asphalt' || kind === 'paving' ? 512 : 256;
  const { image, ctx } = canvas(size), height = canvas(size), roughness = canvas(size);
  const noise = random(kind.length * 3191 + size);
  const colors: Record<SurfaceKind, [number, number, number]> = {
    asphalt: [30, 30, 32], paving: [180, 153, 123], concrete: [184, 183, 174],
    plaster: [247, 247, 247], denim: [35, 54, 72], cloth: [199, 188, 160],
  };
  const data = ctx.createImageData(size, size), bump = height.ctx.createImageData(size, size), rough = roughness.ctx.createImageData(size, size);
  const base = colors[kind];
  for (let i = 0; i < size * size; i++) {
    const grain = (noise() - 0.5) * (kind === 'asphalt' ? 23 : 15);
    const weave = kind === 'denim' || kind === 'cloth' ? ((Math.floor(i / size) + i % size) % 3 - 1) * 8 : 0;
    for (let channel = 0; channel < 3; channel++) {
      data.data[i * 4 + channel] = Math.min(255, Math.max(0, base[channel] + grain + weave));
      bump.data[i * 4 + channel] = 125 + grain * 3 + weave;
      rough.data[i * 4 + channel] = (kind === 'asphalt' ? 226 : 235) + grain;
    }
    data.data[i * 4 + 3] = bump.data[i * 4 + 3] = rough.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0); height.ctx.putImageData(bump, 0, 0); roughness.ctx.putImageData(rough, 0, 0);
  if (kind === 'paving') {
    const tile = size / 8;
    for (let row = 0; row < 8; row++) for (let column = -1; column < 8; column++) {
      const x = column * tile + row % 2 * tile / 2, y = row * tile;
      ctx.fillStyle = `rgba(${row % 3 === 0 ? '118,70,48' : '221,206,175'},${0.09 + noise() * 0.16})`;
      ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      ctx.strokeStyle = '#796d5b'; ctx.lineWidth = 2; ctx.strokeRect(x, y, tile, tile);
      height.ctx.strokeStyle = '#303030'; height.ctx.lineWidth = 3; height.ctx.strokeRect(x, y, tile, tile);
      ctx.strokeStyle = '#e2ceb07a'; ctx.lineWidth = 1; ctx.strokeRect(x + 2, y + 2, tile - 4, tile - 4);
    }
  }
  if (kind === 'concrete' || kind === 'plaster') {
    ctx.strokeStyle = kind === 'plaster' ? '#b4ae9e15' : '#565b5725'; ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      const x = noise() * size, y = noise() * size;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + noise() * 15, y + noise() * 50); ctx.stroke();
    }
  }
  if (kind === 'asphalt' && roadLines) {
    // U is travel distance (12 m per repeat); V spans the 12 m carriageway.
    ctx.fillStyle = '#e1b536';
    ctx.fillRect(0, size * 0.48, size, 6); ctx.fillRect(0, size * 0.515, size, 6);
    ctx.fillStyle = '#e3e1d6';
    for (const y of [0.25, 0.75]) ctx.fillRect(size * 0.1, size * y, size * 0.4, 5);
    // Thin chips keep paint from looking like a perfect vector overlay.
    ctx.fillStyle = '#242426aa';
    for (let i = 0; i < 850; i++) ctx.fillRect(noise() * size, noise() * size, 1, 1);
  }
  return new THREE.MeshStandardMaterial({
    color: kind === 'plaster' ? 0xf5f2eb : 0xffffff,
    map: texture(image), bumpMap: texture(height.image, false), roughnessMap: texture(roughness.image, false),
    bumpScale: kind === 'asphalt' ? 0.025 : kind === 'paving' ? 0.045 : 0.012,
    roughness: kind === 'asphalt' ? 0.95 : 0.92,
  });
}

export function planarUV(geometry: THREE.BufferGeometry, metresPerTile = 4): THREE.BufferGeometry {
  const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) uv.setXY(i, positions.getX(i) / metresPerTile, positions.getY(i) / metresPerTile);
  return geometry;
}

export function roadRingGeometry(inner: number, outer: number, segments = 192): THREE.RingGeometry {
  const geometry = new THREE.RingGeometry(inner, outer, segments), positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) {
    let angle = Math.atan2(positions.getY(i), positions.getX(i));
    if (angle < 0) angle += Math.PI * 2;
    if (i % (segments + 1) === segments) angle = Math.PI * 2;
    uv.setXY(i, angle * ((inner + outer) / 2) / 12, (Math.hypot(positions.getX(i), positions.getY(i)) - inner) / (outer - inner));
  }
  return geometry;
}

export function roadPlaneGeometry(width: number, length: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, length), position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) uv.setXY(i, (position.getY(i) + length / 2) / 12, (position.getX(i) + width / 2) / width);
  return geometry;
}

export function environmentTexture(): THREE.CanvasTexture {
  const { image, ctx } = canvas(512);
  const sky = ctx.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#6b7c8b'); sky.addColorStop(0.45, '#e6b384'); sky.addColorStop(0.53, '#d9b58b'); sky.addColorStop(0.6, '#787061'); sky.addColorStop(1, '#33352e');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 512);
  // Broad, soft façade reflections for body panels and tinted glass.
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 3 === 0 ? '#eddfbf' : '#b6b4a1';
    ctx.fillRect(i * 45, 240, 30, 50 + i % 3 * 12);
    ctx.fillStyle = '#5b635b'; ctx.fillRect(i * 45 + 4, 255, 20, 20);
  }
  const map = texture(image); map.mapping = THREE.EquirectangularReflectionMapping;
  return map;
}

export function signTexture(english: string, hindi?: string, background = '#234036'): THREE.CanvasTexture {
  const { image, ctx } = canvas(512); image.height = hindi ? 160 : 112;
  ctx.fillStyle = background; ctx.fillRect(0, 0, image.width, image.height);
  ctx.strokeStyle = '#c1a46c'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, image.width - 12, image.height - 12);
  ctx.textAlign = 'center'; ctx.fillStyle = '#f0dfb9';
  ctx.font = `600 ${english.length > 24 ? 23 : 32}px sans-serif`;
  ctx.fillText(english, 256, hindi ? 62 : 69, 474);
  if (hindi) {
    ctx.font = '29px "Noto Sans Devanagari", "Nirmala UI", "Devanagari Sangam MN", sans-serif';
    ctx.fillStyle = '#dec497'; ctx.fillText(hindi, 256, 122, 470);
  }
  return texture(image);
}

export function shopWindowTexture(): THREE.CanvasTexture {
  const { image, ctx } = canvas(256);
  const interior = ctx.createLinearGradient(0, 0, 0, 256);
  interior.addColorStop(0, '#e2bd76'); interior.addColorStop(0.35, '#b58b54'); interior.addColorStop(1, '#443e31');
  ctx.fillStyle = interior; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#e7d6a2'; ctx.fillRect(12, 13, 232, 6);
  for (let shelf = 0; shelf < 3; shelf++) {
    ctx.fillStyle = '#4c4030'; ctx.fillRect(14, 80 + shelf * 60, 228, 8);
    for (let item = 0; item < 12; item++) {
      ctx.fillStyle = ['#c9b181', '#a87c4b', '#6d735a', '#b6a58a'][item % 4];
      ctx.fillRect(18 + item * 19, 48 + shelf * 60 + item % 3 * 3, 11, 30 - item % 3 * 3);
    }
  }
  ctx.fillStyle = '#fff0bd25'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(125, 0); ctx.lineTo(0, 240); ctx.fill();
  return texture(image);
}

export function glowTexture(): THREE.CanvasTexture {
  const { image, ctx } = canvas(64);
  const halo = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
  halo.addColorStop(0, '#fff9dfdf'); halo.addColorStop(0.2, '#ffdc9559'); halo.addColorStop(1, '#ffbb4400');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, 64, 64); return texture(image);
}
