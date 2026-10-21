import type {Solid} from '../core/CollisionWorld';
/** 424m existing CP west-junction → Market Lane corridor, in metres. */
export const SHOWCASE_ARCADES = Array.from({length:8},(_,i)=>({x:-142-i*12,z:24}));
export const SHOWCASE_SCOOTERS = [{x:-185,z:13.7},{x:-208,z:13.7}];
export const SHOWCASE_PLANTERS = [{x:-138,z:14.4},{x:-234,z:14.4}];
export const showcaseSolids:Solid[]=[
 ...SHOWCASE_ARCADES.flatMap(p=>[
  {...p,width:11.6,depth:8,height:7.8,yaw:0},
  ...[-4.7,4.7].flatMap(dx=>[
   {x:p.x+dx,z:17.6,width:0.38,depth:0.38,height:3.7,yaw:0},
   {x:p.x+dx,z:17.6,width:0.56,depth:0.56,height:0.3,yaw:0},
   {x:p.x+dx,z:17.6,width:0.57,depth:0.57,height:0.3,base:3.4,yaw:0},
  ]),
  ...[-3.2,0,3.2].map(dx=>({x:p.x+dx,z:19.6,width:2.8,depth:0.8,height:0.24,base:0.1,yaw:0})),
  {x:p.x,z:18.7,width:12,depth:3.4,height:0.3,base:3.7,yaw:0},
 ]),
 ...SHOWCASE_SCOOTERS.map(p=>({...p,width:0.7,depth:1.8,height:1.3,yaw:0})),
 ...SHOWCASE_PLANTERS.map(p=>({...p,width:1.3,depth:1.3,height:0.65,yaw:0})),
 ...[-12.5,12.5].map(z=>({x:-130,z,width:0.28,depth:0.28,height:5,yaw:0})),
 {x:-345,z:-12.15,width:0.55,depth:0.55,height:1.17,yaw:0},
 {x:-336.8,z:-12.15,width:1.2,depth:1.0,height:0.67,yaw:0},
 {x:-166.8,z:-13.05,width:0.55,depth:0.55,height:0.62,yaw:0},
];
