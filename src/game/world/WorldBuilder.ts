import * as THREE from 'three';
import { GAME_CONFIG } from '../config';
import { POINTS_OF_INTEREST, ROAD_SEGMENTS, ROAD_WAYPOINTS } from './MapData';

export interface WorldObjects {
  group: THREE.Group;
  tollBarriers: THREE.Object3D[];
  metroTrainGroup: THREE.Group;
  update(dt: number, playerZ: number): void;
}

export class WorldBuilder {
  private static roadTexture: THREE.CanvasTexture | null = null;
  private static cyberGlassTexture: THREE.CanvasTexture | null = null;
  private static concreteTexture: THREE.CanvasTexture | null = null;

  // Ultra-realistic Asphalt Canvas Texture with Painted Lanes, Zebra Crossings, and Tar Patches
  public static getRoadTexture(): THREE.CanvasTexture {
    if (this.roadTexture) return this.roadTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d')!;

    // Rich dark slate asphalt base
    ctx.fillStyle = '#262930';
    ctx.fillRect(0, 0, 1024, 2048);

    // Fine gravel noise
    for (let i = 0; i < 15000; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 2048;
      const s = Math.floor(28 + Math.random() * 25);
      ctx.fillStyle = `rgb(${s}, ${s + 2}, ${s + 5})`;
      ctx.fillRect(x, y, 2.5, 2.5);
    }

    // Occasional tar crack & road repair patch
    ctx.strokeStyle = '#181a1f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(250, 400);
    ctx.lineTo(290, 460);
    ctx.lineTo(270, 580);
    ctx.stroke();

    // Road repair rectangular patch
    ctx.fillStyle = '#1c1e24';
    ctx.fillRect(620, 950, 180, 240);

    // Solid bright yellow shoulder lane lines
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(55, 0, 18, 2048);
    ctx.fillRect(1024 - 73, 0, 18, 2048);

    // Dashed white highway lane dividers (3 lanes each way)
    ctx.fillStyle = '#f8fafc';
    const dashLength = 220;
    const dashGap = 160;
    const period = dashLength + dashGap;

    for (let y = 0; y < 2048; y += period) {
      // Left lane divider
      ctx.fillRect(350, y, 14, dashLength);
      // Right lane divider
      ctx.fillRect(660, y, 14, dashLength);
    }

    // Directional forward arrows painted on road
    const drawRoadArrow = (cx: number, cy: number) => {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 80);
      ctx.lineTo(cx + 35, cy - 20);
      ctx.lineTo(cx + 15, cy - 20);
      ctx.lineTo(cx + 15, cy + 60);
      ctx.lineTo(cx - 15, cy + 60);
      ctx.lineTo(cx - 15, cy - 20);
      ctx.lineTo(cx - 35, cy - 20);
      ctx.closePath();
      ctx.fill();
    };

    drawRoadArrow(350, 800);
    drawRoadArrow(660, 1600);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 16);
    this.roadTexture = tex;
    return tex;
  }

  // High-Resolution NHAI Green Overhead Gantry Signboards
  public static getHighwaySignTexture(
    route: string,
    dest1: string,
    dist1: string,
    dest2: string,
    dist2: string,
    arrowDir: 'left' | 'right' | 'straight' = 'straight'
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;

    // NHAI Green background
    ctx.fillStyle = '#166534';
    ctx.fillRect(0, 0, 640, 240);

    // White reflective border
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 620, 220);

    // Highway Route Badge (e.g. NH-48)
    ctx.fillStyle = '#facc15';
    ctx.fillRect(26, 24, 150, 42);
    ctx.fillStyle = '#090a0f';
    ctx.font = 'bold 26px "Chakra Petch", sans-serif';
    ctx.fillText(route, 38, 54);

    // Destination Lines
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Chakra Petch", sans-serif';
    ctx.fillText(dest1, 30, 118);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 28px "Chakra Petch", sans-serif';
    ctx.fillText(dest2, 30, 172);

    // Distances
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Chakra Petch", sans-serif';
    ctx.fillText(dist1, 420, 118);
    ctx.fillText(dist2, 420, 172);

    // Directional Arrow
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px sans-serif';
    const arrow = arrowDir === 'left' ? '⬅' : arrowDir === 'right' ? '➡' : '⬆';
    ctx.fillText(arrow, 540, 145);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  // Realistic Blue-Reflective Cyber City Glass Curtain Facade
  public static getCyberGlassTexture(): THREE.CanvasTexture {
    if (this.cyberGlassTexture) return this.cyberGlassTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0369a1');
    grad.addColorStop(0.4, '#0284c7');
    grad.addColorStop(0.8, '#0c4a6e');
    grad.addColorStop(1, '#082f49');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // High-tech architectural mullions
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2.5;
    for (let x = 0; x <= 512; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Illuminated office windows
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 16; c++) {
        if (Math.random() > 0.6) {
          ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
          ctx.fillRect(c * 32 + 4, r * 48 + 4, 24, 40);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 6);
    this.cyberGlassTexture = tex;
    return tex;
  }

  public static buildWorld(): WorldObjects {
    const worldGroup = new THREE.Group();

    // 1. Natural Terrain Ground
    const groundGeo = new THREE.PlaneGeometry(1800, 4200, 32, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x273022,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.06, 300);
    ground.receiveShadow = true;
    worldGroup.add(ground);

    // 2. High-Fidelity Roads with Painted Markings
    const roadTex = this.getRoadTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: roadTex,
      roughness: 0.72,
      metalness: 0.15,
    });

    const yellowKerbMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
    const steelGuardrailMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.25 });

    for (const seg of ROAD_SEGMENTS) {
      const dx = seg.end.x - seg.start.x;
      const dy = seg.end.y - seg.start.y;
      const dz = seg.end.z - seg.start.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dx, dz);

      const midX = (seg.start.x + seg.end.x) / 2;
      const midY = (seg.start.y + seg.end.y) / 2;
      const midZ = (seg.start.z + seg.end.z) / 2;

      // Paved asphalt surface
      const roadGeo = new THREE.BoxGeometry(seg.width, 0.16, length);
      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.position.set(midX, midY + 0.06, midZ);
      roadMesh.rotation.y = angle;
      roadMesh.rotation.x = -Math.atan2(dy, length);
      roadMesh.receiveShadow = true;
      worldGroup.add(roadMesh);

      // Median & Steel Guardrails
      if (seg.width >= 16) {
        // Concrete Jersey Barrier in Center Median
        const jerseyGeo = new THREE.BoxGeometry(1.2, 0.75, length);
        const jerseyMesh = new THREE.Mesh(jerseyGeo, concreteMat);
        jerseyMesh.position.set(midX, midY + 0.38, midZ);
        jerseyMesh.rotation.y = angle;
        jerseyMesh.rotation.x = -Math.atan2(dy, length);
        jerseyMesh.castShadow = true;
        worldGroup.add(jerseyMesh);

        // Center Green Bougainvillea / Hedge atop Median
        const hedgeGeo = new THREE.BoxGeometry(0.8, 0.45, length);
        const hedgeMesh = new THREE.Mesh(hedgeGeo, new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 }));
        hedgeMesh.position.set(midX, midY + 0.85, midZ);
        hedgeMesh.rotation.y = angle;
        hedgeMesh.rotation.x = -Math.atan2(dy, length);
        worldGroup.add(hedgeMesh);

        // Outer Curbs (Yellow/Black painted)
        const curbW = 0.55;
        const curbH = 0.28;
        const leftCurb = new THREE.Mesh(new THREE.BoxGeometry(curbW, curbH, length), yellowKerbMat);
        leftCurb.position.set(midX - Math.cos(angle) * (seg.width / 2 + curbW / 2), midY + 0.16, midZ + Math.sin(angle) * (seg.width / 2 + curbW / 2));
        leftCurb.rotation.y = angle;
        worldGroup.add(leftCurb);

        const rightCurb = new THREE.Mesh(new THREE.BoxGeometry(curbW, curbH, length), yellowKerbMat);
        rightCurb.position.set(midX + Math.cos(angle) * (seg.width / 2 + curbW / 2), midY + 0.16, midZ - Math.sin(angle) * (seg.width / 2 + curbW / 2));
        rightCurb.rotation.y = angle;
        worldGroup.add(rightCurb);

        // Steel W-Beam Crash Barriers on outer roadside
        for (const side of [-1, 1]) {
          const railGeo = new THREE.BoxGeometry(0.12, 0.45, length);
          const railMesh = new THREE.Mesh(railGeo, steelGuardrailMat);
          const offsetDist = seg.width / 2 + 0.85;
          railMesh.position.set(midX + side * Math.cos(angle) * offsetDist, midY + 0.55, midZ - side * Math.sin(angle) * offsetDist);
          railMesh.rotation.y = angle;
          worldGroup.add(railMesh);
        }
      }

      // Flyover Pillars if bridge segment
      if (seg.start.isBridge || seg.end.isBridge) {
        for (let bz = -length / 2; bz <= length / 2; bz += 40) {
          const pier = new THREE.Mesh(new THREE.BoxGeometry(3.5, 8.5, 3.5), concreteMat);
          pier.position.set(midX, 4.0, midZ + bz);
          pier.castShadow = true;
          worldGroup.add(pier);
        }
      }
    }

    // 3. India Gate Monument (Sandstone Grand Archway at 0, 0, -1100)
    const indiaGateGroup = new THREE.Group();
    indiaGateGroup.position.set(0, 0, -1100);

    const sandstoneMat = new THREE.MeshStandardMaterial({
      color: 0xc86432,
      roughness: 0.82,
      metalness: 0.1,
    });

    // Pylons
    const leftPylon = new THREE.Mesh(new THREE.BoxGeometry(9, 44, 14), sandstoneMat);
    leftPylon.position.set(-12, 22, 0);
    leftPylon.castShadow = true;
    indiaGateGroup.add(leftPylon);

    const rightPylon = new THREE.Mesh(new THREE.BoxGeometry(9, 44, 14), sandstoneMat);
    rightPylon.position.set(12, 22, 0);
    rightPylon.castShadow = true;
    indiaGateGroup.add(rightPylon);

    // Lintel Archway
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(36, 15, 16), sandstoneMat);
    archTop.position.set(0, 44, 0);
    archTop.castShadow = true;
    indiaGateGroup.add(archTop);

    // Amar Jawan Jyoti Memorial with Glowing Flame
    const flameBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 1.4, 16), new THREE.MeshStandardMaterial({ color: 0x090a0f, roughness: 0.5 }));
    flameBase.position.set(0, 0.7, 0);
    indiaGateGroup.add(flameBase);

    const flameMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffedd5 })
    );
    flameMesh.position.set(0, 1.8, 0);
    indiaGateGroup.add(flameMesh);

    // Flagpole with Indian Flag
    const flagpole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 14, 8), steelGuardrailMat);
    flagpole.position.set(0, 58, 0);
    indiaGateGroup.add(flagpole);

    const flagMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 3.2),
      new THREE.MeshBasicMaterial({ color: 0xff9933, side: THREE.DoubleSide })
    );
    flagMesh.position.set(2.4, 60, 0);
    indiaGateGroup.add(flagMesh);

    worldGroup.add(indiaGateGroup);

    // 4. Delhi Metro Elevated Viaduct & Animated High-Speed Train
    const metroGroup = new THREE.Group();
    for (let z = -950; z <= 850; z += 48) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(2.6, 11, 2.6), concreteMat);
      pier.position.set(35, 5.5, z);
      pier.castShadow = true;
      metroGroup.add(pier);

      const crossbeam = new THREE.Mesh(new THREE.BoxGeometry(9, 2.0, 4.5), concreteMat);
      crossbeam.position.set(35, 11, z);
      metroGroup.add(crossbeam);
    }

    const trackSlab = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.9, 1900), concreteMat);
    trackSlab.position.set(35, 11.8, -50);
    metroGroup.add(trackSlab);

    // Modern 4-Coach Delhi Metro Train (Silver & Blue)
    const metroTrainGroup = new THREE.Group();
    const trainMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.85, roughness: 0.2 });
    const blueLineMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.3 });

    for (let c = 0; c < 4; c++) {
      const coach = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.5, 21), trainMat);
      coach.position.set(35, 14.2, c * 23);
      coach.castShadow = true;
      metroTrainGroup.add(coach);

      const blueStripe = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.65, 21), blueLineMat);
      blueStripe.position.set(35, 13.8, c * 23);
      metroTrainGroup.add(blueStripe);
    }
    metroGroup.add(metroTrainGroup);
    worldGroup.add(metroGroup);

    // 5. Kherki Daula FASTag Toll Plaza (Z: 150)
    const tollGroup = new THREE.Group();
    tollGroup.position.set(0, 0, 150);

    // Canopy Roof
    const canopyRoof = new THREE.Mesh(
      new THREE.BoxGeometry(38, 1.5, 15),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.65, roughness: 0.35 })
    );
    canopyRoof.position.set(0, 7.0, 0);
    tollGroup.add(canopyRoof);

    // FASTag Illuminated overhead banner
    const fastagMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      emissive: 0x14532d,
      roughness: 0.35,
    });
    const fastagBanner = new THREE.Mesh(new THREE.BoxGeometry(32, 1.6, 0.2), fastagMat);
    fastagBanner.position.set(0, 7.0, -7.6);
    tollGroup.add(fastagBanner);

    const tollBarriers: THREE.Object3D[] = [];
    const boothMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const barrierMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    for (let i = -2; i <= 2; i++) {
      const bx = i * 7.2;
      const booth = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.5, 5.2), boothMat);
      booth.position.set(bx, 1.75, 0);
      tollGroup.add(booth);

      // Automated Toll Barrier Arm
      const barrierArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.2, 8), barrierMat);
      barrierArm.rotation.z = Math.PI / 2;
      barrierArm.position.set(bx + 2.9, 1.15, -2.2);
      tollGroup.add(barrierArm);
      tollBarriers.push(barrierArm);
    }
    worldGroup.add(tollGroup);

    // 6. Overhead Highway Gantries with Real Signboards
    const gantryConfigs = [
      { z: -150, r: 'NH-48', d1: 'GURUGRAM / CYBER CITY', km1: '12 KM', d2: 'JAIPUR EXPRESSWAY', km2: '235 KM', dir: 'straight' as const },
      { z: 320, r: 'EXIT 14', d1: 'CYBER HUB / DLF PHASE 2', km1: '1.5 KM', d2: 'MG ROAD MALLS', km2: '3 KM', dir: 'right' as const },
      { z: 650, r: 'NH-48', d1: 'MANESAR / KMP EXPWY', km1: '18 KM', d2: 'OLD RAO DHABA', km2: '14 KM', dir: 'straight' as const },
      { z: 1250, r: 'REVERSE', d1: 'DELHI / IGI AIRPORT T3', km1: '22 KM', d2: 'CONNAUGHT PLACE', km2: '28 KM', dir: 'left' as const },
    ];

    for (const gc of gantryConfigs) {
      const gGroup = new THREE.Group();
      gGroup.position.set(0, 0, gc.z);

      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 10, 0.65), steelGuardrailMat);
      p1.position.set(-14.5, 5.0, 0);
      gGroup.add(p1);

      const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 10, 0.65), steelGuardrailMat);
      p2.position.set(14.5, 5.0, 0);
      gGroup.add(p2);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(29.6, 0.8, 0.8), steelGuardrailMat);
      beam.position.set(0, 9.8, 0);
      gGroup.add(beam);

      const signTex = this.getHighwaySignTexture(gc.r, gc.d1, gc.km1, gc.d2, gc.km2, gc.dir);
      const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4 });
      const signMesh = new THREE.Mesh(new THREE.BoxGeometry(12.5, 3.8, 0.15), signMat);
      signMesh.position.set(0, 9.0, 0);
      gGroup.add(signMesh);

      worldGroup.add(gGroup);
    }

    // 7. Cyber Hub Glass Skyscrapers (Gurgaon Z: 650 to 1200)
    const cyberGlass = this.getCyberGlassTexture();
    const glassMat = new THREE.MeshPhysicalMaterial({
      map: cyberGlass,
      metalness: 0.88,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });

    const towerConfigs = [
      { x: 95, z: 720, w: 46, d: 42, h: 130 },
      { x: 175, z: 820, w: 58, d: 52, h: 165 },
      { x: 120, z: 960, w: 52, d: 45, h: 115 },
      { x: -115, z: 780, w: 44, d: 46, h: 95 },
      { x: -170, z: 920, w: 68, d: 60, h: 85 }, // Ambience Mall
      { x: -125, z: 1080, w: 54, d: 46, h: 120 },
    ];

    for (const t of towerConfigs) {
      const geo = new THREE.BoxGeometry(t.w, t.h, t.d);
      const mesh = new THREE.Mesh(geo, glassMat);
      mesh.position.set(t.x, t.h / 2, t.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      worldGroup.add(mesh);
    }

    // 8. Haryana Outskirts & Old Rao Punjabi Dhaba (Z: 1550)
    const dhabaGroup = new THREE.Group();
    dhabaGroup.position.set(100, 0, 1550);

    const thatchedMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 });
    const hut = new THREE.Mesh(new THREE.ConeGeometry(15, 7.5, 8), thatchedMat);
    hut.position.set(0, 5.8, 0);
    dhabaGroup.add(hut);

    // Glowing Neon Dhaba Signboard
    const neonDhabaMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });
    const neonBoard = new THREE.Mesh(new THREE.BoxGeometry(19, 3.2, 0.4), neonDhabaMat);
    neonBoard.position.set(0, 10.5, -6.5);
    dhabaGroup.add(neonBoard);

    // Rustic Charpais (Cots)
    const charpaiMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 });
    for (let c = -2; c <= 2; c++) {
      const cot = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 1.2), charpaiMat);
      cot.position.set(c * 3.5, 0.3, -12);
      dhabaGroup.add(cot);
    }

    worldGroup.add(dhabaGroup);

    // 9. Mustard Fields in Haryana (Vibrant Golden-Yellow patches)
    const mustardMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.9 });
    for (let mz = 1400; mz <= 1850; mz += 140) {
      const field1 = new THREE.Mesh(new THREE.BoxGeometry(150, 0.2, 100), mustardMat);
      field1.position.set(-150, 0.12, mz);
      worldGroup.add(field1);

      const field2 = new THREE.Mesh(new THREE.BoxGeometry(150, 0.2, 100), mustardMat);
      field2.position.set(165, 0.12, mz);
      worldGroup.add(field2);
    }

    // 10. Streetlights with Double-Arm Curved Brackets
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.25 });
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffedd5,
      emissiveIntensity: 2.8,
    });

    for (let sz = -1200; sz <= 1900; sz += 55) {
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 10, 8), poleMat);
        const sx = side * 15.5;
        pole.position.set(sx, 5.0, sz);
        worldGroup.add(pole);

        const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.24, 0.5), poleMat);
        head.position.set(sx - side * 0.7, 10, sz);
        worldGroup.add(head);

        const bulb = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.38), bulbMat);
        bulb.position.set(sx - side * 0.7, 9.85, sz);
        worldGroup.add(bulb);
      }
    }

    // 11. Roadside Neem & Gulmohar Trees
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const foliageGreen = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });
    const foliageGulmohar = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.85 }); // Red Gulmohar flowers

    for (let tz = -1150; tz <= 1850; tz += 32) {
      const isRight = (tz % 64 === 0);
      const tx = (isRight ? 1 : -1) * (19 + Math.abs((tz * 17) % 7));
      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 5, 8), trunkMat);
      trunk.position.y = 2.5;
      trunk.castShadow = true;
      tree.add(trunk);

      const foliageMat = (tz % 96 === 0) ? foliageGulmohar : foliageGreen;
      const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(2.8, 1), foliageMat);
      foliage.position.y = 5.8;
      foliage.castShadow = true;
      tree.add(foliage);

      worldGroup.add(tree);
    }

    // Metro Train Animation loop
    let metroZ = -950;

    const update = (dt: number, playerZ: number) => {
      metroZ += 35.0 * dt;
      if (metroZ > 850) metroZ = -950;
      metroTrainGroup.position.z = metroZ;

      // FASTag barrier arm opens smoothly
      const distToToll = Math.abs(playerZ - 150);
      const isNearToll = distToToll < 24;

      for (const arm of tollBarriers) {
        const targetRotZ = isNearToll ? Math.PI * 0.15 : Math.PI / 2;
        arm.rotation.z = THREE.MathUtils.lerp(arm.rotation.z, targetRotZ, 8 * dt);
      }
    };

    return {
      group: worldGroup,
      tollBarriers,
      metroTrainGroup,
      update,
    };
  }
}
