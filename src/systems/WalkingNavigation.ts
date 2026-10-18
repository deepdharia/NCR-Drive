import type {Point} from '../core/math';
import {distance} from '../core/math';
import {CollisionWorld} from '../core/CollisionWorld';
import {marketSolids} from '../world/MarketLayout';
import {roadRoute} from './Navigation';
const world=new CollisionWorld(marketSolids);
const inMarket=(p:Point)=>p.x>=-240&&p.x<=-140&&p.z>=-15.7&&p.z<=-9.5;
const clear=(a:Point,b:Point)=>{const count=Math.ceil(distance(a,b)/0.25);for(let i=0;i<=count;i++){const t=count?i/count:0;if(!world.isClear({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},0.35))return false;}return true;};
const corners:Point[]=marketSolids.flatMap(s=>[-1,1].flatMap(x=>[-1,1].map(z=>({x:s.x+x*(s.width/2+0.4),z:s.z+z*(s.depth/2+0.4)})))).filter(p=>inMarket(p)&&world.isClear(p,0.35));
const edges=corners.map((a,i)=>corners.flatMap((b,k)=>k!==i&&clear(a,b)?[{to:k,cost:distance(a,b)}]:[]));
/** Local north-pavement visibility graph. Foot exploration does not inherit vehicle
 * one-way lane loops; every link clears real furniture/counters and stays paved. */
export function walkingRoute(from:Point,to:Point):Point[]{
 if(!inMarket(from)||!inMarket(to))return roadRoute(from,to);
 if(!world.isClear(from,0.32)||!world.isClear(to,0.32))return [];
 if(clear(from,to))return [from,to];
 const points=[...corners,from,to],start=corners.length,goal=start+1;
 const links=[...edges.map(e=>[...e]),[] as {to:number;cost:number}[],[] as {to:number;cost:number}[]];
 for(let i=0;i<corners.length;i++)for(const end of [start,goal])if(clear(points[i],points[end])){const cost=distance(points[i],points[end]);links[i].push({to:end,cost});links[end].push({to:i,cost});}
 const costs=new Map([[start,0]]),previous=new Map<number,number>(),open=[start],settled=new Set<number>();
 while(open.length){open.sort((a,b)=>costs.get(a)!-costs.get(b)!);const next=open.shift()!;if(settled.has(next))continue;settled.add(next);if(next===goal){const path=[to];let cursor=goal;while(previous.has(cursor)){cursor=previous.get(cursor)!;path.unshift(points[cursor]);}return path;}
  for(const link of links[next]){const cost=costs.get(next)!+link.cost;if(cost<(costs.get(link.to)??Infinity)){costs.set(link.to,cost);previous.set(link.to,next);open.push(link.to);}}
 }return [];
}
