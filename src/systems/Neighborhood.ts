import type { Point } from '../core/math';
import { distance } from '../core/math';
export type ActivitySaveResult = 'saved' | 'already-completed' | 'save-failed';
export type Drink = 'chai' | 'juice';
/** Purchasable items. Chai/juice are drinks; flowers/sweets/cake are
 * cluster-shop goods with a purpose (gifts, offerings, the goods jobs). */
export type ShopItem = 'chai' | 'juice' | 'flowers' | 'sweets' | 'cake';
export interface NeighborhoodSave { chai:number; juice:number; relationship:number; completed:boolean; flowers:number; sweets:number; cake:number; parkCircuit:boolean; photoViewpoint:boolean; goodsDone:string[] }
export const freshNeighborhood = ():NeighborhoodSave => ({chai:0,juice:0,relationship:0,completed:false,flowers:0,sweets:0,cake:0,parkCircuit:false,photoViewpoint:false,goodsDone:[]});
export const MARKET = {x:-164,z:-12};
export const SUPPLY_TARGET = {x:-342,z:4};
export const shops = [
 {id:'chai',name:'Neem Chai · नीम चाय',x:-164,z:-14,price:20,item:'chai' as Drink},
 {id:'paan',name:'Gali Baithak · गली बैठक',x:-190,z:-14,price:0},
 {id:'juice',name:'Nimbu Corner · नींबू कॉर्नर',x:-218,z:-14,price:40,item:'juice' as Drink},
] as const;
export const seats = [{id:'neem-a',x:-154,z:-12,yaw:0},{id:'neem-b',x:-152.7,z:-12,yaw:0},{id:'paan-a',x:-199,z:-12,yaw:0},{id:'juice-a',x:-228,z:-12,yaw:0}];
export interface WalletSnapshot { cash:number; neighborhood:NeighborhoodSave }
/** One durable record commits wallet + item/reward together. UI requests carry a nonce.
 * Failed writes change neither in-memory money nor inventory. Active jobs never resume. */
export class Neighborhood {
 data:NeighborhoodSave; cash:number;
 private serial=0; pending: {id:number;item:ShopItem;price:number}|undefined;
 job:'available'|'delivery'|'receipt'|'completed'; message='Explore the neighborhood · Visit Neem Chai on Market Lane';
 /** Goods jobs (cluster shops) share the supply state machine: one at a time,
  * transient while active, completed ids persisted in `goodsDone`. */
 goods:'idle'|'delivery'|'receipt'; goodsId?:string; goodsName=''; goodsDropoff?:Point; goodsReward=0;
 constructor(snapshot:WalletSnapshot,private commit:(next:WalletSnapshot)=>boolean){this.cash=snapshot.cash;this.data={...snapshot.neighborhood};this.job=this.data.completed?'completed':'available';this.goods='idle';}
 order(item:ShopItem,priceOverride?:number):number|undefined {
  if(this.pending)return;
  const price=priceOverride??(item==='chai'?20:item==='juice'?40:undefined);
  if(price===undefined)return;
  const id=++this.serial;this.pending={id,item,price};return id;
 }
 cancel():void {this.pending=undefined;}
 pay(id:number):boolean {
  const p=this.pending;if(!p||p.id!==id)return false;
  this.pending=undefined;
  if(this.cash<p.price){this.message='Not enough game currency. Explore freely; purchases are optional.';return false;}
  if(this.data[p.item]>=9){this.message='You already have enough of that item.';return false;}
  const next={cash:this.cash-p.price,neighborhood:{...this.data,[p.item]:this.data[p.item]+1}};
  if(!this.commit(next)){this.message='Payment not saved. No money charged or item delivered. Try again when saving works.';return false;}
  this.cash=next.cash;this.data=next.neighborhood;
  this.message=`Fictional UPI successful · ${p.item} received. ${(p.item==='chai'||p.item==='juice')?'Find a seat and press F to drink.':'It is in your bag.'}`;return true;
 }
 drink():Drink|undefined {
  const item:Drink|undefined=this.data.chai?'chai':this.data.juice?'juice':undefined;if(!item)return;
  const next={cash:this.cash,neighborhood:{...this.data,[item]:this.data[item]-1}};
  if(!this.commit(next)){this.message='Could not save. Your drink is still in your bag.';return;}
  this.data=next.neighborhood;return item;
 }
 get active():boolean{return this.job==='delivery'||this.job==='receipt'||this.goods==='delivery'||this.goods==='receipt';}
 get goodsActive():boolean{return this.goods==='delivery'||this.goods==='receipt';}
 get activeTarget():Point|undefined { return this.job==='delivery'||this.job==='receipt' ? SUPPLY_TARGET : this.goodsDropoff; }
 get goodsDoneIds():string[]{return [...this.data.goodsDone];}
 accept():boolean {if(this.job!=='available'||this.active)return false;this.job='delivery';this.message='Nimbu: Our chiller has failed. Take this sealed fruit crate to the west-end cold store, then confirm their receipt in DelhiOS. ₹650 + trust. No timer.';return true;}
 cancelJob():void {if(this.job==='delivery'||this.job==='receipt'){this.job='available';this.message='Supply run cancelled. No reward paid. Speak to Nimbu Corner to try again.';}this.cancelGoods();}
 acceptGoods(job:{id:string;name:string;dropoff:Point;reward:number;brief:string}):boolean {
  if(this.active||this.goods!=='idle'||this.data.goodsDone.includes(job.id))return false;
  this.goods='delivery';this.goodsId=job.id;this.goodsName=job.name;this.goodsDropoff=job.dropoff;this.goodsReward=job.reward;this.message=job.brief;return true;
 }
 private clearGoods():void {this.goods='idle';this.goodsId=undefined;this.goodsName='';this.goodsDropoff=undefined;this.goodsReward=0;}
 cancelGoods():void {const active=this.goodsActive;this.clearGoods();if(active)this.message='Goods delivery cancelled. No reward paid. Speak to the shop to try again.';}
 updateGoods(position:Point,driving:boolean,speed:number):boolean {
  if(this.goods!=='delivery'||!this.goodsDropoff||!driving||speed>2||distance(position,this.goodsDropoff)>4)return false;
  this.goods='receipt';this.message=`Arrived at the handover counter. Open DelhiOS and confirm the receipt to finish · ₹${this.goodsReward}.`;return true;
 }
 confirmGoods(position:Point,speed:number):boolean {
  if(this.goods!=='receipt'||!this.goodsDropoff||!this.goodsId||speed>2||distance(position,this.goodsDropoff)>5)return false;
  if(this.data.goodsDone.includes(this.goodsId))return false;
  const reward=this.goodsReward;
  const next={cash:this.cash+reward,neighborhood:{...this.data,goodsDone:[...this.data.goodsDone,this.goodsId]}};
  if(!this.commit(next)){this.message='Receipt could not be saved. No reward paid. Stay by the counter and retry confirmation in DelhiOS.';return false;}
  this.cash=next.cash;this.data=next.neighborhood;this.clearGoods();this.message=`Order handed over · ₹${reward} earned. The shop remembers.`;return true;
 }
 /** One-time, idempotent: re-walking the circuit or re-taking a photo never re-pays. */
 completeParkCircuit():ActivitySaveResult {
  if(this.data.parkCircuit){this.message='Park circuit complete. Already recorded.';return 'already-completed';}
  const next={cash:this.cash,neighborhood:{...this.data,parkCircuit:true}};
  if(!this.commit(next)){this.message='Park visit could not be saved. Press F at the board to retry; your finished circuit is kept.';return 'save-failed';}
  this.data=next.neighborhood;this.message='Park circuit complete. Your Noida visit is recorded.';return 'saved';
 }
 markPhoto():ActivitySaveResult {
  if(this.data.photoViewpoint){this.message='Photo stop already recorded. Yamuna viewpoint discovered.';return 'already-completed';}
  const next={cash:this.cash,neighborhood:{...this.data,photoViewpoint:true}};
  if(!this.commit(next)){this.message='Photo stop could not be saved. Visit the frame and exit photo mode again to retry.';return 'save-failed';}
  this.data=next.neighborhood;this.message='Photo stop saved. Yamuna viewpoint discovered.';return 'saved';
 }
 update(position:Point,driving:boolean,speed:number):boolean {
  if(this.job!=='delivery'||!driving||speed>2||distance(position,SUPPLY_TARGET)>4)return false;
  this.job='receipt';this.message='Cold store: The seal is intact. Nimbu calls to check the handover. Open DelhiOS and confirm the receipt to finish the supply run · ₹650 + trust.';return true;
 }
 confirm(position:Point,speed:number):boolean {
  if(this.job!=='receipt'||speed>2||distance(position,SUPPLY_TARGET)>5)return false;
  const next={cash:this.cash+650,neighborhood:{...this.data,completed:true,relationship:this.data.relationship+1}};
  if(!this.commit(next)){this.message='Receipt could not be saved. No reward paid. Stay by the bay and retry confirmation in DelhiOS.';return false;}
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
