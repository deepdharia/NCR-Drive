import * as THREE from 'three';
import {SHOWCASE_ARCADES,SHOWCASE_SCOOTERS,SHOWCASE_PLANTERS} from './ShowcaseLayout';
import {mergeStaticMeshes} from '../rendering/MeshUtils';
import {signTexture,worldSurfaceMaterial} from '../rendering/ProceduralTextures';
import type {Point} from '../core/math';
/** Original modular shop kit. Static parts merge by shared material; no downloads. */
export class ShowcaseView {
 readonly group=new THREE.Group();
 constructor(scene:THREE.Scene){
  scene.add(this.group);this.group.name='CP west arcade · original evening showcase';
  const box=new THREE.BoxGeometry(1,1,1),column=new THREE.CylinderGeometry(0.19,0.19,1,10);
  const plaster=new THREE.MeshStandardMaterial({color:0xe9dcc2,roughness:0.91});
  const trim=new THREE.MeshStandardMaterial({color:0xb9a889,roughness:0.94});
  const dark=new THREE.MeshStandardMaterial({color:0x293d3e,roughness:0.72});
  const glass=new THREE.MeshStandardMaterial({color:0x3b5558,roughness:0.3,metalness:0.25});
  const metal=new THREE.MeshStandardMaterial({color:0x353c38,roughness:0.65,metalness:0.4});
  const wood=new THREE.MeshStandardMaterial({color:0x76573f,roughness:0.92});
  const foliage=new THREE.MeshStandardMaterial({color:0x61754b,roughness:1});
  const canvas=[0x7b5442,0x43695f,0xba9355].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
  const add=(mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,geo:THREE.BufferGeometry=box)=>{
   const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;this.group.add(m);return m;
  };
  const sign=(text:string,x:number,y:number,z:number,w:number,h:number,back=false)=>{
   const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:signTexture(text,undefined,'#294a43'),roughness:0.9}));m.position.set(x,y,z);m.rotation.y=back?Math.PI:0;this.group.add(m);
  };
  const names=['JANPATH BOOKS','DELHI HANDLOOM','EVENING PAPER','ARCADE OPTICS','KHADI HOUSE','CAPITAL TAILORS','INDIA STATIONERY','CP TEA ROOM'];
  SHOWCASE_ARCADES.forEach((p,i)=>{
   add(plaster,p.x,3.9,p.z,11.6,7.8,8);
   add(trim,p.x,3.85,18.7,12,0.3,3.4);add(plaster,p.x,4.1,17.12,12,0.28,0.25);
   add(trim,p.x,7.8,23.8,11.9,0.22,8.5);add(plaster,p.x,8.12,20.1,11.9,0.45,0.25);
   for(const dx of [-4.7,4.7]){
    add(plaster,p.x+dx,1.85,17.6,1,3.7,1,column);
    add(trim,p.x+dx,0.15,17.6,0.56,0.3,0.56);add(trim,p.x+dx,3.55,17.6,0.57,0.3,0.57);
   }
   // Deep dark reveals sit in front of the structural wall; inset panes,
   // side jambs and projecting sills make the opening read at street level.
   for(const dx of [-3.2,0,3.2]){
    add(dark,p.x+dx,1.65,19.96,2.7,2.9,0.06);
    add(glass,p.x+dx,1.7,19.88,2.25,2.45,0.06);
    for(const side of [-1,1])add(wood,p.x+dx+side*1.3,1.65,19.7,0.16,2.9,0.5);
    add(trim,p.x+dx,0.22,19.6,2.8,0.24,0.8);
    add(wood,p.x+dx,1.7,19.76,0.05,2.5,0.12);
    add(glass,p.x+dx,5.9,19.95,1.8,1.8,0.08);
    for(const side of [-1,1])add(trim,p.x+dx+side*1.02,5.9,19.8,0.18,2.1,0.4);
    add(trim,p.x+dx,4.9,19.72,2.3,0.16,0.6);
   }
   const awning=add(canvas[i%3],p.x,3.35,19.1,9.2,0.09,1.8);awning.rotation.x=-0.12;
   add(canvas[i%3],p.x,3.13,18.22,9.2,0.3,0.08);
   sign(names[i],p.x,4.4,19.84,8.6,0.55,true);
   // Interior silhouettes stay behind opaque glazing: no transparency sorting.
   for(let j=0;j<3;j++)add(canvas[(i+j)%3],p.x-2.8+j*2.7,0.65,19.76,0.8,0.45,0.1);
  });
  for(const p of SHOWCASE_PLANTERS){
   add(trim,p.x,0.325,p.z,1.3,0.65,1.3);add(wood,p.x,0.66,p.z,1.08,0.04,1.08);
   add(foliage,p.x,1.02,p.z,1.25,0.65,1.25,new THREE.IcosahedronGeometry(0.5,1));
  }
  for(const [i,p] of SHOWCASE_SCOOTERS.entries()){
   const paint=canvas[i];add(paint,p.x,0.57,p.z,0.52,0.65,1.25);add(dark,p.x,0.94,p.z-0.25,0.52,0.12,0.65);
   add(paint,p.x,0.85,p.z+0.57,0.48,0.82,0.18);add(metal,p.x,1.23,p.z+0.55,0.7,0.06,0.09);
   for(const dz of [-0.64,0.64]){const wheel=add(dark,p.x,0.23,p.z+dz,0.23,0.12,0.23,new THREE.CylinderGeometry(1,1,1,14));wheel.rotation.z=Math.PI/2;}
   add(metal,p.x+0.25,0.16,p.z-0.15,0.05,0.32,0.12); // centre stand
  }
  // Road repairs and grated drains lie flat, with world-metre texture UVs.
  const asphalt=worldSurfaceMaterial('asphalt');asphalt.color.setHex(0x77736c);
  for(let i=0;i<9;i++)add(asphalt,-145-i*25,0.037,i%2?4:-4,4+(i%3),0.003,1.7);
  for(let i=0;i<18;i++)for(const z of [-8.65,8.65]){
   add(dark,-139-i*13,0.055,z,0.65,0.015,0.38);
   for(let slat=0;slat<5;slat++)add(metal,-139-i*13-0.25+slat*0.125,0.065,z,0.04,0.008,0.36);
  }
  for(const z of [-12.5,12.5])add(metal,-130,2.5,z,0.28,5,0.28);
  add(metal,-130,4.95,0,0.25,0.25,25.3);
  const gate=new THREE.Mesh(new THREE.PlaneGeometry(11,1.1),new THREE.MeshStandardMaterial({map:signTexture('MARKET LANE  ·  बाज़ार गली',undefined,'#294a43'),side:THREE.DoubleSide,roughness:0.9}));gate.rotation.y=Math.PI/2;gate.position.set(-129.8,4.3,0);this.group.add(gate);
  mergeStaticMeshes(this.group);
 }
 update(focus:Point):void{this.group.visible=Math.hypot(focus.x+200,focus.z)<520;}
}
