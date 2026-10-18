import type { Solid } from '../core/CollisionWorld';
import { shops } from '../systems/Neighborhood';
export const marketSolids:Solid[]=[
 ...shops.flatMap(s=>[
  {x:s.x,z:-21,width:11,depth:7,height:5.4,yaw:0},
  {x:s.x,z:-16.5,width:5.6,depth:0.8,height:1.05,yaw:0},
  ...[-3.5,3.5].map(dx=>({x:s.x+dx,z:-16,width:0.12,depth:0.12,height:3.1,yaw:0})),
 ]),
 {x:-342,z:-22,width:30,depth:18,height:8,yaw:0},
 ...[-260,-294].map((x,i)=>({x,z:24,width:20,depth:14,height:8+i*2,yaw:0})),
 ...[-145,-238,-272,-314,-368].map(x=>({x,z:-12,width:0.35,depth:0.35,height:4,yaw:0})),
];
