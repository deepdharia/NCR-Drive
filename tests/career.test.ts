import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Neighborhood, freshNeighborhood, SUPPLY_TARGET, Reservations, MARKET } from '../src/systems/Neighborhood';
import { defaultSettings, readProgress, writeProgress } from '../src/systems/ProgressStore';
import { roadRoute } from '../src/systems/Navigation';
import { CollisionWorld } from '../src/core/CollisionWorld';
import { createDistrictLayout } from '../src/world/DistrictLayout';
test('fictional UPI is atomic, optional, bounded and idempotent; cancel and insufficient balance are free',()=>{
 let commits=0;const n=new Neighborhood({cash:100,neighborhood:freshNeighborhood()},()=>{commits++;return true;});
 const id=n.order('chai')!;assert.equal(n.order('juice'),undefined);assert.ok(n.pay(id));assert.equal(n.pay(id),false);assert.equal(commits,1);assert.equal(n.cash,80);assert.equal(n.data.chai,1);
 n.order('juice');n.cancel();assert.equal(n.pay(id+1),false);assert.equal(n.cash,80);
 const poor=new Neighborhood({cash:0,neighborhood:freshNeighborhood()},()=>{throw Error('must not write');});assert.equal(poor.pay(poor.order('chai')!),false);assert.equal(poor.cash,0);assert.equal(poor.data.chai,0);
 assert.equal(n.drink(),'chai');assert.equal(n.drink(),undefined);assert.equal(n.data.chai,0);
});
test('failed purchase, consumption and reward storage leaves all related state unchanged',()=>{
 const n=new Neighborhood({cash:70,neighborhood:{...freshNeighborhood(),chai:1}},()=>false);
 assert.equal(n.pay(n.order('juice')!),false);assert.equal(n.cash,70);assert.equal(n.data.juice,0);
 assert.equal(n.drink(),undefined);assert.equal(n.data.chai,1);
 n.accept();assert.equal(n.update(SUPPLY_TARGET,true,0),false);assert.equal(n.job,'delivery');assert.equal(n.data.completed,false);assert.equal(n.cash,70);
});
test('goods mission requires stopped vehicle, pays once, persists trust and cancels without payout',()=>{
 let durable;const n=new Neighborhood({cash:0,neighborhood:freshNeighborhood()},next=>{durable=next;return true;});
 assert.equal(n.update(SUPPLY_TARGET,true,0),false);assert.ok(n.accept());assert.equal(n.accept(),false);assert.equal(n.update(SUPPLY_TARGET,false,0),false);assert.equal(n.update(SUPPLY_TARGET,true,8),false);
 n.cancelJob();assert.equal(n.cash,0);assert.equal(n.update(SUPPLY_TARGET,true,0),false);n.accept();assert.ok(n.update(SUPPLY_TARGET,true,0));assert.equal(n.cash,650);assert.equal(n.data.relationship,1);assert.equal(n.update(SUPPLY_TARGET,true,0),false);
 const reload=new Neighborhood(durable!,()=>true);assert.equal(reload.accept(),false);assert.equal(reload.update(SUPPLY_TARGET,true,0),false);assert.equal(reload.cash,650);
});
test('career round trip, corruption, unknown versions, zero cash and unavailable storage',()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 const progress={version:3 as const,cash:0,courierCompleted:true,settings:defaultSettings(),neighborhood:freshNeighborhood()};
 assert.ok(writeProgress(storage,progress));assert.deepEqual(readProgress(storage),progress);
 assert.equal(writeProgress({getItem:()=>null,setItem:()=>{throw Error('quota');}},progress),false);
 assert.equal(readProgress({getItem:()=>{throw Error('blocked');}}).cash,15000);
});
test('market approach and goods route remain clear; unreachable shops are rejected',()=>{
 const world=new CollisionWorld(createDistrictLayout().solids);
 for(const target of [MARKET,SUPPLY_TARGET])assert.ok(roadRoute({x:92,z:0},target).length);
 const route=roadRoute({x:-182,z:4},SUPPLY_TARGET);
 for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],yaw=Math.atan2(b.x-a.x,b.z-a.z);for(let t=0;t<=1;t+=0.05)assert.ok(world.boxIsClear({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,yaw},1.82,4.55));}
 assert.equal(roadRoute({x:0,z:0},{x:-164,z:-21}).length,0);
});
test('queue and seat ownership is exclusive, bounded and released on transitions',()=>{
 const r=new Reservations();assert.ok(r.reserve('seat-a','a'));assert.equal(r.reserve('seat-a','b'),false);assert.ok(r.reserve('queue-1','a'));assert.equal(r.owner('seat-a'),undefined);assert.equal(r.owner('queue-1'),'a');r.release('a');r.release('a');assert.equal(r.size,0);
});
