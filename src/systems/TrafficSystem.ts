import { VehicleController } from '../vehicle/VehicleController';
import { CollisionWorld } from '../core/CollisionWorld';
import type { Solid } from '../core/CollisionWorld';
import type { Point } from '../core/math';
import { distance, angleDelta } from '../core/math';
import { lanes, successors, destinations, junctionById } from '../world/WorldRoads';
import type { Lane } from '../world/WorldRoads';
import { planTrafficMix, cruiseSpeed, honkCooldown, activeRadiusForQuality, turnIndicator, indicatorLit } from './TrafficBehaviour';
import type { TrafficKind, IndicatorSide } from './TrafficBehaviour';
import type { VehicleBodyKind } from './TrafficBehaviour';
import type { QualityPreset } from '../rendering/QualityProfile';

/** Fixed-size local population. Closest-arrival reservations at outer junctions; never recycle near focus. */
export class TrafficSystem {
 readonly cars:VehicleController[]=[];
 /** Phase 4: what each car is (car / auto / bike / bus / truck) and which
  * Phase 3 body silhouette it takes. Parallel arrays, indexed like `cars`. */
 readonly trafficKinds:TrafficKind[]=[];
 readonly bodyKinds:VehicleBodyKind[]=[];
 /** Phase 4: indicator side per car, set when the car approaches a turn.
  * Read via indicatorFor(); the meshes are owned by VehicleView /
  * VehicleBodies — see TrafficBehaviour.driveIndicatorBlinker for the
  * hook the coordinator wires up. */
 private indicators:IndicatorSide[]=[];
 private quality:QualityPreset='balanced';
 private activeRadius=450;
 private paths:Lane[]=[];
 private entering:boolean[]=[];
 private progress:number[]=[];
 private stuck:number[]=[];
 private blocked:number[]=[];
 private waiting:number[]=[];
 private lastHonk:number[]=[];
 private honkUntil:number[]=[];
 private tick=0;
 private nextRecycle=0;
 private reservations=new Map<string,number>();
 private reservationSince=new Map<string,number>();
 /** Called when a nearby blocked car sounds its horn; the coordinator wires it to StreetAudio.horn(). */
 onHonk?: () => void;
 /** Phase 5: denser traffic — 12 by default, capped at 14 — with trucks and
  * buses in the mix (TRAFFIC_SPECS round-robin: 2 trucks + 2 buses per 12).
  * Cruise speed, creep/honk and the reservation/deadlock logic are owned by
  * Phase 1 and are left exactly as-is here.
  * Phase 4: `opts.mixed` switches the roster to the mixed plan
  * (cars + autos + bikes + buses + trucks, TrafficBehaviour.planTrafficMix);
  * the default stays the legacy roster so existing behaviour and tests do
  * not change. `opts.quality` sets the constructor-time density tier; call
  * applyQuality() afterwards to change tier live (it only moves the
  * hold radius — the roster size is fixed at construction). */
 constructor(count=12, opts:{quality?:QualityPreset;mixed?:boolean}={}){
  count=Math.max(0,Math.min(14,Math.floor(count)));
  this.quality=opts.quality??'balanced';this.activeRadius=activeRadiusForQuality(this.quality);
  const plan=planTrafficMix(count,opts.mixed?'mixed':'legacy');
  for(let i=0;i<count;i++){
   // The two cars sharing a ring segment must oppose: the old i%2 direction
   // put same-direction duplicates on one lane once count passed 6.
   const lane=lanes.find(l=>l.id===`cp-ring-${(Math.floor((i+0.5)/Math.ceil(count/2)*72)+6)%72}:${Math.floor(i/Math.ceil(count/2))%2?'back':'out'}`)!;
   const entry=plan[i];
   const car=new VehicleController(entry.spec);car.position={...lane.start};car.yaw=Math.atan2(lane.end.x-lane.start.x,lane.end.z-lane.start.z);
   car.owner='ai';car.occupant=`driver-${car.id}`;this.cars.push(car);this.trafficKinds.push(entry.kind);this.bodyKinds.push(entry.bodyKind);this.indicators.push('none');this.paths.push(lane);this.entering.push(false);this.progress.push(0);this.stuck.push(0);this.blocked.push(0);this.waiting.push(0);this.lastHonk.push(-99);this.honkUntil.push(-1);
  }
 }
 /** Phase 4: live quality tier. Only the hold radius moves (low 350 /
  * balanced 450 / high 550 m) — roster size is fixed at construction and
  * the hard cap of 14 is never raised. */
 applyQuality(quality:QualityPreset):void{this.quality=quality;this.activeRadius=activeRadiusForQuality(quality);}
 get currentQuality():QualityPreset{return this.quality;}
 /** Phase 4: indicator state for car `i` — the side it is signalling and
  * whether the lamp is in the lit half of its 1 Hz blink right now. */
 indicatorFor(i:number):{side:IndicatorSide;lit:boolean}{
  const side=this.indicators[i]??'none';
  return {side,lit:indicatorLit(side,this.tick)};
 }
 update(dt:number,world:CollisionWorld,obstacles:readonly Solid[],focus?:Point):void{
  this.tick+=dt;
  const recycle=this.tick>=this.nextRecycle;
  if(recycle)this.nextRecycle=this.tick+1;
  // Reservation leases: a holder that makes no progress through the junction
  // for 8 s (blocked ahead, or wedged at an acute junction) loses the lease,
  // so the waiter behind it is not stuck forever behind a car that cannot move.
  for(const [id,since] of this.reservationSince)if(this.tick-since>8){this.reservations.delete(id);this.reservationSince.delete(id);}
  for(const [id,owner] of this.reservations)if(this.cars[owner].owner!=='ai'||this.cars[owner].reserved||(this.paths[owner].from===id&&distance(this.cars[owner].position,junctionById.get(id)!)>28)||(this.paths[owner].from!==id&&this.paths[owner].to!==id)){this.reservations.delete(id);this.reservationSince.delete(id);}
  this.cars.forEach((car,i)=>{
   if(car.owner!=='ai'||car.reserved){if(car.owner==='ai')car.speed=0;return;}
   let lane=this.paths[i];
   // Recycle only beyond the visible neighbourhood; at most one attempt/car/second.
   if(focus && recycle && !car.protected && distance(car.position,focus)>650){
    const candidates=lanes.filter(l=>distance(l.start,focus)>300&&distance(l.start,focus)<500&&l.length>35&&destinations.every(d=>distance(d,l.start)>40));
    const next=candidates[(i*7+Math.floor(this.tick))%candidates.length];
    if(next && obstacles.every(o=>distance(o,next.start)>35) && this.cars.every(c=>c===car||distance(c.position,next.start)>25) && world.boxIsClear({...next.start,yaw:Math.atan2(next.end.x-next.start.x,next.end.z-next.start.z)},car.width+2,car.length+12,obstacles)){
     lane=next;this.paths[i]=next;this.entering[i]=false;this.progress[i]=0;car.position={...next.start};this.stuck[i]=0;
    }
   }
   if(focus&&distance(car.position,focus)>this.activeRadius){car.speed=0;return;}
   const others=[...obstacles,...this.cars.filter(c=>c!==car).map(c=>c.collider)];
   const target=lane.end,remaining=distance(car.position,target);
   // Phase 4: signal the turn before taking it. The next lane is the same
   // deterministic pick the lane-change block below will take, so the
   // indicator and the turn can never disagree. Only computed while the
   // car is close to the lane end; straight-on shows nothing.
   if(remaining<25&&!this.entering[i]){
    const legal=successors(lane),onward=legal.filter(l=>l.road.id!==lane.road.id),options=onward.length?onward:legal;
    const next=options[(i+Math.floor(this.progress[i]))%options.length];
    const currentYaw=Math.atan2(lane.end.x-lane.start.x,lane.end.z-lane.start.z);
    const nextYaw=Math.atan2(next.end.x-next.start.x,next.end.z-next.start.z);
    this.indicators[i]=turnIndicator(currentYaw,nextYaw);
   } else if(remaining>=25) this.indicators[i]='none';
   // Reserve before entry, rather than yielding after occupying the junction.
   // Short CP curve samples use collision following; outer junctions have room
   // to stage 22m back. The closest arrival wins, with stable index tie-breaking.
   if(lane.road.region!=='delhi' && !this.entering[i] && remaining<22){
    if(!this.reservations.has(lane.to)){
     const node=junctionById.get(lane.to)!;
     const candidates=this.cars.map((c,index)=>({index,d:distance(c.position,node)}))
      .filter(c=>this.cars[c.index].owner==='ai'&&!this.cars[c.index].reserved&&this.stuck[c.index]<3).filter(c=>(this.paths[c.index].to===lane.to&&c.d<45)||(this.paths[c.index].from===lane.to&&c.d<20))
      .sort((a,b)=>a.d-b.d||a.index-b.index);
     if(candidates[0]){this.reservations.set(lane.to,candidates[0].index);this.reservationSince.set(lane.to,this.tick);}
     else {this.reservations.set(lane.to,i);this.reservationSince.set(lane.to,this.tick);}
    }
    if(this.reservations.get(lane.to)!==i){
     // Bounded wait: after 12 s the waiter takes the junction rather than
     // deadlocking behind a holder that can never clear it.
     this.waiting[i]+=dt;
     if(this.waiting[i]>12){this.reservations.set(lane.to,i);this.reservationSince.set(lane.to,this.tick);this.waiting[i]=0;}
     else {car.braking=true;car.speed=0;car.honking=this.tick<this.honkUntil[i];return;}
    } else this.waiting[i]=0;
   }
   if(!this.entering[i] && remaining<0.2){
    const legal=successors(lane),onward=legal.filter(l=>l.road.id!==lane.road.id),options=onward.length?onward:legal;const next=options[(i+Math.floor(this.progress[i]))%options.length];
    this.paths[i]=next;this.entering[i]=true;this.progress[i]++;lane=next;
   }
   if(this.entering[i] && distance(car.position,lane.start)<=0.2)this.entering[i]=false;
   const towards=this.entering[i]?lane.start:lane.end;
   // Highways run at highway speed; CP streets stay slow, city mains sit between.
   // Per-car spread (20–24 m/s ≈ 72–86 km/h) keeps highway platoons from
   // moving in lockstep. Phase 4: kind-varied cruise (autos / bikes slower
   // than cars, heavies slower still) via TrafficBehaviour.cruiseSpeed,
   // always capped by the spec's maxSpeed.
   const cruise=cruiseSpeed(this.trafficKinds[i],lane,i,car.spec.maxSpeed);
   const len=distance(car.position,towards);if(len<0.001)return;
   const yaw=Math.atan2(towards.x-car.position.x,towards.z-car.position.z),travel=Math.min(cruise*dt,len),dx=(towards.x-car.position.x)/len,dz=(towards.z-car.position.z)/len;
   // Never project a probe past the turn endpoint into a roadside rail.
   // Physical body size avoids treating a following car as a rear obstruction.
   const look=Math.min(len,Math.max(6,cruise*0.8));
   const clear=world.boxIsClear({x:car.position.x+dx*look,z:car.position.z+dz*look,yaw},car.width,car.length,others);
   const move=clear?world.moveBox({...car.position,yaw:car.yaw},{x:dx*travel,z:dz*travel},angleDelta(car.yaw,yaw),car.width,car.length,others):null;
   car.braking=!move||move.hit;
   if(move&&!move.hit){car.position={x:move.pose.x,z:move.pose.z};car.yaw=move.pose.yaw;car.wheelTravel+=travel;this.stuck[i]=0;this.blocked[i]=0;this.waiting[i]=0;car.speed=cruise;}
   else {
    // Blocked: creep forward at walking pace when a short step is clear
    // (traffic inches through congestion instead of planting), and honk if
    // the blockage persists — but only when the player can actually hear it.
    this.blocked[i]+=dt;
    const creep=world.moveBox({...car.position,yaw:car.yaw},{x:dx*1.4*dt,z:dz*1.4*dt},angleDelta(car.yaw,yaw)*0.5,car.width,car.length,others);
    if(!creep.hit){car.position={x:creep.pose.x,z:creep.pose.z};car.yaw=creep.pose.yaw;car.speed=1.4;car.wheelTravel+=1.4*dt;this.stuck[i]=0;}
    else {car.speed=0;this.stuck[i]=Math.min(30,this.stuck[i]+dt);}
    if(this.blocked[i]>2&&this.tick-this.lastHonk[i]>honkCooldown(this.trafficKinds[i])&&focus&&distance(car.position,focus)<120){
     this.lastHonk[i]=this.tick;this.honkUntil[i]=this.tick+0.6;car.honking=true;this.onHonk?.();
    }
   }
   car.honking=car.honking&&this.tick<this.honkUntil[i];
   // Blocked nearby traffic waits. Distant blocked cars become eligible for safe recycling.
   if(!car.protected&&recycle&&focus&&this.stuck[i]>=30&&distance(car.position,focus)>650){const candidate=lanes.find(l=>distance(l.start,focus)>300&&distance(l.start,focus)<500&&destinations.every(d=>distance(d,l.start)>40)&&world.boxIsClear({...l.start,yaw:0},car.width+3,car.length+15,others));if(candidate){this.paths[i]=candidate;this.entering[i]=false;car.yaw=Math.atan2(candidate.end.x-candidate.start.x,candidate.end.z-candidate.start.z);car.position={...candidate.start};this.stuck[i]=0;}}
  });
 }
}
