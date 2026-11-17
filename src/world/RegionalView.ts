import * as THREE from 'three';
import { roads, ends, destinations, worldBarriers, riverBanks, motorPoolBays, buildingSpotClear, medianTrees, CP_EXIT_ROAD_IDS } from './WorldRoads';
import type { Road } from './WorldRoads';
import { YAMUNA_RIVER, JUNCTIONS, CITY_ANCHORS, ARAVALLI_RIDGE, roadById } from './RealNcrRoads';
import { pointInPolygon, distanceToPolyline } from './NcrLandmarks';
import { Vegetation } from './Vegetation';
import type { Point } from '../core/math';
import { QUALITY } from '../rendering/QualityProfile';
import type { QualityPreset } from '../rendering/QualityProfile';
import { signTexture, worldSurfaceMaterial } from '../rendering/ProceduralTextures';

/* ── Phase 3 — per-region ground tint ────────────────────────────────────
 * One shared classification, used by RegionalView's verge strips and by
 * DistrictView's painted ground texture, so the two ground layers agree:
 * dusty ochre in the Aravalli south-west, lush green along the Yamuna
 * banks, grey around the 8 city anchors, field green everywhere else.
 * Ground tint ONLY — no dust, haze or wet-road effects here (Phase 6). */
export type GroundRegion = 'dusty' | 'river' | 'urban' | 'rural';
export const GROUND_REGION_COLORS: Record<GroundRegion, number> = {
  dusty: 0x9a8a68,
  river: 0x5f7a4e,
  urban: 0x8a8a8a,
  rural: 0x788263,
};
export function groundRegionAt(x: number, z: number): GroundRegion {
  // Green banks: the river corridor out to 260 m from the centreline
  // (water spans ±80 m, bank rails at ±100 m, sandbars inside).
  if (distanceToPolyline(x, z, YAMUNA_RIVER) < 260) return 'river';
  // Dusty south-west: inside the Aravalli ridge polygon.
  if (pointInPolygon(x, z, ARAVALLI_RIDGE.polygon)) return 'dusty';
  // Grey urban: within 580 m of a city anchor (DistrictView's gradient radius).
  for (const city of CITY_ANCHORS) if (Math.hypot(x - city.x, z - city.z) < 580) return 'urban';
  return 'rural';
}

/** Real (non-CP) roads as drawn: one per undirected stretch, so concurrent
 *  roads (NH-44/NH-19 south of Ashram, NH-9/NE-3 east of Akshardham) are
 *  drawn once instead of z-fighting. */
export function drawnRealRoads(): Road[] {
  const drawn = new Set<string>();
  const out: Road[] = [];
  for (const r of roads.filter((r) => !r.id.startsWith('cp-'))) {
    const key = [r.from, r.to].sort().join('→');
    if (drawn.has(key)) continue;
    drawn.add(key);
    out.push(r);
  }
  return out;
}

/** Lane-divider offsets (metres from the centreline) for a road of `width`
 *  with `lanes` total lanes. Dividers within 1 m of the driven lane centre
 *  (±4 m, see WorldRoads lanes) are dropped — paint must not sit under the
 *  cars. E.g. 6-lane width 30 → ±5, ±10; 4-lane width 20 → ±5; 6-lane width
 *  24 → ±8 only (the ±4 divider would sit on the driven lane centre). */
export function laneDividerOffsets(width: number, lanes: number): number[] {
  const half = lanes / 2;
  const offsets: number[] = [];
  for (let k = 1; k < half; k++) {
    const off = (width / 2) * (k / half);
    if (Math.abs(Math.abs(off) - 4) < 1) continue;
    offsets.push(-off, off);
  }
  return offsets.sort((a, b) => a - b);
}

export interface MedianTreePlacement { x: number; z: number; }

/** Median trees grouped by the drawn road that renders them. Every
 *  medianTree solid is claimed exactly once: concurrent stretches share one
 *  drawn road, so the duplicate trees on them land on that road's chunk. */
export function medianTreesByRoad(): Map<string, MedianTreePlacement[]> {
  const byRoad = new Map<string, MedianTreePlacement[]>();
  const claimed = new Set<number>();
  for (const r of drawnRealRoads()) {
    const [a, b] = ends(r);
    const dx = b.x - a.x, dz = b.z - a.z, lenSq = dx * dx + dz * dz || 1;
    const list: MedianTreePlacement[] = [];
    medianTrees.forEach((t, i) => {
      if (claimed.has(i)) return;
      const tt = ((t.x - a.x) * dx + (t.z - a.z) * dz) / lenSq;
      if (tt <= 0 || tt >= 1) return;
      const px = a.x + dx * tt, pz = a.z + dz * tt;
      if (Math.hypot(t.x - px, t.z - pz) > 2) return;
      claimed.add(i);
      list.push({ x: t.x, z: t.z });
    });
    if (list.length) byRoad.set(r.id, list);
  }
  return byRoad;
}

export interface StopLinePlacement { roadId: string; end: 'from' | 'to'; x: number; z: number; lateral: number; }

/** One stop line per approach to a named junction: 8 m back from the node,
 *  centred on the approach half-carriageway (left-hand traffic, so the
 *  approach side is +width/4 on the a→b heading at a 'to' end and −width/4
 *  at a 'from' end). The three Connaught Place exits count as approaches to
 *  junction 'cp', whose legs end on Inner Circle ring nodes (cp-<number>);
 *  cp-north/cp-south are ordinary nodes, not ring nodes, and get none. */
export function stopLinePlacements(): StopLinePlacement[] {
  const named = new Set(JUNCTIONS.map((j) => j.nodeId));
  const out: StopLinePlacement[] = [];
  for (const r of drawnRealRoads()) {
    const [a, b] = ends(r);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    // Lateral unit vector, left of the a→b heading: (dz, −dx).
    const lx = dz, lz = -dx;
    for (const end of ['from', 'to'] as const) {
      const nodeId = end === 'from' ? r.from : r.to;
      const isNamed = named.has(nodeId);
      const isCpExit = CP_EXIT_ROAD_IDS.includes(r.id) && /^cp-\d+$/.test(nodeId);
      if (!isNamed && !isCpExit) continue;
      const px = end === 'to' ? b.x - dx * 8 : a.x + dx * 8;
      const pz = end === 'to' ? b.z - dz * 8 : a.z + dz * 8;
      const lateral = (end === 'to' ? 1 : -1) * r.width / 4;
      out.push({ roadId: r.id, end, x: px + lx * lateral, z: pz + lz * lateral, lateral });
    }
  }
  return out;
}

/** Centres (metres along the road from its start) of planted median islands
 *  on a highway stretch. The first/last island leaves ≥35 m clear at
 *  junctions (centre 55 m in, island half-length 16 m), and on city roads
 *  islands keep clear of the existing t=0.25/0.75 median islands. */
export function highwayMedianCentres(length: number, city: boolean): number[] {
  const centres: number[] = [];
  for (let s = 55; s <= length - 55; s += 90) {
    if (city && [0.25 * length, 0.75 * length].some((p) => Math.abs(s - p) < 20)) continue;
    centres.push(s);
  }
  return centres;
}

/** Pier positions (metres along the road) for a bridge deck: every ~80 m,
 *  starting 40 m in from each end. */
export function bridgePierPositions(length: number): number[] {
  const out: number[] = [];
  for (let s = 40; s <= length - 40; s += 80) out.push(s);
  return out;
}

/** Small shared-resource chunks, visibility independent of collision (which stays indexed globally). */
export class RegionalView {
 readonly group=new THREE.Group();
 private quality: QualityPreset='balanced';
 /** Road materials, for the Phase 6 wet-road material swap (registered by Game). */
 readonly roadMaterials: THREE.MeshStandardMaterial[] = [];
 private vegetation!: Vegetation;
 private chunks: {group:THREE.Group;point:Point;radius:number}[]=[];
 constructor(scene:THREE.Scene){
  scene.add(this.group);
  const box=new THREE.BoxGeometry(1,1,1),plane=new THREE.PlaneGeometry(1,1);
  const asphalt=worldSurfaceMaterial('asphalt');
  // Highways read slightly darker than main roads; same texture, colour
  // multiplier only (shares the asphalt shader program).
  const asphaltHighway=worldSurfaceMaterial('asphalt');
  asphaltHighway.color.set(0xcccccc);
  this.roadMaterials.push(asphalt, asphaltHighway);
  const paving=worldSurfaceMaterial('paving');
  const concrete=new THREE.MeshStandardMaterial({color:0x9a9a94,roughness:0.95});
  const trunkMat=new THREE.MeshStandardMaterial({color:0x6b4a2f,roughness:1});
  // Phase 3 — one verge material per ground region (shared palette with
  // DistrictView's painted ground). Tree crowns keep their own green so
  // they never inherit the dusty / grey tint of the ground they stand on.
  const vergeMaterials: Record<GroundRegion, THREE.MeshStandardMaterial> = {
    dusty: new THREE.MeshStandardMaterial({ color: GROUND_REGION_COLORS.dusty, roughness: 1 }),
    river: new THREE.MeshStandardMaterial({ color: GROUND_REGION_COLORS.river, roughness: 1 }),
    urban: new THREE.MeshStandardMaterial({ color: GROUND_REGION_COLORS.urban, roughness: 1 }),
    rural: new THREE.MeshStandardMaterial({ color: GROUND_REGION_COLORS.rural, roughness: 1 }),
  };
  const crownMat=new THREE.MeshStandardMaterial({color:0x6b7a52,roughness:1});
  const paint=new THREE.MeshBasicMaterial({color:0xe9dbad});
  const rail=new THREE.MeshStandardMaterial({color:0xc5bda0,roughness:0.85});
  const glass=new THREE.MeshStandardMaterial({color:0x587e8b,metalness:0.35,roughness:0.3,emissive:0x284558,emissiveIntensity:0.15});
  const residential=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.9});
  const foliage=new THREE.IcosahedronGeometry(1.5,0);
  // Yamuna as a flat ribbon following the real polyline, just above the
  // ground plane and just below the bridge decks that cross it.
  for (let i = 1; i < YAMUNA_RIVER.length; i++) {
    const a = YAMUNA_RIVER[i - 1], b = YAMUNA_RIVER[i];
    const length = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(160, length + 40), new THREE.MeshStandardMaterial({ color: 0x497e86, roughness: 0.35, metalness: 0.25 }));
    ribbon.rotation.order = 'YXZ'; ribbon.rotation.y = yaw; ribbon.rotation.x = -Math.PI / 2; ribbon.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2); this.group.add(ribbon);
  }
  const mesh=(g:THREE.Group,material:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,yaw=0)=>{
   const m=new THREE.Mesh(box,material);m.position.set(x,y,z);m.scale.set(w,h,d);m.rotation.y=yaw;g.add(m);return m;
  };
  for(const bank of riverBanks)mesh(this.group,rail,bank.x,0.5,bank.z,bank.width,bank.height,bank.depth);
  // Phase 2 dressing placements, computed once from the same helpers the
  // tests verify, grouped by drawn road so each chunk renders its own.
  const treesByRoad=medianTreesByRoad();
  const stopByRoad=new Map<string,StopLinePlacement[]>();
  for(const s of stopLinePlacements()){
    const list=stopByRoad.get(s.roadId)??[];
    list.push(s);stopByRoad.set(s.roadId,list);
  }
  // NH-44 / NH-19 run concurrently south of Ashram: identical geometry
  // would z-fight if drawn twice, so draw each undirected stretch once.
  for (const r of drawnRealRoads()) {
    const [a, b] = ends(r);
    const length = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z), cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
   const chunk=new THREE.Group();this.group.add(chunk);this.chunks.push({group:chunk,point:{x:cx,z:cz},radius:length/2+160});
   const dummy=new THREE.Object3D();
   const city=r.region==='gurgaon'||r.region==='noida';
   // Market Lane has no real-road definition; treat it as a 4-lane road.
   const lanes=roadById(r.id.split(':')[0])?.lanes??4;
   // Phase 3 — the verge strip takes the ground tint of the region the
   // stretch's midpoint sits in (segments are a few hundred metres, so one
   // tint per stretch follows the region boundaries closely enough).
   const vergeMat=vergeMaterials[groundRegionAt(cx,cz)];
   if(!r.bridge)mesh(chunk,vergeMat,cx,-0.15,cz,r.width+95,0.2,length+32,yaw);
   // Slightly overlapping ends close junction seams; deck top equals CP road height.
   mesh(chunk,r.kind==='highway'?asphaltHighway:asphalt,cx,-0.075,cz,r.width,0.2,length+r.width,yaw);
   // Centre dashes plus lane-divider dashes (one InstancedMesh for all of
   // them); edge lines are solid thin boxes at ±(width/2 − 0.6).
   const dividers=laneDividerOffsets(r.width,lanes);
   const lineOffsets=[0,...dividers];
   const dashesPerLine=Math.floor(length/18);
   if(dashesPerLine>0){
    const markings=new THREE.InstancedMesh(box,paint,lineOffsets.length*dashesPerLine);
    let mi=0;
    for(const off of lineOffsets)for(let i=0;i<dashesPerLine;i++){const t=(i+0.5)/dashesPerLine;dummy.position.set(a.x+(b.x-a.x)*t+Math.cos(yaw)*off,0.04,a.z+(b.z-a.z)*t-Math.sin(yaw)*off);dummy.rotation.y=yaw;dummy.scale.set(0.16,0.02,6);dummy.updateMatrix();markings.setMatrixAt(mi++,dummy.matrix);}chunk.add(markings);
   }
   for(const side of [-1,1] as const){
    const off=(r.width/2-0.6)*side;
    mesh(chunk,paint,cx+Math.cos(yaw)*off,0.04,cz-Math.sin(yaw)*off,0.16,0.02,length,yaw);
   }
   // Median trees: the collision solids at t=0.25/0.75 were invisible until
   // now. One instanced crown + one instanced trunk per road that has them;
   // they sit in the planted median islands drawn below at the same spots.
   const trees=treesByRoad.get(r.id);
   if(trees&&trees.length){
    const crowns=new THREE.InstancedMesh(foliage,crownMat,trees.length);
    const trunks=new THREE.InstancedMesh(box,trunkMat,trees.length);
    trees.forEach((t,i)=>{
     dummy.position.set(t.x,3.0,t.z);dummy.rotation.y=0;dummy.scale.set(1.3,1.3,1.3);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);
     dummy.position.set(t.x,0.9,t.z);dummy.rotation.y=0;dummy.scale.set(0.3,1.8,0.3);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
    });
    chunk.add(crowns);chunk.add(trunks);
   }
   // Planted highway median (visual only, like the city islands): segmented
   // low islands with foliage crowns, ≥35 m clear at junctions.
   if(r.kind==='highway'&&lanes>=6){
    const centres=highwayMedianCentres(length,city);
    if(centres.length){
     const islands=new THREE.InstancedMesh(box,vergeMat,centres.length);
     const crowns=new THREE.InstancedMesh(foliage,crownMat,centres.length);
     centres.forEach((s,i)=>{
      const t=s/length,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
      dummy.position.set(x,0.15,z);dummy.rotation.y=yaw;dummy.scale.set(1.2,0.25,32);dummy.updateMatrix();islands.setMatrixAt(i,dummy.matrix);
      dummy.position.set(x,3.2,z);dummy.rotation.y=0;dummy.scale.set(1,1,1);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);
     });
     chunk.add(islands);chunk.add(crowns);
    }
   }
   // Footpaths on city-region roads that are not bridges: paving strips
   // along both edges, just outside the guard-rail line.
   if(city&&!r.bridge){
    for(const side of [-1,1] as const){
     const off=(r.width/2+2.3)*side;
     mesh(chunk,paving,cx+Math.cos(yaw)*off,0.02,cz-Math.sin(yaw)*off,3,0.04,length,yaw);
    }
   }
   // Bridge parapets (low walls on both deck edges) and piers down into
   // the water at intervals. Visual only; deck height is unchanged.
   if(r.bridge){
    for(const side of [-1,1] as const){
     const off=(r.width/2-0.3)*side;
     mesh(chunk,rail,cx+Math.cos(yaw)*off,0.5,cz-Math.sin(yaw)*off,0.4,1.0,length,yaw);
    }
    const piers=bridgePierPositions(length);
    if(piers.length){
     const pierMesh=new THREE.InstancedMesh(box,concrete,piers.length);
     piers.forEach((s,i)=>{
      const t=s/length;
      dummy.position.set(a.x+(b.x-a.x)*t,-3,a.z+(b.z-a.z)*t);dummy.rotation.y=yaw;dummy.scale.set(3,6,2);dummy.updateMatrix();pierMesh.setMatrixAt(i,dummy.matrix);
     });
     chunk.add(pierMesh);
    }
   }
   // Stop lines at named junctions: one instanced bar per approach, across
   // the approach half-carriageway. (Zebra crossings not added.)
   const stops=stopByRoad.get(r.id);
   if(stops&&stops.length){
    const bars=new THREE.InstancedMesh(box,paint,stops.length);
    stops.forEach((s,i)=>{
     dummy.position.set(s.x,0.04,s.z);dummy.rotation.y=yaw;dummy.scale.set(r.width/2,0.02,0.6);dummy.updateMatrix();bars.setMatrixAt(i,dummy.matrix);
    });
    chunk.add(bars);
   }
   for(const barrier of worldBarriers.filter(s=>s.road===r.id))mesh(chunk,rail,barrier.x,0.5,barrier.z,barrier.width,1,barrier.depth,barrier.yaw);
   if(city){
    const buildings=new THREE.InstancedMesh(box,r.region==='gurgaon'?glass:residential,16);
    for(let i=0;i<16;i++){const t=0.2+Math.floor(i/2)/7*0.6,side=i%2?1:-1,height=r.region==='gurgaon'?28+(i%5)*12:15+(i%4)*7;
     const bx=a.x+(b.x-a.x)*t+Math.cos(yaw)*65*side,bz=a.z+(b.z-a.z)*t-Math.sin(yaw)*65*side;
     // Same clearance test as the collision solids in WorldRoads: a skipped
     // spot stays empty in both, so visuals and collision never drift apart.
     dummy.position.set(bx,height/2,bz);dummy.rotation.y=yaw;dummy.scale.set(buildingSpotClear(bx,bz,r.id)?26:0,height,buildingSpotClear(bx,bz,r.id)?27:0);dummy.updateMatrix();buildings.setMatrixAt(i,dummy.matrix);if(r.region==='noida')buildings.setColorAt(i,new THREE.Color(i%3===0?0x8da9ad:0xc8c1a7));}chunk.add(buildings);
    // Low planted median islands leave 35m at every junction and wide gaps for bays.
    for(const t of [0.25,0.75]){
     const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
     mesh(chunk,vergeMat,x,0.15,z,1.2,0.25,32,yaw);mesh(chunk,rail,x,1.4,z,0.3,2.8,0.3);
     const crown=new THREE.Mesh(foliage,crownMat);crown.position.set(x,3.2,z);chunk.add(crown);
    }
   }
   const label=r.id==='market-lane'?'MARKET LANE · DELHI ↗':r.bridge?`${r.shield} · YAMUNA CROSSING`:r.name.toUpperCase();
   for(const reverse of [false,true]){
    const t=reverse?0.85:0.15,side=reverse?-1:1;
    const x=a.x+(b.x-a.x)*t+Math.cos(yaw)*(r.width/2+3)*side,z=a.z+(b.z-a.z)*t-Math.sin(yaw)*(r.width/2+3)*side;
    mesh(chunk,rail,x,2,z,0.2,4,0.2);
    const sign=new THREE.Mesh(plane,new THREE.MeshBasicMaterial({map:signTexture(label),side:THREE.DoubleSide}));sign.position.set(x,4,z);sign.scale.set(12,2.5,1);sign.rotation.y=yaw+(reverse?0:Math.PI);chunk.add(sign);
   }
  }
  for(const bay of [...destinations,...motorPoolBays]){
   const g=new THREE.Group();this.group.add(g);this.chunks.push({group:g,point:bay,radius:80});
   mesh(g,asphalt,bay.x,0.01,bay.z,30,0.04,12);
   if(bay.region==='gurgaon')mesh(g,rail,bay.x,0,bay.z+(bay.z<2100?30:-30),55,0.04,28);
   for(const dx of [-14,14])mesh(g,paint,bay.x+dx,0.05,bay.z,0.2,0.02,11);
   const label=new THREE.Mesh(plane,new THREE.MeshBasicMaterial({map:signTexture(bay.name),side:THREE.DoubleSide}));label.position.set(bay.x,3,bay.z+7);label.scale.set(16,2,1);g.add(label);
  }
  // Phase 3 — vegetation lives under this group so Game needs no new wiring:
  // RegionalView forwards setQuality/update to it (see below).
  this.vegetation=new Vegetation(this.group);
 }
 setQuality(quality:QualityPreset):void {this.quality=quality;this.vegetation.setQuality(quality);}
 update(focus:Point):void {for(const chunk of this.chunks)chunk.group.visible=Math.hypot(chunk.point.x-focus.x,chunk.point.z-focus.z)<chunk.radius+QUALITY[this.quality].sceneryDistance;this.vegetation.update(focus);}
}
