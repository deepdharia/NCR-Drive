import {contactGround} from '../rendering/ContactGround';
import { HumanoidView, PEDESTRIAN_FLOOR_OFFSET } from '../people/HumanoidView';
import type { PlayerController } from './PlayerController';
export class PlayerView extends HumanoidView {
 overrideAnimation:string|undefined;
 private gaitSpeed=0;
 private gait='idle';
 private grounding=contactGround(0.9,0.65);
 constructor(){super();this.group.add(this.grounding);}

 updatePlayer(player:PlayerController,dt:number):void {
  this.group.visible=player.active;this.group.position.set(player.position.x,player.y+PEDESTRIAN_FLOOR_OFFSET,player.position.z);this.group.rotation.y=player.yaw;
  this.gaitSpeed+=(player.speed-this.gaitSpeed)*(1-Math.exp(-12*dt));
  if(this.gaitSpeed<0.08)this.gait='idle';
  else if(this.gaitSpeed>4.5)this.gait='run';
  else if(this.gaitSpeed<3.8||this.gait==='idle')this.gait='walk';
  // The decal stays on the pavement while jumping; never rides under the feet.
  this.grounding.position.y=0.041-player.y-PEDESTRIAN_FLOOR_OFFSET;
  this.grounding.visible=player.y<1.8;
  super.update(dt,this.overrideAnimation??this.gait,this.gaitSpeed);
 }
}
