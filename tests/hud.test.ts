import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hudState,HudStateAdapter,routeDirection} from '../src/ui/animation/HudStateAdapter';
import {PlayerController} from '../src/player/PlayerController';
import {VehicleController} from '../src/vehicle/VehicleController';
test('HUD reads actual signed vehicle speed, brakes and stationary reverse selection',()=>{
 const p=new PlayerController(),c=new VehicleController();c.setDriving(true);c.speed=-10;c.braking=true;
 assert.deepEqual(hudState(p,c),{driving:true,speed:36,arc:.225,gear:'R',braking:true,movement:'ON FOOT'});
 c.speed=0;assert.equal(hudState(p,c,true).gear,'R');assert.equal(hudState(p,c).gear,'N');
 c.speed=100;assert.equal(hudState(p,c).arc,1);
});
test('mode, reverse and brake cues fire on edges and never restart during unchanged updates',()=>{
 const p=new PlayerController(),c=new VehicleController(),a=new HudStateAdapter();
 assert.deepEqual(a.update(hudState(p,c)),[]);c.setDriving(true);assert.deepEqual(a.update(hudState(p,c)),['mode']);
 assert.deepEqual(a.update(hudState(p,c)),[]);c.speed=-1;assert.deepEqual(a.update(hudState(p,c)),['reverse']);
 c.braking=true;assert.deepEqual(a.update(hudState(p,c)),['brake']);assert.deepEqual(a.update(hudState(p,c)),[]);
 c.setDriving(false);assert.deepEqual(a.update(hudState(p,c)),['mode']);
});
test('walking feedback follows grounded, seated and real running speed',()=>{
 const p=new PlayerController(),c=new VehicleController(),a=new HudStateAdapter();a.update(hudState(p,c));
 p.speed=7;assert.deepEqual(a.update(hudState(p,c)),['sprint']);p.grounded=false;assert.deepEqual(a.update(hudState(p,c)),['jump']);
 assert.equal(hudState(p,c,false,true).movement,'SEATED');assert.deepEqual(a.update(hudState(p,c)),[]);
});

test('route direction advances beyond cached starting points and hides unavailable geometry',()=>{
 const route=[{x:0,z:0},{x:0,z:0},{x:0,z:10},{x:10,z:10}];
 assert.equal(routeDirection({x:0,z:8},0,route),0);
 assert.equal(routeDirection({x:5,z:10},0,route),Math.PI/2);
 assert.equal(routeDirection({x:5,z:10},Math.PI/2,route),0);
 assert.equal(routeDirection({x:10,z:10},0,route),undefined);
 assert.equal(routeDirection({x:0,z:0},0,[]),undefined);
});
