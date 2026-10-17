import type { Point } from '../core/math';
import { distance } from '../core/math';
import { lanes, projection, successors } from '../world/WorldRoads';
import type { Lane } from '../world/WorldRoads';

/** Directed Dijkstra on left-hand lanes; reject endpoints outside the road envelope.
 * Local destination approaches are explicit short links inside the paved width. */
export function roadRoute(from: Point, to: Point): Point[] {
 const candidates=(p: Point)=>lanes.map(l=>({l,...projection(p,l.start,l.end)})).filter(s=>s.distance<=s.l.road.width/2+2).sort((a,b)=>a.distance-b.distance).slice(0,4);
 const starts=candidates(from), allGoals=candidates(to), goals=allGoals.filter(g=>g.distance <= (allGoals[0]?.distance ?? 0)+0.25); if(!starts.length||!goals.length)return [];
 let best: Point[]=[];let bestLength=Infinity;
 for(const start of starts) for(const goal of goals){
  if(start.l===goal.l && start.t<=goal.t){const route=[from,start.point,goal.point,to];const len=routeLength(route);if(len<bestLength){best=route;bestLength=len;}continue;}
  const costs=new Map<string,number>([[start.l.id,(1-start.t)*start.l.length]]), previous=new Map<string,Lane>(), open:Lane[]=[start.l];
  while(open.length){open.sort((a,b)=>costs.get(a.id)!-costs.get(b.id)!);const lane=open.shift()!;if(lane===goal.l)break;
   for(const next of successors(lane)){const cost=costs.get(lane.id)!+distance(lane.end,next.start)+next.length;
    if(cost<(costs.get(next.id)??Infinity)){costs.set(next.id,cost);previous.set(next.id,lane);if(!open.includes(next))open.push(next);}}
  }
  if(!costs.has(goal.l.id))continue;
  const path:Lane[]=[goal.l];let cursor=goal.l;while(cursor!==start.l){const prev=previous.get(cursor.id);if(!prev)break;path.unshift(prev);cursor=prev;}if(cursor!==start.l)continue;
  const route=[from,start.point,start.l.end,...path.slice(1,-1).flatMap(l=>[l.start,l.end]),goal.l.start,goal.point,to];
  const len=routeLength(route);if(len<bestLength){best=route;bestLength=len;}
 }
 return best;
}
export function routeLength(route: readonly Point[]): number { return route.slice(1).reduce((sum,p,i)=>sum+distance(route[i],p),0); }
