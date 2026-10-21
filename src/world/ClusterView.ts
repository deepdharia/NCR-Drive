import * as THREE from 'three';
import { CLUSTERS, shopLabel, shopById } from './ClusterData';
import type { Cluster, ClusterShop } from './ClusterData';
import { CLUSTER_PROPS } from './ClusterLayout';
import type { PlacedProp } from './ClusterLayout';
import { signTexture, shopWindowTexture, worldSurfaceMaterial } from '../rendering/ProceduralTextures';
import type { Point } from '../core/math';

/** Visuals for the four Parks & Shopping clusters. Every prop is placed from
 * ClusterLayout (the same numbers as collision), so what you see is what
 * blocks you. All geometry is original procedural work — no imported models. */
const KIND_ACCENT: Record<string, number> = { fashion: 0x1e1e26, streetwear: 0xc94a2e, flowers: 0xd0608a, sweets: 0xd97e2e, bakery: 0x8a6a3a, cafe: 0x3a5a3a };
const KIND_SIGN_BG: Record<string, string> = { fashion: '#1e1e26', streetwear: '#8a2e1e', flowers: '#6e2a44', sweets: '#7a3e10', bakery: '#4a3410', cafe: '#1e3a2a' };

export class ClusterView {
  readonly group = new THREE.Group();
  private chunks: { group: THREE.Group; point: Point; radius: number }[] = [];
  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const plaster = new THREE.MeshStandardMaterial({ color: 0xeae3d3, roughness: 0.92 });
    const plaster2 = new THREE.MeshStandardMaterial({ color: 0xd8cdb4, roughness: 0.92 });
    const stone = new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.95 });
    const asphalt = worldSurfaceMaterial('asphalt');
    const paving = new THREE.MeshStandardMaterial({ color: 0xc9c4b4, roughness: 1 });
    const grass = new THREE.MeshStandardMaterial({ color: 0x6e8f52, roughness: 1 });
    const foliage = new THREE.MeshStandardMaterial({ color: 0x4e7038, roughness: 1 });
    const foliage2 = new THREE.MeshStandardMaterial({ color: 0x5e8040, roughness: 1 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2e2620, roughness: 0.9 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.5, metalness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9ec4cc, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.5 });
    const water = new THREE.MeshStandardMaterial({ color: 0x6fa8b8, roughness: 0.2, metalness: 0.1 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.8 });
    const paint = new THREE.MeshBasicMaterial({ color: 0xe9dbad });
    const mesh = (g: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0) => {
      const m = new THREE.Mesh(box, material); m.position.set(x, y, z); m.scale.set(w, h, d); m.rotation.y = yaw; g.add(m); return m;
    };
    const plane = (g: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, yaw = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material); m.position.set(x, y, z); m.scale.set(w, h, 1); m.rotation.y = yaw; g.add(m); return m;
    };
    const blob = (g: THREE.Group, material: THREE.Material, x: number, y: number, z: number, r: number) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), material); m.position.set(x, y, z); g.add(m); return m;
    };

    for (const cluster of CLUSTERS) {
      const chunk = new THREE.Group(); this.group.add(chunk);
      this.chunks.push({ group: chunk, point: cluster.arrival, radius: 220 });
      this.ground(chunk, cluster, { asphalt, paving, grass, paint });
      for (const prop of CLUSTER_PROPS.filter(p => p.cluster === cluster.id)) this.prop(chunk, prop, { box, plaster, plaster2, stone, paving, grass, foliage, foliage2, wood, dark, metal, glass, water, white, paint, mesh, plane, blob });
    }
  }

  private ground(g: THREE.Group, c: Cluster, m: { asphalt: THREE.Material; paving: THREE.Material; grass: THREE.Material; paint: THREE.Material }): void {
    const flat = (material: THREE.Material, x: number, z: number, w: number, d: number, yaw = 0, y = 0.02) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material); mesh.position.set(x, y, z); mesh.scale.set(w, 0.04, d); mesh.rotation.y = yaw; g.add(mesh); return mesh;
    };
    const bays = (cx: number, cz: number, w: number, d: number, yaw: number, n: number) => {
      for (let i = 0; i <= n; i++) {
        const t = (i / n - 0.5) * w;
        const line = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m.paint);
        line.position.set(cx + Math.cos(yaw) * t, 0.05, cz - Math.sin(yaw) * t); line.scale.set(0.15, 0.02, d * 0.8); line.rotation.y = yaw; g.add(line);
      }
    };
    if (c.id === 'garden-stop') {
      flat(m.grass, -927, 766, 64, 44);
      const ring = new THREE.Mesh(new THREE.RingGeometry(14.5, 16.5, 48), m.paving); ring.rotation.x = -Math.PI / 2; ring.position.set(-927, 0.04, 766); g.add(ring);
      flat(m.asphalt, -914.4, 790.2, 22, 12, -2.398); bays(-914.4, 790.2, 22, 12, -2.398, 4);
      flat(m.paving, -912, 769, 34, 30, 0, 0.03);
    }
    if (c.id === 'gurgaon-boulevard') {
      flat(m.paving, -2005, 1800, 170, 32);
      flat(m.asphalt, -2153.5, 1800, 93, 30); bays(-2153.5, 1800, 93, 30, 0, 9);
      flat(m.paving, -2095, 1782, 8, 34, 0, 0.03);
    }
    if (c.id === 'noida-park') {
      flat(m.grass, 3205, 355, 210, 42);
      flat(m.paving, 3225, 342, 170, 2.2, 0, 0.03); flat(m.paving, 3225, 368, 170, 2.2, 0, 0.03);
      flat(m.paving, 3125, 355, 2.2, 26, 0, 0.03); flat(m.paving, 3300, 355, 2.2, 26, 0, 0.03);
      flat(m.paving, 3200, 268, 122, 8);
      flat(m.paving, 3110, 315, 4, 42); flat(m.paving, 3131, 301, 4, 68);
      flat(m.asphalt, 3080, 270, 80, 12); bays(3080, 270, 80, 12, 0, 8);
    }
    if (c.id === 'yamuna-view') {
      flat(m.paving, 1200, -280, 18, 14);
      flat(m.asphalt, 1180, -245, 25, 30); bays(1180, -245, 25, 30, 0, 3);
      flat(m.paving, 1198, -262, 3, 36, 0, 0.03);
    }
  }

  private prop(g: THREE.Group, p: PlacedProp, M: Record<string, unknown>): void {
    const mesh = M.mesh as (g: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, yaw?: number) => THREE.Mesh;
    const plane = M.plane as (g: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, yaw?: number) => THREE.Mesh;
    const blob = M.blob as (g: THREE.Group, material: THREE.Material, x: number, y: number, z: number, r: number) => THREE.Mesh;
    const box = M.box as THREE.BoxGeometry;
    const plaster = M.plaster as THREE.Material, plaster2 = M.plaster2 as THREE.Material, stone = M.stone as THREE.Material;
    const foliage = M.foliage as THREE.Material, foliage2 = M.foliage2 as THREE.Material, wood = M.wood as THREE.Material;
    const dark = M.dark as THREE.Material, metal = M.metal as THREE.Material, glass = M.glass as THREE.Material;
    const water = M.water as THREE.Material, white = M.white as THREE.Material;
    void box;
    switch (p.kind) {
      case 'shop': { const shop = shopById((p as unknown as { shopId: string }).shopId); if (shop) this.shop(g, p, shop, { plaster, plaster2, stone, wood, dark, metal, glass, white, mesh, plane }); break; }
      case 'counter': mesh(g, wood, p.x, 0.5, p.z, p.w, 1, p.d, p.yaw); mesh(g, stone, p.x, 1.02, p.z, p.w + 0.1, 0.08, p.d + 0.1, p.yaw); break;
      case 'bench': {
        const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) };
        mesh(g, wood, p.x, 0.45, p.z, 1.8, 0.12, 0.5, p.yaw);
        mesh(g, wood, p.x - f.x * 0.28, 0.82, p.z - f.z * 0.28, 1.8, 0.55, 0.1, p.yaw);
        for (const s of [-0.75, 0.75]) mesh(g, dark, p.x + Math.cos(p.yaw) * s, 0.22, p.z - Math.sin(p.yaw) * s, 0.08, 0.45, 0.5, p.yaw);
        break;
      }
      case 'bed': {
        mesh(g, new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 }), p.x, 0.22, p.z, p.w, 0.45, p.d, p.yaw);
        for (let i = 0; i < 5; i++) blob(g, i % 2 ? foliage : foliage2, p.x + (i - 2) * p.w / 6, 0.6, p.z + ((i % 2) - 0.5) * p.d / 2, 0.5 + (i % 3) * 0.12);
        break;
      }
      case 'bin': { const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.75, 10), new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 0.8 })); cyl.position.set(p.x, 0.38, p.z); g.add(cyl); break; }
      case 'tree': {
        const s = parseFloat(p.label ?? '1');
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 2.4 * s, 7), wood); trunk.position.set(p.x, 1.2 * s, p.z); g.add(trunk);
        blob(g, foliage, p.x, 2.9 * s, p.z, 1.7 * s); blob(g, foliage2, p.x + 0.7 * s, 2.4 * s, p.z + 0.4 * s, 1.1 * s); blob(g, foliage2, p.x - 0.6 * s, 2.5 * s, p.z - 0.5 * s, 1 * s);
        break;
      }
      case 'sign': {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6), metal); post.position.set(p.x, 1.6, p.z); g.add(post);
        const board = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: signTexture(p.label ?? '', undefined, '#234036'), side: THREE.DoubleSide }));
        board.position.set(p.x, 2.7, p.z); board.scale.set(4.2, 1.15, 1); board.rotation.y = p.yaw; g.add(board);
        break;
      }
      case 'railing': {
        for (let i = 0; i <= 10; i++) mesh(g, metal, p.x, 0.55, p.z + (i - 5) * 2, 0.08, 1.1, 0.08, p.yaw);
        mesh(g, metal, p.x, 1.08, p.z, 0.1, 0.08, p.d, p.yaw); mesh(g, metal, p.x, 0.6, p.z, 0.08, 0.06, p.d, p.yaw);
        break;
      }
      case 'fountain': {
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.3, 0.8, 18), stone); basin.position.set(p.x, 0.4, p.z); g.add(basin);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(1.95, 18), water); disc.rotation.x = -Math.PI / 2; disc.position.set(p.x, 0.82, p.z); g.add(disc);
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.1, 10), stone); col.position.set(p.x, 1.3, p.z); g.add(col);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.25, 12), stone); top.position.set(p.x, 1.9, p.z); g.add(top);
        const topWater = new THREE.Mesh(new THREE.CircleGeometry(0.7, 12), water); topWater.rotation.x = -Math.PI / 2; topWater.position.set(p.x, 2.04, p.z); g.add(topWater);
        break;
      }
      case 'board': {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), wood); post.position.set(p.x, 1.1, p.z); g.add(post);
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: signTexture('PARK CIRCUIT', 'पार्क सर्किट · 4 stops'), side: THREE.DoubleSide }));
        panel.position.set(p.x, 1.7, p.z); panel.scale.set(2, 1.3, 1); panel.rotation.y = p.yaw; g.add(panel);
        break;
      }
      case 'frame': {
        const perp = { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) };
        for (const o of [-1.4, 1.4]) mesh(g, wood, p.x + perp.x * o, 1.2, p.z + perp.z * o, 0.14, 2.4, 0.14);
        mesh(g, wood, p.x, 2.42, p.z, 0.14, 0.14, 3, p.yaw);
        const tag = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: signTexture('PHOTO STOP', 'फोटो स्टॉप'), side: THREE.DoubleSide }));
        tag.position.set(p.x, 2.05, p.z); tag.scale.set(1.4, 0.45, 1); tag.rotation.y = p.yaw; g.add(tag);
        break;
      }
      case 'exercise': {
        for (const o of [-1.4, 1.4]) mesh(g, metal, p.x + o, 1.1, p.z, 0.12, 2.2, 0.12);
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 8), metal); bar.rotation.z = Math.PI / 2; bar.position.set(p.x, 2.2, p.z); g.add(bar);
        mesh(g, wood, p.x, 0.25, p.z + 1.2, 1.6, 0.18, 0.5);
        break;
      }
      case 'planter': mesh(g, stone, p.x, 0.3, p.z, p.w, 0.6, p.d, p.yaw); blob(g, foliage, p.x - 0.5, 0.85, p.z, 0.55); blob(g, foliage2, p.x + 0.5, 0.85, p.z, 0.5); break;
      case 'parasol': {
        // Café shade over the benches: slim pole (the only solid), canvas
        // cone, and a small round table beneath.
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), metal); pole.position.set(p.x, 1.3, p.z); g.add(pole);
        const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.55, 10), new THREE.MeshStandardMaterial({ color: 0xc96a3a, roughness: 0.9, side: THREE.DoubleSide })); canopy.position.set(p.x, 2.62, p.z); g.add(canopy);
        const table = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 10), white); table.position.set(p.x + 0.85, 0.74, p.z); g.add(table);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.74, 6), dark); leg.position.set(p.x + 0.85, 0.37, p.z); g.add(leg);
        break;
      }
      case 'water': mesh(g, metal, p.x, 0.55, p.z, 0.18, 1.1, 0.18); mesh(g, stone, p.x, 0.1, p.z, 0.6, 0.2, 0.6); break;
    }
  }

  private shop(g: THREE.Group, p: PlacedProp, shop: ClusterShop, M: { plaster: THREE.Material; plaster2: THREE.Material; stone: THREE.Material; wood: THREE.Material; dark: THREE.Material; metal: THREE.Material; glass: THREE.Material; white: THREE.Material; mesh: (g: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, yaw?: number) => THREE.Mesh; plane: (g: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, yaw?: number) => THREE.Mesh }): void {
    const sg = new THREE.Group(); sg.position.set(p.x, 0, p.z); sg.rotation.y = p.yaw; g.add(sg);
    const accent = new THREE.MeshStandardMaterial({ color: KIND_ACCENT[shop.kind] ?? 0x333333, roughness: 0.85 });
    M.mesh(sg, M.plaster, 0, p.h / 2, 0, p.w, p.h, p.d);
    M.mesh(sg, accent, 0, p.h - 0.35, p.d / 2 + 0.03, p.w, 0.7, 0.06);
    M.mesh(sg, M.plaster2, 0, 0.25, p.d / 2 + 0.02, p.w, 0.5, 0.05);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: signTexture(shopLabel(shop), shop.hindi, KIND_SIGN_BG[shop.kind] ?? '#234036') }));
    sign.position.set(0, p.h - 1.1, p.d / 2 + 0.06); sign.scale.set(Math.min(p.w * 0.72, 9), 1.5, 1); sg.add(sign);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shopWindowTexture() }));
    win.position.set(-p.w / 4, 1.7, p.d / 2 + 0.05); win.scale.set(p.w * 0.32, 2, 1); sg.add(win);
    const win2 = win.clone(); win2.position.x = p.w / 4; sg.add(win2);
    M.mesh(sg, M.dark, 0, 1.3, p.d / 2 + 0.03, 2.2, 2.6, 0.08);
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: KIND_ACCENT[shop.kind] ?? 0x333333, roughness: 0.9, side: THREE.DoubleSide }));
    awning.position.set(0, p.h - 0.75, p.d / 2 + 0.6); awning.scale.set(p.w * 0.9, 1.3, 1); awning.rotation.x = -Math.PI / 3.5; sg.add(awning);
    this.display(sg, shop, p, M);
  }

  private display(sg: THREE.Group, shop: ClusterShop, p: PlacedProp, M: { wood: THREE.Material; dark: THREE.Material; metal: THREE.Material; glass: THREE.Material; white: THREE.Material; mesh: (g: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, yaw?: number) => THREE.Mesh }): void {
    const z = p.d / 2 + 1.1;
    const mannequin = (x: number, colour: number) => {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.1, 8), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.8 }));
      body.position.set(x, 0.75, z); sg.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), M.white); head.position.set(x, 1.45, z); sg.add(head);
    };
    switch (shop.kind) {
      case 'fashion': mannequin(-3, 0xc9a03a); mannequin(3, 0x4a6b8a);
        M.mesh(sg, M.metal, 0, 1.5, z, 2.4, 0.06, 0.06);
        for (const o of [-1, 1]) M.mesh(sg, M.metal, o * 1.1, 0.75, z, 0.05, 1.5, 0.05);
        for (let i = 0; i < 3; i++) M.mesh(sg, new THREE.MeshStandardMaterial({ color: [0x8a5a3a, 0x4a6b4a, 0xc9a03a][i], roughness: 0.9 }), -0.8 + i * 0.8, 1.2, z, 0.4, 0.55, 0.08);
        break;
      case 'streetwear':
        for (let i = 0; i < 3; i++) M.mesh(sg, new THREE.MeshStandardMaterial({ color: [0xd94a2e, 0x2e6b4a, 0x2e4a8a][i], roughness: 0.85 }), -2.4 + i * 2.4, 1, z, 1.4, 1.5, 0.1);
        M.mesh(sg, M.metal, 0, 1.4, z + 0.3, 2, 0.05, 0.05);
        break;
      case 'flowers': {
        const bucket = (x: number, colour: number) => {
          const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.7 })); b.position.set(x, 0.25, z); sg.add(b);
          const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9 })); bloom.position.set(x, 0.75, z); sg.add(bloom);
        };
        bucket(-2.4, 0xd0608a); bucket(-0.8, 0xe0a03a); bucket(0.8, 0xc94a2e); bucket(2.4, 0xe8e2d2);
        M.mesh(sg, new THREE.MeshStandardMaterial({ color: 0xc9a03a, roughness: 0.8 }), -1.6, 0.25, z + 0.4, 0.6, 0.5, 0.6);
        M.mesh(sg, new THREE.MeshStandardMaterial({ color: 0x4a6b8a, roughness: 0.8 }), 1.6, 0.25, z + 0.4, 0.6, 0.5, 0.6);
        break;
      }
      case 'sweets':
        M.mesh(sg, M.glass, 0, 0.7, z, 2.6, 0.9, 0.8);
        for (let i = 0; i < 3; i++) M.mesh(sg, new THREE.MeshStandardMaterial({ color: [0xe0a03a, 0xd94a2e, 0xc9b181][i], roughness: 0.7 }), -0.8 + i * 0.8, 0.45, z, 0.5, 0.25, 0.5);
        M.mesh(sg, new THREE.MeshStandardMaterial({ color: 0xc9a03a, roughness: 0.8 }), 2, 0.2, z + 0.3, 0.8, 0.4, 0.6);
        break;
      case 'bakery': {
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10), M.white); stand.position.set(-1, 0.45, z); sg.add(stand);
        const cake = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.7 })); cake.position.set(-1, 1.05, z); sg.add(cake);
        M.mesh(sg, M.glass, -1, 1.25, z, 0.9, 0.7, 0.9);
        M.mesh(sg, M.dark, 1.6, 1.2, z, 1.1, 1.4, 0.08);
        break;
      }
      case 'cafe':
        for (const x of [-1.6, 1.6]) {
          const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 10), M.white); top.position.set(x, 0.75, z); sg.add(top);
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 6), M.dark); leg.position.set(x, 0.38, z); sg.add(leg);
          const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0xd97e2e, roughness: 0.7 })); cup.position.set(x + 0.15, 0.83, z); sg.add(cup);
        }
        break;
    }
  }

  update(focus: Point): void { for (const c of this.chunks) c.group.visible = Math.hypot(c.point.x - focus.x, c.point.z - focus.z) < c.radius + 260; }
}
