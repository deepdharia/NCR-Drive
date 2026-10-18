import type { Solid } from '../core/CollisionWorld';
import { shops, seats } from '../systems/Neighborhood';
export const marketParkingBay={id:'market-public-parking',x:-173,z:-12.5,width:3.2,depth:6};
export const marketFrontages=Array.from({length:10},(_,i)=>-251-i*12.7).filter(x=>x>=-320||x< -361);
export const marketSolids:Solid[]=[
 {x:marketParkingBay.x-2,z:-16.55,width:0.12,depth:0.12,height:2.5,yaw:0},
 ...marketFrontages.map(x=>({x,z:-23,width:10.8,depth:8,height:7,yaw:0})),
 ...seats.map(s=>({x:s.x,z:s.z,width:1.1,depth:0.48,height:0.51,yaw:0})),
 ...[-145,-238,-272,-314,-368].map(x=>({x:x-1,z:12,width:0.14,depth:0.14,height:5.6,yaw:0})),
 ...shops.flatMap(s=>[
  {x:s.x,z:-23,width:11,depth:7,height:5.4,yaw:0},
  {x:s.x,z:-16.5,width:5.6,depth:0.8,height:1.05,yaw:0},
  ...[-3.5,3.5].map(dx=>({x:s.x+dx,z:-16,width:0.12,depth:0.12,height:3.1,yaw:0})),
 ]),
 {x:-342,z:-22,width:30,depth:18,height:8,yaw:0},
 ...[-260,-294].map((x,i)=>({x,z:24,width:20,depth:14,height:8+i*2,yaw:0})),
 ...[-145,-238,-272,-314,-368].map(x=>({x,z:-12,width:0.35,depth:0.35,height:4,yaw:0})),
];
