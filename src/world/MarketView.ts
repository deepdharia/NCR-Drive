import * as THREE from 'three';
import { signTexture, worldSurfaceMaterial } from '../rendering/ProceduralTextures';
import { shops, seats } from '../systems/Neighborhood';
import { marketSolids, marketFrontages, marketParkingBay } from './MarketLayout';
import { mergeStaticMeshes } from '../rendering/MeshUtils';
export class MarketView {
 readonly group=new THREE.Group();private steam:THREE.InstancedMesh;private time=0;
 constructor(scene:THREE.Scene){
  this.group.name='Living Delhi · Market Lane';scene.add(this.group);
  const box=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,12);
  const concrete=worldSurfaceMaterial('concrete'),wood=new THREE.MeshStandardMaterial({color:0x76583a,roughness:0.9}),metal=new THREE.MeshStandardMaterial({color:0x7b8b87,metalness:0.7,roughness:0.35});
  const stone=new THREE.MeshStandardMaterial({color:0xcebea2,roughness:0.95}),leaf=new THREE.MeshStandardMaterial({color:0x506c42,roughness:1}),dark=new THREE.MeshStandardMaterial({color:0x344a43,roughness:0.9});
  const add=(m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,g:THREE.BufferGeometry=box)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(w,h,d);o.castShadow=o.receiveShadow=true;this.group.add(o);return o;};
  const label=(text:string,x:number,y:number,z:number,w:number,bg='#264e43')=>{const o=new THREE.Mesh(new THREE.PlaneGeometry(w,w/5),new THREE.MeshStandardMaterial({map:signTexture(text,undefined,bg),roughness:0.9,side:THREE.FrontSide}));o.position.set(x,y,z);const reverse=o.clone();reverse.rotation.y=Math.PI;reverse.position.z-=0.01;this.group.add(o,reverse);};
  add(concrete,-255,0.005,-12.7,250,0.06,7.4);add(concrete,-255,0.005,12.7,250,0.06,7.4);
  const bay=marketParkingBay,parkingPaint=new THREE.MeshBasicMaterial({color:0xd4bd82});
  for(const dx of [-bay.width/2,bay.width/2])add(parkingPaint,bay.x+dx,0.05,bay.z,0.1,0.02,bay.depth);
  for(const dz of [-bay.depth/2,bay.depth/2])add(parkingPaint,bay.x,0.05,bay.z+dz,bay.width,0.02,0.1);
  add(metal,bay.x-2,1.25,-16.55,0.12,2.5,0.12);
  label('P · PUBLIC PARKING',bay.x,2.5,-16.5,5);
  // Flush crossing and roll-over curb paint keep existing flat ground physics safe.
  for(let i=0;i<12;i++)add(i%2?stone:dark,-244,0.05,-8.2+i*1.5,5,0.015,0.72);
  for(let i=0;i<46;i++)for(const z of [-9.15,9.15])add(i%2?stone:dark,-134-i*5.3,0.05,z,4.9,0.03,0.2);
  for(const s of marketSolids){if(s.height<4||marketFrontages.includes(s.x))continue;add(s.width<1?wood:stone,s.x,s.height/2,s.z,s.width,s.height,s.depth);}
  shops.forEach((s,i)=>{
   const awning=new THREE.MeshStandardMaterial({color:[0x597568,0x855c45,0xcc9c42][i],roughness:0.95});
   add(awning,s.x,3,-17,8.5,0.13,4.8).rotation.x=0.09;add(awning,s.x,2.72,-14.8,8.5,0.4,0.12);
   add(wood,s.x,0.52,-16.5,5.6,1.04,0.8);add(metal,s.x,1.08,-16.5,5.9,0.08,1);
   for(const dx of [-3.5,3.5])add(metal,s.x+dx,1.55,-16,0.12,3.1,0.12);
   label(s.name,s.x,3.65,-14.45,10,['#2e594b','#6d3b2c','#7d6b24'][i]);
   add(dark,s.x,0.8,-18.3,5,1.6,0.12);
   label(i===0?'CHAI ₹20 · GAME CURRENCY':i===1?'LOCAL NEWS · ADULTS ONLY':'FRESH JUICE ₹40 · SUPPLY DESK',s.x,2.1,-18.2,6);
   // Shelves, kettle, cups and ingredient displays use shared primitives.
   for(let r=0;r<3;r++){
    add(wood,s.x,1.3+r*0.34,-18.1,4.6,0.06,0.28);
    for(let k=0;k<9;k++){const mat=new THREE.MeshStandardMaterial({color:i===1?[0xad5b42,0xc7a35d,0x657d4d][(k+r)%3]:[0xb7aa82,0x66784c,0xb98048][k%3],roughness:0.9});add(mat,s.x-2+k*0.47,1.45+r*0.34,-18,0.22,0.25,0.12);}
   }
   if(i===0){add(metal,s.x-1.5,1.4,-16.5,0.28,0.55,0.28,cylinder);const spout=add(metal,s.x-1.16,1.4,-16.5,0.4,0.08,0.08);spout.rotation.z=0.3;}
   if(i===2){for(let f=0;f<18;f++)add(new THREE.MeshStandardMaterial({color:f%3?0x9da348:0xd69a36,roughness:0.8}),s.x-1.7+(f%6)*0.24,1.2+Math.floor(f/6)*0.14,-16.2,0.19,0.17,0.18,new THREE.IcosahedronGeometry(1,1));add(metal,s.x+1.7,1.4,-16.5,0.3,0.6,0.3,cylinder);}
   for(let c=0;c<5;c++)add(stone,s.x+0.4+c*0.15,1.16,-16.2,0.045,0.1,0.045,cylinder);
  });
  for(const seat of seats){add(wood,seat.x,0.45,seat.z,1.1,0.12,0.48);add(wood,seat.x,0.8,seat.z-0.22,1.1,0.62,0.08);for(const dx of [-0.4,0.4])add(metal,seat.x+dx,0.22,seat.z,0.08,0.44,0.42);}
  for(const x of [-145,-238,-272,-314,-368]){
   add(wood,x,2,-12,0.35,4,0.35);add(leaf,x,4.6,-12,4.6,3,4.1,new THREE.IcosahedronGeometry(1,1));
   add(metal,x-1,2.8,12,0.1,5.6,0.1);add(stone,x-1,5.7,11,0.5,0.15,1.8);
  }
  add(dark,-234,0.45,-16,0.6,0.9,0.6,cylinder);add(dark,-178,0.45,-16,0.6,0.9,0.6,cylinder);
  label('DELHI COLD STORE · GOODS BAY',-342,4,-12.8,23);label('MARKET LANE · बाज़ार गली',-137,4,-12,15);
  label('DELHI →  CP  |  GURGAON  |  NOIDA',-366,3,12,15);
  // Unequal facade modules, ventilation, roof cables, shutters and pavement wear.
  for(const [i,x] of marketFrontages.entries()){add(i%2?stone:concrete,x,3.5,-23,10.8,7,8);add(dark,x,1.5,-18.95,7.5,3,0.05);label(i%2?'गोदाम · STORE':'WORKSHOP · कार्यशाला',x,4,-18.9,9);}
  for(let i=0;i<8;i++){const line=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,13,4),dark);line.rotation.z=Math.PI/2;line.position.set(-158-i*15,4.2,-17);this.group.add(line);}
  mergeStaticMeshes(this.group);
  this.steam=new THREE.InstancedMesh(new THREE.SphereGeometry(0.06,5,4),new THREE.MeshBasicMaterial({color:0xe7e4da,transparent:true,opacity:0.16,depthWrite:false}),8);this.group.add(this.steam);
 }
 update(dt:number,focus:{x:number;z:number}):void {this.group.visible=Math.hypot(focus.x+235,focus.z)<650;if(!this.group.visible)return;this.time+=dt;const d=new THREE.Object3D();for(let i=0;i<8;i++){const t=(this.time*0.28+i/8)%1;d.position.set(-165.5+Math.sin(t*7+i)*0.05,1.75+t*0.6,-16.5);d.scale.setScalar(0.5+t);d.updateMatrix();this.steam.setMatrixAt(i,d.matrix);}this.steam.instanceMatrix.needsUpdate=true;}
}
