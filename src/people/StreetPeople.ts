import { HumanoidView, PEDESTRIAN_FLOOR_OFFSET, DRIVER_VARIANT } from './HumanoidView';
import type { HumanVariant } from './HumanoidView';
import { Reservations, seats, shops } from '../systems/Neighborhood';
import { distance } from '../core/math';
import type { Point } from '../core/math';
import type { CollisionWorld, Solid } from '../core/CollisionWorld';
import type { VehicleController } from '../vehicle/VehicleController';
import { roads, ends } from '../world/WorldRoads';
import { PEDESTRIAN_COUNTS, pickVariant, stepAsideAlongLine, stepAsideOnRing, idleSway } from '../world/PedestrianVariants';
import type { QualityPreset } from '../rendering/QualityProfile';
import * as THREE from 'three';
/** Ten distinct market adults: full clothing/hair/skin/accessory/scale/phase variants. No teal shirts — the player keeps teal. */
const MARKET_VARIANTS:HumanVariant[]=[
 {shirt:0xe8e2d2,trousers:0x9a8a6a,shoes:0x4a3220,skin:0x8f5f3e,hair:0x1a1512,scale:1,accessory:'none',phase:0},
 {shirt:0xd8cdb4,trousers:0x3a3f4a,shoes:0x2e2620,skin:0xa67a52,hair:0x9a9a9a,scale:1,accessory:'none',phase:0.3},
 {shirt:0xd08a3a,trousers:0x33383f,shoes:0x2e2620,skin:0xa67a52,hair:0x201a14,scale:1,accessory:'none',phase:0.6},
 {shirt:0x7a3a3a,trousers:0x2e3d52,shoes:0x1f1c1a,skin:0xb08a68,hair:0x1f1a16,scale:1.02,accessory:'cap',phase:0.9},
 {shirt:0x4a6b4a,trousers:0x8a7a58,shoes:0x4a3220,skin:0x8a5a3b,hair:0x14100d,scale:0.98,accessory:'bag',phase:1.3},
 {shirt:0xc97a7a,trousers:0x4a4a4a,shoes:0x2e2620,skin:0xc09a78,hair:0x2a201a,scale:1,accessory:'none',phase:0.2},
 {shirt:0xc9a03a,trousers:0x2c3240,shoes:0x352e29,skin:0x9a6b4a,hair:0x1f1a16,scale:1.03,accessory:'cap',phase:1.7},
 {shirt:0x2e4a6e,trousers:0xa08a68,shoes:0x4a3220,skin:0x7a4e30,hair:0x0f0d0b,scale:0.97,accessory:'bag',phase:0.5},
 {shirt:0x6b4a7a,trousers:0x2e2e38,shoes:0x1f1c1a,skin:0xb08a68,hair:0x241c16,scale:1.01,accessory:'none',phase:1.1},
 {shirt:0xe4e0d4,trousers:0x5a4632,shoes:0x4a3220,skin:0x8f5f3e,hair:0x1a1512,scale:0.99,accessory:'none',phase:1.5},
];
type State='walk'|'wait'|'order'|'seat'|'drink'|'leave'|'react'|'flee'|'vendor'|'retreated'|'stroll'|'waitCross'|'cross'|'pause';
interface Person {id:string;position:Point;view:HumanoidView;state:State;time:number;shop:number;target:Point;speed:number;yaw:number;seat?:string;waypoints:Point[];blocked:number;action?:string;actionTime?:number;civilianDriver?:boolean;stroller:boolean;side:'north'|'south';trips:number;
/** Cached numeric id suffix: the old code ran `p.id.match(/\d+$/)` twice
 * per person per frame (side + idle-sway phase). Computed once at creation. */
num:number;
/** Cached collider Solid for fillColliders(): refreshed in place, so the
 * 120 Hz loop never allocates a Solid per person per read. */
colliderSolid:Solid;
/** Phase 4: which footpath network this stroller belongs to. 'market' is
 * the original Market Lane pair of pavements; 'cp-ring' loops the Inner
 * Circle footpath; 'mg-road' walks the two MG Road pavements. */
area:'market'|'cp-ring'|'mg-road';
/** Line-area strollers: their own pavement segment (a → b), the zebra
 * centre, and the crossing mouth on their side / the far side. */
route?:{a:Point;b:Point};routeOther?:{a:Point;b:Point};cross?:Point;mouth?:Point;mouthOther?:Point;
/** Ring strollers: current angle on the footpath circle and walk direction. */
angle?:number;ringDir?:1|-1}
/** Market Lane footpaths: the north pavement (shop fronts) and the south
 * pavement, either side of the 18 m carriageway. The only crossing is the
 * marked zebra at x=-244 (see the living-production walkthrough). */
const CROSSING={x:-244,mid:{x:-244,z:0}};
const NORTH_PAVEMENT={minX:-238,maxX:-150,z:-10.5};
const SOUTH_PAVEMENT={minX:-240,maxX:-182,z:14.4};
const CROSSING_HALF_WIDTH=3;
/** Candidate-avoidance angles for the movement block below: the old code
 * rebuilt this 7-element array (times the per-person side) on every
 * moving person every frame. Offsets are multiplied by `side` (±1) at use. */
const AVOID_OFFSETS=[0,0.7,-0.7,1.3,-1.3,1.7,-1.7];
/** Point-to-segment distance, same formula as WorldRoads.projection().distance
 * but without allocating the {point, t, distance} result. Used per candidate
 * by strollerClear, so it runs up to 7× per moving stroller per frame. */
function segmentDistance(p:Point,a:Point,b:Point):number{
 const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));
 const cx=a.x+dx*t,cz=a.z+dz*t;return Math.hypot(p.x-cx,p.z-cz);
}
/** Ten permanent adults, no camera-facing spawn/recycle. Bounded reservations and timers.
 * Phase 4: `quality` scales only the two NEW stroller areas (CP ring +
 * Gurugram MG Road); the Market Lane population is identical on every tier. */
export class StreetPeople {
 readonly group=new THREE.Group();readonly reservations=new Reservations();readonly people:Person[]=[];alert=0;
 /** CP Inner Circle footpath radius: carriageway edge is 44 + 6 = 50 m. */
 static readonly CP_RING_RADIUS=52;
 constructor(scene:THREE.Scene, quality:QualityPreset='balanced'){scene.add(this.group);for(let i=0;i<10;i++){
  const vendor=i<3,shop=i%3,position=vendor?{x:shops[shop].x,z:-17.6}:{x:-146-(i-3)*13,z:-10.5};
  const view=new HumanoidView(MARKET_VARIANTS[i]);this.group.add(view.group);view.group.position.set(position.x,PEDESTRIAN_FLOOR_OFFSET,position.z);view.update(0.2,vendor?'talk':'idle');
  this.people.push({id:`market-adult-${i}`,position,view,state:vendor?'vendor':'walk',time:0,shop,target:vendor?position:{x:shops[shop].x,z:-12.7},speed:0,yaw:0,waypoints:[],blocked:0,stroller:false,side:'north',trips:0,area:'market',num:i,colliderSolid:{x:position.x,z:position.z,width:0.6,depth:0.6,height:1.75,yaw:0}});
 }
 // Six footpath strollers on Market Lane: three on the north pavement, three
 // on the south. They cross only at the marked zebra (x=-244), only on a
 // clear gap — see updateStroller/strollerClear. They never queue, sit or
 // drink; the market state machine below is skipped for them.
 for(let i=0;i<6;i++){
  const south=i>=3,n=i%3,band=south?SOUTH_PAVEMENT:NORTH_PAVEMENT;
  const position=south?{x:-196-n*18,z:band.z}:{x:-166-n*22,z:band.z};
  const view=new HumanoidView({...MARKET_VARIANTS[(i*2)%MARKET_VARIANTS.length],phase:i*0.7});this.group.add(view.group);view.group.position.set(position.x,PEDESTRIAN_FLOOR_OFFSET,position.z);view.update(0.2,'idle');
  this.people.push({id:`market-stroller-${i}`,position,view,state:'stroll',time:0,shop:0,target:{x:band.minX,z:band.z},speed:0,yaw:0,waypoints:[],blocked:0,stroller:true,side:south?'south':'north',trips:0,area:'market',num:i,colliderSolid:{x:position.x,z:position.z,width:0.6,depth:0.6,height:1.75,yaw:0}});
 }
 // Phase 4 — CP ring footpath strollers: they loop the Inner Circle at
 // radius 52, just outside the carriageway, and never cross (no zebra on
 // the ring). Counts scale with quality; variants come from the shared
 // Phase 4 variant set, not the market set.
 const cpCount=PEDESTRIAN_COUNTS[quality].cpRing;
 for(let i=0;i<cpCount;i++){
  const angle=(i/cpCount)*Math.PI*2+0.5,ringDir:1|-1=i%2?1:-1;
  const position={x:Math.cos(angle)*StreetPeople.CP_RING_RADIUS,z:Math.sin(angle)*StreetPeople.CP_RING_RADIUS};
  const targetAngle=angle+ringDir*0.06;
  const view=new HumanoidView({...pickVariant(i,'cp-ring'),phase:i*0.9});this.group.add(view.group);view.group.position.set(position.x,PEDESTRIAN_FLOOR_OFFSET,position.z);view.update(0.2,'idle');
  this.people.push({id:`cp-stroller-${i}`,position,view,state:'stroll',time:0,shop:0,target:{x:Math.cos(targetAngle)*StreetPeople.CP_RING_RADIUS,z:Math.sin(targetAngle)*StreetPeople.CP_RING_RADIUS},speed:0,yaw:0,waypoints:[],blocked:0,stroller:true,side:'north',trips:0,area:'cp-ring',angle,ringDir,num:i,colliderSolid:{x:position.x,z:position.z,width:0.6,depth:0.6,height:1.75,yaw:0}});
 }
 // Phase 4 — Gurugram boulevard strollers: the two footpaths alongside
 // MG Road segment golf-jn → mg-mid (road 'mg-road:1', 20 m wide, so the
 // pavements sit 12.5 m either side of the centreline), crossing only at
 // the zebra at the segment midpoint. Same state shape as Market Lane.
 const mgRoad=roads.find(r=>r.id==='mg-road:1');
 if(mgRoad){
  const [mgA,mgB]=ends(mgRoad),mgLen=distance(mgA,mgB),mgUx=(mgB.x-mgA.x)/mgLen,mgUz=(mgB.z-mgA.z)/mgLen,mgPx=-mgUz,mgPz=mgUx,mgOff=12.5;
  const mgCross={x:(mgA.x+mgB.x)/2,z:(mgA.z+mgB.z)/2};
  const mgCount=PEDESTRIAN_COUNTS[quality].mgRoad;
  for(let i=0;i<mgCount;i++){
   const south=i%2===1,s= south?-1:1;
   const a={x:mgA.x+mgPx*mgOff*s,z:mgA.z+mgPz*mgOff*s},b={x:mgB.x+mgPx*mgOff*s,z:mgB.z+mgPz*mgOff*s};
   const mouth={x:mgCross.x+mgPx*mgOff*s,z:mgCross.z+mgPz*mgOff*s},mouthOther={x:mgCross.x-mgPx*mgOff*s,z:mgCross.z-mgPz*mgOff*s};
   const otherA={x:mgA.x-mgPx*mgOff*s,z:mgA.z-mgPz*mgOff*s},otherB={x:mgB.x-mgPx*mgOff*s,z:mgB.z-mgPz*mgOff*s};
   const t=0.2+0.6*(mgCount>1?i/(mgCount-1):0.5);
   const position={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
   const view=new HumanoidView({...pickVariant(i,'mg-road'),phase:i*0.7});this.group.add(view.group);view.group.position.set(position.x,PEDESTRIAN_FLOOR_OFFSET,position.z);view.update(0.2,'idle');
   this.people.push({id:`mg-stroller-${i}`,position,view,state:'stroll',time:0,shop:0,target:t<0.5?{...b}:{...a},speed:0,yaw:0,waypoints:[],blocked:0,stroller:true,side:south?'south':'north',trips:0,area:'mg-road',route:{a,b},routeOther:{a:otherA,b:otherB},cross:{...mgCross},mouth,mouthOther,num:i,colliderSolid:{x:position.x,z:position.z,width:0.6,depth:0.6,height:1.75,yaw:0}});
  }
 }
}
 serve(shop:number):void {const vendor=this.people[shop];vendor.action='handover';vendor.actionTime=1.2;}
 get colliders():Solid[]{return this.people.filter(p=>p.state!=='vendor').map(p=>({...p.position,width:0.6,depth:0.6,height:1.75,yaw:0}));}
 /** Fill `out` with one cached Solid per non-vendor person (x/z refreshed).
  * Same set as the `colliders` getter, without allocating per call — the
  * 120 Hz loop reads this twice per step. */
 fillColliders(out:Solid[]):void{for(const p of this.people){if(p.state==='vendor')continue;const s=p.colliderSolid;s.x=p.position.x;s.z=p.position.z;out.push(s);}}
 /** Per-update scratch: car colliders are the same for every person this
  * frame, so they are built once at the top of update() instead of once
  * per avoidance angle (7× per moving person before). */
 private carSolids:Solid[]=[];
 private motionScratch:Point={x:0,z:0};
 displace(id:string,point:Point,target:Point={x:point.x-3,z:point.z}):void {
  if(this.people.some(p=>p.id===id))return;
  const view=new HumanoidView(DRIVER_VARIANT);this.group.add(view.group);this.people.push({id,position:{...point},view,state:'flee',time:0,shop:0,target:{...target},civilianDriver:true,speed:0,yaw:0,waypoints:[],blocked:0,stroller:false,side:'north',trips:0,area:'market',num:Number(id.match(/\d+$/)?.[0]??0),colliderSolid:{x:point.x,z:point.z,width:0.6,depth:0.6,height:1.75,yaw:0}});this.alert=8;
 }
 private release(p:Person):void {p.waypoints=[];this.reservations.release(p.id);p.seat=undefined;}
 private leaveSeat(p:Person,world:CollisionWorld,cars:readonly VehicleController[],player?:Point):boolean {
  if(p.state!=='drink')return true;
  const exits=[{x:p.position.x,z:p.position.z+0.8},{x:p.position.x-1.3,z:p.position.z+0.8},{x:p.position.x+1.3,z:p.position.z+0.8}];
  const exit=exits.find(q=>world.isClear(q,0.3,0,1.8,cars.map(c=>c.collider))&&this.people.every(o=>o===p||distance(o.position,q)>=0.65)&&(!player||distance(player,q)>=0.7));
  if(!exit)return false;p.position=exit;return true;
 }
 update(dt:number,world:CollisionWorld,cars:readonly VehicleController[],focus:Point,player?:Point):void {
  this.alert=Math.max(0,this.alert-dt);
  // Car colliders are the same for every person this frame: build once.
  const carSolids=this.carSolids;carSolids.length=0;for(const c of cars)carSolids.push(c.collider);
  for(const p of this.people){
   p.time+=dt;p.view.group.visible=distance(p.position,focus)<100;if(!p.view.group.visible){if(p.stroller)continue;if(p.civilianDriver){this.release(p);p.state='retreated';p.time=0;p.target={...p.position};}else if(p.state!=='vendor'&&this.leaveSeat(p,world,cars,player)){this.release(p);p.state='leave';p.time=0;p.target={x:-238+p.shop*8,z:-10.5};}continue;}
   const danger=cars.find(c=>c.kmh>15&&distance(c.position,p.position)<6);
   // A stroller mid-crossing never diverts: they hurry straight across
   // instead (see the movement pace below). A fleeing stroller stays on
   // their own pavement — never across the carriageway to the north side.
   if(danger&&p.state!=='vendor'&&p.state!=='flee'&&p.state!=='react'&&p.state!=='cross'&&this.leaveSeat(p,world,cars,player)){this.release(p);p.state='react';p.time=0;const dx=p.position.x-danger.position.x,dz=p.position.z-danger.position.z,len=Math.hypot(dx,dz)||1;p.target=p.civilianDriver?{x:p.position.x+dx/len*3,z:p.position.z+dz/len*3}:p.stroller?this.stepAsideTarget(p,danger):{x:p.position.x+(dx<0?-4:4),z:-12.8};this.alert=5;}
   if(p.state==='react'&&p.time>0.8){p.state='flee';p.time=0;}
   if(p.stroller)this.updateStroller(p,cars);
   if(p.state==='walk'){
    const queue=`queue-${p.shop}`;
    if(distance(p.position,p.target)<0.3&&this.reservations.reserve(queue,p.id)){p.state='wait';p.time=0;}
   }else if(p.state==='wait'&&p.time>2){p.state='order';p.time=0;}
   else if(p.state==='order'&&p.time>2.4){
    this.release(p);const seat=[...seats].sort((a,b)=>distance(a,p.position)-distance(b,p.position)).find(s=>this.reservations.reserve(s.id,p.id));
    if(seat){p.state='seat';p.target={x:seat.x,z:seat.z+0.7};p.waypoints=[{x:seat.x+1,z:seat.z+1.3}];p.seat=seat.id;}else {p.state='leave';p.target={x:-238+p.shop*10,z:-10.5};}p.time=0;
   }else if(p.state==='seat'&&distance(p.position,p.target)<0.3){
    const seat=seats.find(s=>s.id===p.seat)!;
    if(this.people.every(o=>o===p||distance(o.position,seat)>=0.66)&&(!player||distance(player,seat)>=0.7)&&cars.every(c=>distance(c.position,seat)>Math.hypot(c.width,c.length)/2+0.4)){p.state='drink';p.time=0;p.position={x:seat.x,z:seat.z};p.yaw=seat.yaw;}
   }
   else if(p.state==='drink'&&p.time>9&&this.leaveSeat(p,world,cars,player)){p.state='leave';this.release(p);p.target={x:-240+p.shop*8,z:-10.5};p.time=0;}
   else if((p.state==='leave'||p.state==='flee')&&!p.stroller&&(distance(p.position,p.target)<0.3||p.time>12)){
    this.release(p);if(p.civilianDriver){p.state='retreated';p.target={...p.position};}else{p.shop=(p.shop+1)%3;p.state='walk';p.target={x:shops[p.shop].x,z:-12.7};}p.time=0;
   }
   const moving=['walk','seat','leave','flee','stroll','waitCross','cross'].includes(p.state);p.speed=0;
   if(moving){
    // All market foot traffic stays on the north pavement; no arbitrary road crossings.
    if(p.waypoints.length&&distance(p.position,p.waypoints[0])<0.25)p.waypoints.shift();
    const goal=p.waypoints[0]??p.target,dx=goal.x-p.position.x,dz=goal.z-p.position.z,len=Math.hypot(dx,dz);
    if(len>0.15){
     // Crossing pedestrians hurry if a vehicle closes in; they never stop
     // or turn back on the carriageway.
     const hurrying=p.state==='cross'&&cars.some(c=>distance(c.position,p.position)<15);
     const pace=p.state==='flee'?3.4:p.state==='cross'?(hurrying?3.2:2.2):1.35,step=Math.min(len,pace*dt),heading=Math.atan2(dx,dz),side=p.num%2?1:-1;
     // First clear angle wins, in the same order as before. The old code
     // built the 7-angle array + 7 motion objects + 7 car-collider arrays
     // per moving person per frame; this loop allocates nothing itself
     // (the moveCircle result is CollisionWorld-owned — see DECISIONS.md).
     let candidate:Point|undefined;
     for(let a=0;a<AVOID_OFFSETS.length;a++){
      const angle=heading+AVOID_OFFSETS[a]*side;
      this.motionScratch.x=Math.sin(angle)*step;this.motionScratch.z=Math.cos(angle)*step;
      const next=world.moveCircle(p.position,this.motionScratch,0.3,0,carSolids);
      if(distance(next,p.position)>step*0.2&&(!p.stroller||this.strollerClear(next,p))&&!this.people.some(o=>o!==p&&distance(o.position,next)<0.63)&&(!player||distance(player,next)>=0.7)){candidate=next;break;}
     }
     if(candidate){p.speed=distance(p.position,candidate)/dt;p.yaw=Math.atan2(candidate.x-p.position.x,candidate.z-p.position.z);p.position=candidate;p.blocked=0;}else p.blocked+=dt;
    }
   }
   // Timeout clears every reservation; a blocked customer never owns a queue forever.
   if(!p.stroller&&p.state!=='vendor'&&p.state!=='retreated'&&p.time>24&&this.leaveSeat(p,world,cars,player)){this.release(p);p.state='leave';p.target={x:-240+p.shop*8,z:-10.4};p.time=0;}
   const sway=(p.state==='pause'||p.state==='waitCross'||p.state==='wait')?idleSway(p.time,p.num*1.3):0;
   p.view.group.position.set(p.position.x,PEDESTRIAN_FLOOR_OFFSET+sway,p.position.z);p.view.group.rotation.y=p.yaw;
   const anim=p.state==='vendor'?(p.shop===2?'prepare':'talk'):p.state==='drink'?(p.time<0.8?'sit_down':p.time>8?'stand':p.shop===1?'sit_smoke':'sit_drink'):p.state==='react'?'react':p.speed>0.1?(p.state==='flee'?'flee':'walk'):p.state==='order'?'talk':'wait';
   if(p.actionTime){p.actionTime=Math.max(0,p.actionTime-dt);if(!p.actionTime)p.action=undefined;}
   p.view.update(dt,p.action??anim,p.speed);
  }
 }
 private strollTarget(p:Person):Point{
  const band=p.side==='south'?SOUTH_PAVEMENT:NORTH_PAVEMENT;
  // Ping-pong between the ends of the pavement; the west end is the crossing mouth.
  return {x:p.target.x<=band.minX+1?band.maxX:band.minX,z:band.z};
 }
 /** A crossing is safe only if every vehicle is far enough away to cover the
  * ~25 m zebra at a brisk walk before it arrives: 80 m minimum, or 12 s of
  * travel for anything faster than the 6 m/s CP cruise. */
 private crossingGapClear(cars:readonly VehicleController[],point:Point=CROSSING.mid):boolean{
  return cars.every(c=>distance(c.position,point)>Math.max(80,Math.abs(c.speed)*12));
 }
 /** Hard geometric guarantee: strollers live on the two pavement bands, and
  * cross only inside the 6 m zebra corridor. No state ever targets the
  * carriageway, and no movement candidate off the pavement is accepted. */
 private strollerClear(next:Point,p:Person):boolean{
  if(p.area==='cp-ring'){const r=Math.hypot(next.x,next.z);return r>=49&&r<=56;}
  if(p.area==='mg-road'&&p.route&&p.mouth&&p.mouthOther){
   if(p.state==='cross')return segmentDistance(next,p.mouth,p.mouthOther)<=3.5;
   return segmentDistance(next,p.route.a,p.route.b)<=2.5;
  }
  if(p.state==='cross')return Math.abs(next.x-CROSSING.x)<=CROSSING_HALF_WIDTH;
  return (next.z>=-15.7&&next.z<=-9.5)||(next.z>=9.5&&next.z<=15.7);
 }
 /** Phase 4 step-aside: a fleeing stroller stays on their own footpath.
  * Market Lane keeps its old rule (same pavement z, 4 m along x); MG Road
  * steps along its pavement away from the threat; the CP ring steps along
  * the ring arc. Never across the carriageway. */
 private stepAsideTarget(p:Person,threat:VehicleController):Point{
  if(p.area==='mg-road'&&p.route)return stepAsideAlongLine(p.position,threat.position,p.route.a,p.route.b);
  if(p.area==='cp-ring')return stepAsideOnRing(p.position,threat.position,{x:0,z:0},StreetPeople.CP_RING_RADIUS);
  const dx=p.position.x-threat.position.x;
  return {x:p.position.x+(dx<0?-4:4),z:p.side==='south'?SOUTH_PAVEMENT.z:NORTH_PAVEMENT.z};
 }
 private updateStroller(p:Person,cars:readonly VehicleController[]):void{
  // Phase 4 — step aside: a car closing in (within 9 m, over 8 km/h) makes
  // a strolling pedestrian stop and wait instead of walking on; they resume
  // once the car has passed or after 2 s. A fast car inside 6 m still
  // triggers the react/flee path in update(), which overrides 'pause'.
  if(p.state==='stroll'&&cars.some(c=>c.kmh>8&&distance(c.position,p.position)<9)){p.state='pause';p.time=0;return;}
  if(p.state==='pause'){
   if(p.time>2||!cars.some(c=>c.kmh>8&&distance(c.position,p.position)<9)){p.state='stroll';p.time=0;}
   return;
  }
  if(p.area==='cp-ring'){this.updateRingStroller(p);return;}
  if(p.area==='mg-road'){this.updateMgStroller(p,cars);return;}
  // A blocked stroller turns around instead of standing on the kerb forever.
  // Never retarget mid-crossing: the corridor guard would strand them.
  if(p.state!=='cross'&&p.blocked>10){p.target=this.strollTarget(p);p.blocked=0;}
  if(p.state==='stroll'&&distance(p.position,p.target)<0.3){
   const band=p.side==='south'?SOUTH_PAVEMENT:NORTH_PAVEMENT;
   if(p.target.x<=band.minX+1){
    p.trips++;
    if(p.trips%2===1){p.state='waitCross';p.time=0;p.target={x:CROSSING.x,z:band.z};}
    else p.target=this.strollTarget(p);
   }else p.target=this.strollTarget(p);
   p.time=0;
  }else if(p.state==='waitCross'&&distance(p.position,p.target)<0.3){
   // Keep waiting at the kerb until the gap is clear; never step out into traffic.
   if(this.crossingGapClear(cars)){p.state='cross';p.time=0;p.target={x:CROSSING.x,z:p.side==='south'?NORTH_PAVEMENT.z:SOUTH_PAVEMENT.z};}
  }else if(p.state==='cross'&&distance(p.position,p.target)<0.3){
   p.side=p.side==='south'?'north':'south';p.state='stroll';p.time=0;p.target=this.strollTarget(p);
  }else if(p.state==='flee'&&(distance(p.position,p.target)<0.3||p.time>12)){
   this.release(p);p.state='stroll';p.time=0;p.target=this.strollTarget(p);
  }
 }
 /** CP ring: loop the footpath forever, ~3 m per waypoint. A blocked
  * stroller reverses direction instead of standing against a building. */
 private updateRingStroller(p:Person):void{
  const ringPoint=(angle:number):Point=>({x:Math.cos(angle)*StreetPeople.CP_RING_RADIUS,z:Math.sin(angle)*StreetPeople.CP_RING_RADIUS});
  if(p.state==='flee'&&(distance(p.position,p.target)<0.3||p.time>12)){this.release(p);p.state='stroll';p.time=0;p.angle=p.angle??0;p.target=ringPoint(p.angle+(p.ringDir??1)*0.06);return;}
  if(p.blocked>10){p.ringDir=p.ringDir===1?-1:1;p.blocked=0;p.angle=p.angle??0;p.target=ringPoint(p.angle+(p.ringDir??1)*0.06);return;}
  if(p.state==='stroll'&&distance(p.position,p.target)<0.3){
   p.angle=(p.angle??0)+(p.ringDir??1)*0.06;p.target=ringPoint(p.angle+(p.ringDir??1)*0.06);p.time=0;
  }
 }
 /** MG Road: same shape as Market Lane (ping-pong, cross on alternate
  * trips, only at the zebra, only on a clear gap), on its own pavements. */
 private strollTargetMg(p:Person):Point{
  const route=p.route!;return distance(p.target,route.a)<1?{...route.b}:{...route.a};
 }
 private updateMgStroller(p:Person,cars:readonly VehicleController[]):void{
  if(p.state!=='cross'&&p.blocked>10){p.target=this.strollTargetMg(p);p.blocked=0;}
  if(p.state==='stroll'&&distance(p.position,p.target)<0.3){
   p.trips++;
   if(p.trips%2===1&&p.mouth){p.state='waitCross';p.time=0;p.target={...p.mouth};}
   else p.target=this.strollTargetMg(p);
   p.time=0;
  }else if(p.state==='waitCross'&&p.mouth&&distance(p.position,p.target)<0.3){
   if(this.crossingGapClear(cars,p.cross!)){p.state='cross';p.time=0;p.target={...p.mouthOther!};}
  }else if(p.state==='cross'&&distance(p.position,p.target)<0.3){
   // The pedestrian is now on the far pavement: swap both the pavement
   // and the crossing mouths, or every later step would be judged against
   // the old side and the stroller would strand at the far kerb.
   const oldRoute=p.route;p.route=p.routeOther;p.routeOther=oldRoute;
   const oldMouth=p.mouth;p.mouth=p.mouthOther;p.mouthOther=oldMouth;
   p.side=p.side==='south'?'north':'south';p.state='stroll';p.time=0;p.target=this.strollTargetMg(p);
  }else if(p.state==='flee'&&(distance(p.position,p.target)<0.3||p.time>12)){
   this.release(p);p.state='stroll';p.time=0;p.target=this.strollTargetMg(p);
  }
 }
 dispose():void {this.people.forEach(p=>p.view.dispose());}
}
