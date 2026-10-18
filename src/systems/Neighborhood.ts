import type { Point } from '../core/math';
import { distance } from '../core/math';
export type Drink = 'chai' | 'juice';
export interface NeighborhoodSave { chai:number; juice:number; relationship:number; completed:boolean }
export const freshNeighborhood = ():NeighborhoodSave => ({chai:0,juice:0,relationship:0,completed:false});
export const MARKET = {x:-164,z:-12};
export const SUPPLY_TARGET = {x:-342,z:4};
export const shops = [
 {id:'chai',name:'Neem Chai · नीम चाय',x:-164,z:-14,price:20,item:'chai' as Drink},
 {id:'paan',name:'Gali Baithak · गली बैठक',x:-190,z:-14,price:0},
 {id:'juice',name:'Nimbu Corner · नींबू कॉर्नर',x:-218,z:-14,price:40,item:'juice' as Drink},
] as const;
export const seats = [{id:'neem-a',x:-154,z:-12,yaw:Math.PI},{id:'neem-b',x:-152.7,z:-12,yaw:Math.PI},{id:'juice-a',x:-228,z:-12,yaw:Math.PI}];
export interface WalletSnapshot { cash:number; neighborhood:NeighborhoodSave }
/** One durable record commits wallet + item/reward together. UI requests carry a nonce.
 * Failed writes change neither in-memory money nor inventory. Active jobs never resume. */
export class Neighborhood {
 data:NeighborhoodSave; cash:number;
 private serial=0; pending: {id:number;item:Drink;price:number}|undefined;
 job:'available'|'delivery'|'completed'; message='Explore the neighborhood · Visit Neem Chai on Market Lane';
 constructor(snapshot:WalletSnapshot,private commit:(next:WalletSnapshot)=>boolean){this.cash=snapshot.cash;this.data={...snapshot.neighborhood};this.job=this.data.completed?'completed':'available';}
 order(item:Drink):number|undefined {if(this.pending)return;const id=++this.serial;this.pending={id,item,price:item==='chai'?20:40};return id;}
 cancel():void {this.pending=undefined;}
 pay(id:number):boolean {
  const p=this.pending;if(!p||p.id!==id)return false;
  this.pending=undefined;
  if(this.cash<p.price){this.message='Not enough game currency. Explore freely; purchases are optional.';return false;}
  if(this.data[p.item]>=9){this.message='You already have enough drinks.';return false;}
  const next={cash:this.cash-p.price,neighborhood:{...this.data,[p.item]:this.data[p.item]+1}};
  if(!this.commit(next)){this.message='Payment not saved. No money charged or item delivered. Try again when saving works.';return false;}
  this.cash=next.cash;this.data=next.neighborhood;this.message=`Fictional UPI successful · ${p.item} received. Find a seat and press F to drink.`;return true;
 }
 drink():Drink|undefined {
  const item:Drink|undefined=this.data.chai?'chai':this.data.juice?'juice':undefined;if(!item)return;
  const next={cash:this.cash,neighborhood:{...this.data,[item]:this.data[item]-1}};
  if(!this.commit(next)){this.message='Could not save. Your drink is still in your bag.';return;}
  this.data=next.neighborhood;return item;
 }
 accept():boolean {if(this.job!=='available')return false;this.job='delivery';this.message='Nimbu Corner: Please take this sealed fruit crate to the cold store at the west end. ₹650 on delivery. No timer.';return true;}
 cancelJob():void {if(this.job==='delivery'){this.job='available';this.message='Supply run cancelled. No reward paid. Speak to Nimbu Corner to try again.';}}
 update(position:Point,driving:boolean,speed:number):boolean {
  if(this.job!=='delivery'||!driving||speed>2||distance(position,SUPPLY_TARGET)>4)return false;
  const next={cash:this.cash+650,neighborhood:{...this.data,completed:true,relationship:this.data.relationship+1}};
  if(!this.commit(next)){this.message='Delivery ready. Saving unavailable; reward pending. Stay stopped to retry.';return false;}
  this.cash=next.cash;this.data=next.neighborhood;this.job='completed';this.message='Fruit crate delivered · ₹650 earned · Nimbu Corner trust +1. Your neighborhood remembers.';return true;
 }
}
/** Shared, bounded ownership for queue/seat slots. Releasing an actor is idempotent. */
export class Reservations {
 private owners=new Map<string,string>();
 reserve(slot:string,actor:string):boolean {const owner=this.owners.get(slot);if(owner&&owner!==actor)return false;this.release(actor);this.owners.set(slot,actor);return true;}
 release(actor:string):void {for(const [slot,owner] of this.owners)if(owner===actor)this.owners.delete(slot);}
 owner(slot:string):string|undefined{return this.owners.get(slot);}
 get size():number{return this.owners.size;}
}
