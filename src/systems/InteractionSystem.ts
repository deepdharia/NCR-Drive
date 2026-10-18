import { distance, localToWorld } from '../core/math';
import type { Point } from '../core/math';
import type { CollisionWorld, Solid } from '../core/CollisionWorld';
import type { PlayerController } from '../player/PlayerController';
import type { VehicleController } from '../vehicle/VehicleController';

/** All ordinary vehicles share this exclusive seat/control transfer protocol.
 * A transition reserves AI ownership, then revalidates clearance before commit. */
export class InteractionSystem {
 message=''; private transition: {car:VehicleController;exit:boolean;time:number;occupant:string|null}|undefined;
 onDisplaced: (id:string,position:Point)=>void=()=>{};
 onTransferred:()=>void=()=>{};
 constructor(readonly player:PlayerController,public car:VehicleController,private world:CollisionWorld,private obstacles:()=>readonly Solid[]=()=>[]){}
 get busy():boolean{return !!this.transition;}
 get animation():string|undefined{return this.transition?(this.transition.exit?'exit':this.transition.occupant?'takeover':'enter'):undefined;}
 get driving():boolean{return this.car.driving;}
 get door():Point{return localToWorld({x:-this.car.width/2-0.8,z:0.35},this.car.position,this.car.yaw);}
 get available():boolean {return !this.busy&&(this.driving?this.car.kmh<15:this.car.kmh<2&&this.player.grounded&&distance(this.player.position,this.door)<2.2);}
 get prompt():string {if(this.busy)return 'Opening door…';if(this.message)return this.message;if(this.driving)return this.available?'Press F · Exit vehicle':'Slow below 15 km/h to exit';return this.available?(this.car.occupant?'Press F · Take civilian car':'Press F · Enter vehicle'):'Explore Market Lane · Follow DelhiNav';}
 private clear():boolean {return this.world.isClear(this.door,0.42,0,1.8,[...this.obstacles(),this.car.collider]);}
 interact():boolean {
  this.message='';if(!this.available)return false;
  if(!this.clear()){this.message='Door blocked. Find a clear space.';return false;}
  this.transition={car:this.car,exit:this.driving,time:0,occupant:this.car.occupant};this.car.reserved=true;this.car.speed=0;this.player.speed=0;return true;
 }
 cancel():void {if(this.transition){this.transition.car.reserved=false;this.transition.car.doorOpen=0;this.transition=undefined;}}
 update(dt:number):void {
  const t=this.transition;if(!t)return;
  t.time+=dt;t.car.doorOpen=Math.sin(Math.min(1,t.time/1.1)*Math.PI);
  if(t.time<1.1)return;
  if(this.car!==t.car||!this.clear()||(!t.exit&&this.car.occupant!==t.occupant)){this.cancel();this.message='Entry interrupted. Door clearance changed.';return;}
  if(t.exit){this.car.occupant=null;this.car.owner='parked';this.car.setDriving(false);this.player.teleport(this.door);this.player.setActive(true);}
  else {
   if(t.occupant)this.onDisplaced(t.occupant,{...this.door});
   this.car.owner='player';this.car.occupant='player';this.car.protected=true;this.car.setDriving(true);this.player.setActive(false);
  }
  this.cancel();this.onTransferred();
 }
}
