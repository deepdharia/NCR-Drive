import { HumanoidView, PEDESTRIAN_FLOOR_OFFSET } from '../people/HumanoidView';
import type { PlayerController } from './PlayerController';
export class PlayerView extends HumanoidView {
 overrideAnimation:string|undefined;
 updatePlayer(player:PlayerController,dt:number):void {
  this.group.visible=player.active;this.group.position.set(player.position.x,player.y+PEDESTRIAN_FLOOR_OFFSET,player.position.z);this.group.rotation.y=player.yaw;
  super.update(dt,this.overrideAnimation??(player.speed>4?'run':player.speed>0.05?'walk':'idle'),player.speed);
 }
}
