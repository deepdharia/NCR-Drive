import { HumanoidView, PEDESTRIAN_FLOOR_OFFSET } from './HumanoidView';
import { Reservations, seats, shops } from '../systems/Neighborhood';
import { distance } from '../core/math';
import type { Point } from '../core/math';
import type { CollisionWorld, Solid } from '../core/CollisionWorld';
import type { VehicleController } from '../vehicle/VehicleController';
import * as THREE from 'three';
type State='walk'|'wait'|'order'|'seat'|'drink'|'leave'|'react'|'flee'|'vendor'|'retreated';
interface Person {id:string;position:Point;view:HumanoidView;state:State;time:number;shop:number;target:Point;speed:number;yaw:number;seat?:string;waypoints:Point[];blocked:number;action?:string;actionTime?:number;civilianDriver?:boolean}
/** Ten permanent adults, no camera-facing spawn/recycle. Bounded reservations and timers. */
export class StreetPeople {
 readonly group=new THREE.Group();readonly reservations=new Reservations();readonly people:Person[]=[];alert=0;
 constructor(scene:THREE.Scene){scene.add(this.group);for(let i=0;i<10;i++){
  const vendor=i<3,shop=i%3,position=vendor?{x:shops[shop].x,z:-17.6}:{x:-146-(i-3)*13,z:-10.5};
  const view=new HumanoidView([0xa17243,0x617e87,0xa86856,0x657c49,0x8e7892][i%5]);this.group.add(view.group);view.group.position.set(position.x,PEDESTRIAN_FLOOR_OFFSET,position.z);view.update(0.2,vendor?'talk':'idle');
  this.people.push({id:`market-adult-${i}`,position,view,state:vendor?'vendor':'walk',time:0,shop,target:vendor?position:{x:shops[shop].x,z:-12.7},speed:0,yaw:0,waypoints:[],blocked:0});
 }}
 serve(shop:number):void {const vendor=this.people[shop];vendor.action='handover';vendor.actionTime=1.2;}
 get colliders():Solid[]{return this.people.filter(p=>p.state!=='vendor').map(p=>({...p.position,width:0.6,depth:0.6,height:1.75,yaw:0}));}
 displace(id:string,point:Point,target:Point={x:point.x-3,z:point.z}):void {
  if(this.people.some(p=>p.id===id))return;
  const view=new HumanoidView(0x877f63);view.group.scale.setScalar(0.93);this.group.add(view.group);this.people.push({id,position:{...point},view,state:'flee',time:0,shop:0,target:{...target},civilianDriver:true,speed:0,yaw:0,waypoints:[],blocked:0});this.alert=8;
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
  for(const p of this.people){
   p.time+=dt;p.view.group.visible=distance(p.position,focus)<100;if(!p.view.group.visible){if(p.civilianDriver){this.release(p);p.state='retreated';p.time=0;p.target={...p.position};}else if(p.state!=='vendor'&&this.leaveSeat(p,world,cars,player)){this.release(p);p.state='leave';p.time=0;p.target={x:-238+p.shop*8,z:-10.5};}continue;}
   const danger=cars.find(c=>c.kmh>15&&distance(c.position,p.position)<6);
   if(danger&&p.state!=='vendor'&&p.state!=='flee'&&p.state!=='react'&&this.leaveSeat(p,world,cars,player)){this.release(p);p.state='react';p.time=0;const dx=p.position.x-danger.position.x,dz=p.position.z-danger.position.z,len=Math.hypot(dx,dz)||1;p.target=p.civilianDriver?{x:p.position.x+dx/len*3,z:p.position.z+dz/len*3}:{x:p.position.x+(dx<0?-4:4),z:-12.8};this.alert=5;}
   if(p.state==='react'&&p.time>0.8){p.state='flee';p.time=0;}
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
   else if((p.state==='leave'||p.state==='flee')&&(distance(p.position,p.target)<0.3||p.time>12)){
    this.release(p);if(p.civilianDriver){p.state='retreated';p.target={...p.position};}else{p.shop=(p.shop+1)%3;p.state='walk';p.target={x:shops[p.shop].x,z:-12.7};}p.time=0;
   }
   const moving=['walk','seat','leave','flee'].includes(p.state);p.speed=0;
   if(moving){
    // All market foot traffic stays on the north pavement; no arbitrary road crossings.
    if(p.waypoints.length&&distance(p.position,p.waypoints[0])<0.25)p.waypoints.shift();
    const goal=p.waypoints[0]??p.target,dx=goal.x-p.position.x,dz=goal.z-p.position.z,len=Math.hypot(dx,dz);
    if(len>0.15){
     const pace=p.state==='flee'?3.4:1.35,step=Math.min(len,pace*dt),heading=Math.atan2(dx,dz),side=Number(p.id.match(/\d+$/)?.[0]??0)%2?1:-1;
     const angles=[0,0.7*side,-0.7*side,1.3*side,-1.3*side,1.7*side,-1.7*side];
     const candidate=angles.map(angle=>{const motion={x:Math.sin(heading+angle)*step,z:Math.cos(heading+angle)*step};return world.moveCircle(p.position,motion,0.3,0,cars.map(c=>c.collider));}).find(next=>distance(next,p.position)>step*0.2&&!this.people.some(o=>o!==p&&distance(o.position,next)<0.63)&&(!player||distance(player,next)>=0.7));
     if(candidate){p.speed=distance(p.position,candidate)/dt;p.yaw=Math.atan2(candidate.x-p.position.x,candidate.z-p.position.z);p.position=candidate;p.blocked=0;}else p.blocked+=dt;
    }
   }
   // Timeout clears every reservation; a blocked customer never owns a queue forever.
   if(p.state!=='vendor'&&p.state!=='retreated'&&p.time>24&&this.leaveSeat(p,world,cars,player)){this.release(p);p.state='leave';p.target={x:-240+p.shop*8,z:-10.4};p.time=0;}
   p.view.group.position.set(p.position.x,PEDESTRIAN_FLOOR_OFFSET,p.position.z);p.view.group.rotation.y=p.yaw;
   const anim=p.state==='vendor'?(p.shop===2?'prepare':'talk'):p.state==='drink'?(p.time<0.8?'sit_down':p.time>8?'stand':p.shop===1?'sit_smoke':'sit_drink'):p.state==='react'?'react':p.speed>0.1?(p.state==='flee'?'flee':'walk'):p.state==='order'?'talk':'wait';
   if(p.actionTime){p.actionTime=Math.max(0,p.actionTime-dt);if(!p.actionTime)p.action=undefined;}
   p.view.update(dt,p.action??anim,p.speed);
  }
 }
 dispose():void {this.people.forEach(p=>p.view.dispose());}
}
