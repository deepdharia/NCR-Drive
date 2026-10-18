import type { Point } from '../core/math';
import { distance } from '../core/math';
import type { Solid } from '../core/CollisionWorld';

/** Metres; +X east, +Z south, +Y up. Yaw atan2(dx,dz); vehicle +Z forward.
 * Each road counted once; directed lanes run on the left of their own heading. */
export type RegionId = 'delhi' | 'gurgaon' | 'noida' | 'gurgaon-corridor' | 'yamuna-corridor';
export interface Junction extends Point { id: string; region: RegionId; turnaround?: boolean }
export interface Road { id: string; from: string; to: string; width: number; region: RegionId; bridge?: boolean }
export interface Lane { id: string; offset: number; direction: 'forward' | 'reverse'; road: Road; from: string; to: string; start: Point; end: Point; length: number }
export const junctions: Junction[] = [];
export const roads: Road[] = [];
function node(id: string, x: number, z: number, region: RegionId): string { junctions.push({ id, x, z, region }); return id; }
function road(id: string, from: string, to: string, region: RegionId, width = 18, bridge = false): void { roads.push({ id, from, to, region, width, bridge }); }
for (let i = 0; i < 72; i++) node(`cp-${i}`, Math.cos(i * Math.PI / 36) * 44, Math.sin(i * Math.PI / 36) * 44, 'delhi');
for (let i = 0; i < 72; i++) road(`cp-ring-${i}`, `cp-${i}`, `cp-${(i + 1) % 72}`, 'delhi', 12);
for (let i = 0; i < 6; i++) {
  const a = i * Math.PI / 3; node(`radial-${i}`, Math.cos(a) * 130, Math.sin(a) * 130, 'delhi');
  road(`cp-radial-${i}`, `cp-${i * 12}`, `radial-${i}`, 'delhi', 12);
}
function chain(id: string, start: string, points: [number, number][], region: RegionId): string {
  let previous = start;
  points.forEach(([x,z], i) => { const next = node(`${id}-${i}`, x,z,region); road(`${id}-${i}`,previous,next,region,22,id === 'east' && i === 3); previous=next; });
  return previous;
}
const g = chain('southwest','radial-2',[[-180,310],[-430,540],[-750,650],[-1050,1000],[-1200,1450],[-1550,1750],[-1900,1900]],'gurgaon-corridor');
const n = chain('east','radial-0',[[460,0],[850,-170],[1200,-170],[1550,-170],[2000,50],[2500,50],[3000,50]],'yamuna-corridor');
node('g-west',-2300,1900,'gurgaon'); node('g-sw',-2300,2300,'gurgaon'); node('g-se',-1900,2300,'gurgaon');
road('g-avenue-n',g,'g-west','gurgaon',28); road('g-avenue-w','g-west','g-sw','gurgaon',28); road('g-avenue-s','g-sw','g-se','gurgaon',28); road('g-avenue-e','g-se',g,'gurgaon',28);
node('n-ne',3400,50,'noida'); node('n-se',3400,450,'noida'); node('n-sw',3000,450,'noida'); node('n-mid-w',3000,250,'noida'); node('n-mid-e',3400,250,'noida');
road('n-sector-n',n,'n-ne','noida',24); road('n-sector-ne','n-ne','n-mid-e','noida',24); road('n-sector-se','n-mid-e','n-se','noida',24); road('n-sector-s','n-se','n-sw','noida',24); road('n-sector-sw','n-sw','n-mid-w','noida',24); road('n-sector-nw','n-mid-w',n,'noida',24); road('n-sector-middle','n-mid-w','n-mid-e','noida',24);
// Wide corridor mouths provide signed, flat turnaround space.
for(const j of junctions)if(j.region==='gurgaon'||j.region==='noida'||['radial-0','radial-2',g,n].includes(j.id))j.turnaround=true;
// Living Delhi: a 250 m market street; unchanged vehicle/world scale.
node('market-west',-380,0,'delhi'); road('market-lane','radial-3','market-west','delhi',18);
junctions.find(j=>j.id==='market-west')!.turnaround=true;
export const junctionById = new Map(junctions.map(n => [n.id,n]));
export function ends(r: Road): [Junction,Junction] { return [junctionById.get(r.from)!,junctionById.get(r.to)!]; }
export const lanes: Lane[] = roads.flatMap(r => [false,true].map(reverse => {
  const [a,b] = ends(r), from = reverse ? b : a, to = reverse ? a : b, length=distance(a,b);
  const offset = r.width <= 12 ? 2.7 : 4;
  const x=(to.z-from.z)/length*offset,z=-(to.x-from.x)/length*offset;
  // Outer lanes stop at junction ports. Connecting port to port makes a
  // forward turn; driving to the node centre first would turn back into the
  // following car on a left turn. CP geometry keeps its established samples.
  const trim=r.region==='delhi'?0:Math.min(r.width/2,length*0.2);
  const dx=(to.x-from.x)/length,dz=(to.z-from.z)/length;
  const start={x:from.x+x+dx*trim,z:from.z+z+dz*trim};
  const end={x:to.x+x-dx*trim,z:to.z+z-dz*trim};
  return { id:`${r.id}:${reverse ? 'back' : 'out'}`, offset,direction:reverse?'reverse':'forward',road:r,from:from.id,to:to.id,start,end,length:distance(start,end) };
}));
/** Onward transitions plus explicit wide-mouth turnarounds; dead ends allow reversal. */
export function successors(lane: Lane): Lane[] { const out=lanes.filter(l=>l.from===lane.to && (l.road.id!==lane.road.id || junctionById.get(lane.to)?.turnaround)); return out.length ? out : lanes.filter(l=>l.from===lane.to); }
export function projection(p: Point,a: Point,b: Point): { point: Point; t: number; distance: number } {
 const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));
 const point={x:a.x+dx*t,z:a.z+dz*t}; return {point,t,distance:distance(p,point)};
}
export function nearestRoad(p: Point): Road { return roads.reduce((a,b)=>projection(p,...ends(a)).distance < projection(p,...ends(b)).distance ? a:b); }
export function regionAt(p: Point): RegionId { return nearestRoad(p).region; }
export const regionLabels: Record<RegionId,string> = {delhi:'Delhi · Connaught Place',gurgaon:'Gurgaon · Business Avenue',noida:'Noida · Sector 18','gurgaon-corridor':'Delhi–Gurgaon Parkway','yamuna-corridor':'Yamuna Crossing · Noida Link'};
export const destinations = [
 {id:'gurgaon-plaza',name:'Gurgaon · Cyber Plaza bay',region:'gurgaon' as const,x:-2100,z:1910},
 {id:'gurgaon-office',name:'Gurgaon · Office Gardens bay',region:'gurgaon' as const,x:-2100,z:2290},
 {id:'noida-sector18',name:'Noida · Sector 18 bay',region:'noida' as const,x:3200,z:60},
 {id:'noida-gardens',name:'Noida · Sector Gardens bay',region:'noida' as const,x:3200,z:440},
];
export const recoveryPads = [...roads.filter(r=>!r.id.startsWith('cp-') && r.id!=='market-lane').flatMap(r=>{
 const [a,b]=ends(r),length=distance(a,b),dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
 return [0.25,0.75].map((t,i)=>({id:`${r.id}-recovery-${i}`,region:r.region,x:a.x+(b.x-a.x)*t+dz*4,z:a.z+(b.z-a.z)*t-dx*4,yaw:Math.atan2(dx,dz)}));
}), ...[80,112,124].flatMap(radius=>Array.from({length:6},(_,i)=>{const angle=i*Math.PI/3;return {id:`cp-pad-${radius}-${i}`,region:'delhi' as RegionId,x:Math.cos(angle)*radius,z:Math.sin(angle)*radius,yaw:Math.PI/2-angle};}))];
/** Guard rails at bridge edges: continuous flat deck, water below; no stacked surfaces. */
export const worldBarriers: Solid[] = roads.filter(r=>!r.id.startsWith('cp-') && r.id!=='market-lane').flatMap(r=>{
 const [a,b]=ends(r),len=distance(a,b),yaw=Math.atan2(b.x-a.x,b.z-a.z);
 return [-1,1].map(side=>({x:(a.x+b.x)/2+Math.cos(yaw)*(r.width/2+0.8)*side,z:(a.z+b.z)/2-Math.sin(yaw)*(r.width/2+0.8)*side,width:0.6,depth:len-32,height:1,yaw}));
});
export const uniqueRoadLength = roads.reduce((s,r)=>s+distance(...ends(r)),0);

export const regionalBuildings: Solid[] = roads.filter(r=>r.region==='gurgaon'||r.region==='noida').flatMap(r=>{
 const [a,b]=ends(r),yaw=Math.atan2(b.x-a.x,b.z-a.z),region=r.region;
 return Array.from({length:16},(_,i)=>{const t=0.2+Math.floor(i/2)/7*0.6,side=i%2?1:-1;
  return {x:a.x+(b.x-a.x)*t+Math.cos(yaw)*65*side,z:a.z+(b.z-a.z)*t-Math.sin(yaw)*65*side,width:26,depth:27,height:region==='gurgaon'?28+(i%5)*12:15+(i%4)*7,yaw};});
});

export const riverBanks: Solid[] = [1220,1530].flatMap(x=>[-1,1].map(side=>({x,z:-170+side*570,width:1.2,depth:1100,height:1,yaw:0})));

export const motorPoolBays = [
 {id:'delhi-west-motorpool',name:'DELHI · MOTOR POOL',region:'delhi' as const,x:-84,z:9,yaw:Math.PI/2},
 {id:'delhi-east-motorpool',name:'DELHI · MOTOR POOL',region:'delhi' as const,x:84,z:-9,yaw:-Math.PI/2},
];

export const medianTrees: Solid[] = roads.filter(r=>r.region==='gurgaon'||r.region==='noida').flatMap(r=>{const [a,b]=ends(r);return [0.25,0.75].map(t=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,width:0.3,depth:0.3,height:3,yaw:0}));});
