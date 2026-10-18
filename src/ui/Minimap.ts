import type { Point } from '../core/math';
import { roads, ends, destinations, regionLabels, regionAt } from '../world/WorldRoads';
/** Overview projection constants (shared by the canvas and its click handler). */
export const MAP_SIZE = 480;
export const OVERVIEW_ORIGIN = { x: 550, z: 1000 };
export const OVERVIEW_SCALE = 0.072;
/** Convert a click pixel on the overview canvas (0..480) to a world point. */
export function overviewClickToWorld(px: number, pz: number): Point {
  return { x: OVERVIEW_ORIGIN.x + (px - MAP_SIZE / 2) / OVERVIEW_SCALE, z: OVERVIEW_ORIGIN.z + (pz - MAP_SIZE / 2) / OVERVIEW_SCALE };
}
export class Minimap {
 private context:CanvasRenderingContext2D;
 constructor(canvas:HTMLCanvasElement,private overview=false){canvas.width=canvas.height=480;const c=canvas.getContext('2d');if(!c)throw Error('DelhiNav needs Canvas 2D');this.context=c;}
 draw(position:Point,yaw:number,car:Point,target?:Point,route:Point[]=[],pickup=false):void{
  const ctx=this.context,scale=this.overview?0.072:1.15,origin=this.overview?{x:550,z:1000}:position;
  const project=(p:Point)=>({x:240+(p.x-origin.x)*scale,z:240+(p.z-origin.z)*scale});
  ctx.fillStyle='#203b35';ctx.fillRect(0,0,480,480);
  const river=project({x:1225,z:-1200});ctx.fillStyle='#386977';ctx.fillRect(river.x,river.z,300*scale,2400*scale);
  ctx.lineCap='round';
  for(const road of roads){const [a,b]=ends(road),p=project(a),q=project(b);ctx.strokeStyle=road.bridge?'#d0c3a0':'#79867b';ctx.lineWidth=Math.max(this.overview?2:4,road.width*scale);ctx.beginPath();ctx.moveTo(p.x,p.z);ctx.lineTo(q.x,q.z);ctx.stroke();}
  if(route.length){ctx.strokeStyle=pickup?'#71cce5':'#f1c369';ctx.lineWidth=this.overview?3:4;ctx.beginPath();route.forEach((p,i)=>{const q=project(p);if(i)ctx.lineTo(q.x,q.z);else ctx.moveTo(q.x,q.z);});ctx.stroke();}
  const marker=(p:Point,color:string,size:number)=>{const q=project(p),x=Math.max(12,Math.min(468,q.x)),z=Math.max(40,Math.min(455,q.z));ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,z,size,0,Math.PI*2);ctx.fill();};
  destinations.forEach(d=>marker(d,'#a4c9af',3));marker(car,'#d3d9c5',4);if(target)marker(target,pickup?'#71cce5':'#f1c369',8);
  const p=project(position);ctx.save();ctx.translate(p.x,p.z);ctx.rotate(Math.PI-yaw);ctx.fillStyle='#ffe3a5';ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(7,8);ctx.lineTo(0,4);ctx.lineTo(-7,8);ctx.fill();ctx.restore();
  ctx.fillStyle='#eee3c7';ctx.font='15px sans-serif';ctx.textAlign='center';ctx.fillText(this.overview?'NCR · REGIONAL OVERVIEW':regionLabels[regionAt(position)],240,25);
  if(this.overview)for(const [text,p] of [['DELHI',{x:0,z:0}],['GURGAON',{x:-2100,z:2100}],['NOIDA',{x:3200,z:250}]] as const){const q=project(p);ctx.fillText(text,q.x,q.z-17);}
  ctx.font='12px sans-serif';ctx.fillText(this.overview?'Fictional geography · N ↑':'N ↑   •   edge dots point toward distant stops',240,472);
 }
}
