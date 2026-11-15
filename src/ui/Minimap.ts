import type { Point } from '../core/math';
import { roads, ends, destinations, regionLabels, regionAt } from '../world/WorldRoads';
import { CITY_ANCHORS, YAMUNA_RIVER, JUNCTIONS, ARAVALLI_RIDGE } from '../world/RealNcrRoads';
import { CLUSTER_PLACES, PLACE_CATEGORY_COLORS } from '../world/ClusterData';
/** Overview projection constants (shared by the canvas and its click handler).
 * The real-NCR network spans x −3150…3350, z −2850…2900; at 0.072 the whole
 * of it fits the 480 px overview, centred on (100, 25). */
export const MAP_SIZE = 480;
export const OVERVIEW_ORIGIN = { x: 100, z: 25 };
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
  if(this.overview){
    // Subtle Aravalli ridge zone tint, SW (terrain, not road).
    ctx.fillStyle='rgba(122,128,96,0.30)';ctx.beginPath();
    for(let i=0;i<ARAVALLI_RIDGE.polygon.length;i++){const q=project(ARAVALLI_RIDGE.polygon[i]);if(i)ctx.lineTo(q.x,q.z);else ctx.moveTo(q.x,q.z);}
    ctx.closePath();ctx.fill();
  }
  // Yamuna, N–S along the eastern edge of Delhi, from the real polyline.
  ctx.strokeStyle='#386977';ctx.lineCap='round';ctx.lineWidth=this.overview?11:30;ctx.beginPath();
  YAMUNA_RIVER.forEach((p,i)=>{const q=project(p);if(i)ctx.lineTo(q.x,q.z);else ctx.moveTo(q.x,q.z);});ctx.stroke();
  ctx.lineCap='round';
  // Highways read brighter and slightly wider than main roads.
  for(const road of roads){const [a,b]=ends(road),p=project(a),q=project(b);ctx.strokeStyle=road.bridge?'#d0c3a0':road.kind==='highway'?'#9db3a2':'#79867b';ctx.lineWidth=Math.max(this.overview?(road.kind==='highway'?2.5:2):(road.kind==='highway'?5:4),road.width*scale);ctx.beginPath();ctx.moveTo(p.x,p.z);ctx.lineTo(q.x,q.z);ctx.stroke();}
  if(this.overview){ctx.fillStyle='#efe6c8';for(const j of JUNCTIONS){const q=project(j);ctx.beginPath();ctx.arc(q.x,q.z,2.5,0,Math.PI*2);ctx.fill();}}
  if(route.length){ctx.strokeStyle=pickup?'#71cce5':'#f1c369';ctx.lineWidth=this.overview?3:4;ctx.beginPath();route.forEach((p,i)=>{const q=project(p);if(i)ctx.lineTo(q.x,q.z);else ctx.moveTo(q.x,q.z);});ctx.stroke();}
  const marker=(p:Point,color:string,size:number)=>{const q=project(p),x=Math.max(12,Math.min(468,q.x)),z=Math.max(40,Math.min(455,q.z));ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,z,size,0,Math.PI*2);ctx.fill();};
  destinations.forEach(d=>marker(d,'#a4c9af',3));
  for (const place of CLUSTER_PLACES) { const q = project(place.arrival), x = Math.max(12, Math.min(468, q.x)), z = Math.max(40, Math.min(455, q.z)); ctx.fillStyle = PLACE_CATEGORY_COLORS[place.category]; ctx.beginPath(); ctx.moveTo(x, z - 6); ctx.lineTo(x + 5, z); ctx.lineTo(x, z + 6); ctx.lineTo(x - 5, z); ctx.fill(); ctx.strokeStyle = '#f2efe6'; ctx.lineWidth = 1; ctx.stroke(); }
  marker(car,'#d3d9c5',4);if(target)marker(target,pickup?'#71cce5':'#f1c369',8);
  const p=project(position);ctx.save();ctx.translate(p.x,p.z);ctx.rotate(Math.PI-yaw);ctx.fillStyle='#ffe3a5';ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(7,8);ctx.lineTo(0,4);ctx.lineTo(-7,8);ctx.fill();ctx.restore();
  ctx.fillStyle='#eee3c7';ctx.font='15px sans-serif';ctx.textAlign='center';ctx.fillText(this.overview?'NCR · REAL-NCR OVERVIEW':regionLabels[regionAt(position)],240,25);
  if(this.overview)for(const city of CITY_ANCHORS){const q=project(city);ctx.fillText(city.name.toUpperCase(),q.x,q.z-17);}
  ctx.font='12px sans-serif';ctx.fillText(this.overview?'Real NCR geography · schematic · N ↑':'N ↑   •   edge dots point toward distant stops',240,472);
 }
}
