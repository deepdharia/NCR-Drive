import { VehicleController } from '../vehicle/VehicleController';
import { VEHICLE_SPECS } from '../vehicle/VehicleSpec';
import { CollisionWorld } from '../core/CollisionWorld';
import type { Solid } from '../core/CollisionWorld';
import type { Point } from '../core/math';
import { distance, angleDelta } from '../core/math';
import { lanes, successors, projection, destinations } from '../world/WorldRoads';
import type { Lane } from '../world/WorldRoads';

/** Fixed-size local population. Stable index priority at junctions; never recycle near focus. */
export class TrafficSystem {
 readonly cars:VehicleController[]=[];
 private paths:Lane[]=[];
 private progress:number[]=[];
 private stuck:number[]=[];
 private tick=0;
 constructor(count=6){
  count=Math.max(0,Math.min(10,Math.floor(count)));
  for(let i=0;i<count;i++){
   const lane=lanes.find(l=>l.id===`cp-ring-${(Math.floor((i+0.5)/Math.ceil(count/2)*72)+6)%72}:${i%2?'back':'out'}`)!;
   const car=new VehicleController(VEHICLE_SPECS[i%3]);car.position={...lane.start};car.yaw=Math.atan2(lane.end.x-lane.start.x,lane.end.z-lane.start.z);
   this.cars.push(car);this.paths.push(lane);this.progress.push(0);this.stuck.push(0);
  }
 }
 update(dt:number,world:CollisionWorld,obstacles:readonly Solid[],focus?:Point):void{
  this.tick+=dt;
  this.cars.forEach((car,i)=>{
   let lane=this.paths[i];
   // Recycle only beyond the visible neighbourhood, at most one candidate per second.
   if(focus && this.tick>1 && distance(car.position,focus)>650){
    const candidates=lanes.filter(l=>distance(l.start,focus)>300&&distance(l.start,focus)<500&&l.length>35&&destinations.every(d=>distance(d,l.start)>40));
    const next=candidates[(i*7+Math.floor(this.tick))%candidates.length];
    if(next && obstacles.every(o=>distance(o,next.start)>35) && this.cars.every(c=>c===car||distance(c.position,next.start)>25) && world.boxIsClear({...next.start,yaw:Math.atan2(next.end.x-next.start.x,next.end.z-next.start.z)},car.width+2,car.length+12,obstacles)){
     lane=next;this.paths[i]=next;this.progress[i]=0;car.position={...next.start};this.stuck[i]=0;
    }
   }
   if(focus&&distance(car.position,focus)>650){car.speed=0;return;}
   const others=[...obstacles,...this.cars.filter(c=>c!==car).map(c=>c.collider)];
   const target=lane.end,remaining=distance(car.position,target);
   if(remaining<0.2){
    const options=successors(lane);const next=options[(i+Math.floor(this.progress[i]))%options.length];
    // First car in stable index order wins; reserve enough space to clear the turn.
    if(this.cars.some((c,j)=>j<i&&distance(c.position,lane.end)<12)){car.speed=0;return;}
    this.paths[i]=next;this.progress[i]++;lane=next;
   }
   const towards=distance(car.position,lane.start)>0.2&&projection(car.position,lane.start,lane.end).t<0.001?lane.start:lane.end;
   const len=distance(car.position,towards);if(len<0.001)return;
   const yaw=Math.atan2(towards.x-car.position.x,towards.z-car.position.z),travel=Math.min(6*dt,len),dx=(towards.x-car.position.x)/len,dz=(towards.z-car.position.z)/len;
   const clear=world.boxIsClear({x:car.position.x+dx*6,z:car.position.z+dz*6,yaw},car.width+0.4,car.length+2,others);
   const move=clear?world.moveBox({...car.position,yaw:car.yaw},{x:dx*travel,z:dz*travel},angleDelta(car.yaw,yaw),car.width,car.length,others):null;
   car.braking=!move||move.hit;car.speed=car.braking?0:6;
   if(move&&!move.hit){car.position={x:move.pose.x,z:move.pose.z};car.yaw=move.pose.yaw;car.wheelTravel+=travel;this.stuck[i]=0;}else this.stuck[i]=Math.min(30,this.stuck[i]+dt);
   // Blocked nearby traffic waits. Distant blocked cars become eligible for safe recycling.
   if(focus&&this.stuck[i]>=30&&distance(car.position,focus)>650){const candidate=lanes.find(l=>distance(l.start,focus)>300&&distance(l.start,focus)<500&&destinations.every(d=>distance(d,l.start)>40)&&world.boxIsClear({...l.start,yaw:0},car.width+3,car.length+15,others));if(candidate){this.paths[i]=candidate;car.position={...candidate.start};this.stuck[i]=0;}}
  });
 }
}
