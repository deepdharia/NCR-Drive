import type { Point } from '../core/math';
import { distance } from '../core/math';
import { lanes, projection, successors, ends } from '../world/WorldRoads';
import type { Lane } from '../world/WorldRoads';

/** Directed Dijkstra on left-hand lanes; reject endpoints outside the road envelope.
 * Local destination approaches are explicit short links inside the paved width. */
const courierApproach = {x:-99,z:0}, courierBay = {x:-99,z:24};
export function roadRoute(from: Point, to: Point): Point[] {
 // The original courier is a foot handover on the stadium plaza, not a road stop.
 const toPlaza=distance(to,courierBay)<0.5;
 const fromPlaza=from.x>=-100 && from.x<=-96 && from.z>6 && from.z<=39;
 const route=laneRoute(fromPlaza?courierApproach:from,toPlaza?courierApproach:to);
 if(!route.length)return [];
 return [...(fromPlaza?[from,{x:-99,z:13}]:[]),...route,...(toPlaza?[{x:-99,z:13},to]:[])];
}
function laneRoute(from: Point, to: Point): Point[] {
 const candidates=(p: Point)=>lanes.map(l=>({l,...projection(p,l.start,l.end)})).filter(s=>s.distance<=s.l.road.width/2+2 && projection(p,...ends(s.l.road)).distance<=s.l.road.width/2-0.8).sort((a,b)=>a.distance-b.distance).slice(0,4);
 const allStarts=candidates(from),starts=allStarts.filter(s=>s.distance<=(allStarts[0]?.distance??0)+0.25), allGoals=candidates(to), goals=allGoals.filter(g=>g.distance <= (allGoals[0]?.distance ?? 0)+0.25); if(!starts.length||!goals.length)return [];
 let best: Point[]=[];let bestLength=Infinity;
 for(const start of starts) for(const goal of goals){
  if(start.l===goal.l && start.t<=goal.t){const route=[from,start.point,goal.point,to];const len=routeLength(route);if(len<bestLength){best=route;bestLength=len;}continue;}
  // Seed successors rather than the source lane: a target behind us on the
  // same directed lane must take a legal loop, never reverse along that lane.
  const costs=new Map<string,number>(), previous=new Map<string,Lane>(), open:Lane[]=[];
  for(const next of successors(start.l)) {
    costs.set(next.id,(1-start.t)*start.l.length+distance(start.l.end,next.start)+next.length);
    open.push(next);
  }
  const settled=new Set<string>();
  while(open.length){
   open.sort((a,b)=>costs.get(a.id)!-costs.get(b.id)!);const lane=open.shift()!;
   if(settled.has(lane.id))continue;settled.add(lane.id);if(lane===goal.l)break;
   for(const next of successors(lane)){const cost=costs.get(lane.id)!+distance(lane.end,next.start)+next.length;
    if(cost<(costs.get(next.id)??Infinity)){costs.set(next.id,cost);previous.set(next.id,lane);open.push(next);}}
  }
  if(!settled.has(goal.l.id))continue;
  const path:Lane[]=[goal.l];let cursor=goal.l;
  while(previous.has(cursor.id)){cursor=previous.get(cursor.id)!;path.unshift(cursor);}
  path.unshift(start.l);
  const route=[from,start.point,start.l.end,...path.slice(1,-1).flatMap(l=>[l.start,l.end]),goal.l.start,goal.point,to];
  const len=routeLength(route);if(len<bestLength){best=route;bestLength=len;}
 }
 return best;
}
export function routeLength(route: readonly Point[]): number { return route.slice(1).reduce((sum,p,i)=>sum+distance(route[i],p),0); }
