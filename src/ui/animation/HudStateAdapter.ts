import type {PlayerController} from '../../player/PlayerController';
import type {VehicleController} from '../../vehicle/VehicleController';
export type HudCue = 'mode'|'success'|'warning'|'brake'|'reverse'|'jump'|'sprint'|'interaction';
export type FeedbackKind = 'neutral'|'success'|'warning'|'reward';
export function hudState(player:PlayerController,car:VehicleController,reverseSelected=false,seated=false) {
  return {driving:car.driving,speed:Math.round(car.kmh),arc:Math.min(1,car.kmh/160),
    gear:car.speed < -0.1 ? 'R' : Math.abs(car.speed)<0.1 ? (reverseSelected?'R':'N') : 'D',
    braking:car.driving&&car.braking,
    movement:seated?'SEATED':!player.grounded?'AIRBORNE':player.speed>4?'SPRINTING':player.speed>0.05?'WALKING':'ON FOOT'};
}
/** Only committed controller changes emit presentation cues. No simulation writes. */
export class HudStateAdapter {
  private previous?:ReturnType<typeof hudState>;
  update(state:ReturnType<typeof hudState>):HudCue[] {
    const p=this.previous; this.previous=state;
    if(!p)return [];
    if(p.driving!==state.driving)return ['mode'];
    if(state.braking&&!p.braking)return ['brake'];
    if(state.gear==='R'&&p.gear!=='R'&&state.driving)return ['reverse'];
    if(state.movement!==p.movement&&!state.driving){
      if(state.movement==='AIRBORNE')return ['jump'];
      if(state.movement==='SPRINTING')return ['sprint'];
    }
    return [];
  }
}

/** Bearing to the next point on the nearest route segment, never the cached start behind us. */
export function routeDirection(position:{x:number;z:number},yaw:number,route:readonly {x:number;z:number}[]):number|undefined {
  let nearest=Infinity,next:{x:number;z:number}|undefined;
  for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i],dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;
    if(length<0.0001)continue;
    const t=Math.max(0,Math.min(1,((position.x-a.x)*dx+(position.z-a.z)*dz)/length));
    const distance=Math.hypot(position.x-a.x-t*dx,position.z-a.z-t*dz);
    if(distance<=nearest){nearest=distance;next=b;}
  }
  if(!next||Math.hypot(next.x-position.x,next.z-position.z)<0.1)return undefined;
  return Math.atan2(next.x-position.x,next.z-position.z)-yaw;
}
