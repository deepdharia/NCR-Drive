import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {validateCharacter} from '../src/people/CharacterAsset';
import {PEDESTRIAN_FLOOR_OFFSET} from '../src/people/HumanoidView';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

test('local licensed humanoid covers required clips, stays human scale, grounds seated feet and reaches the drinking grip',async()=>{
 const bytes=await readFile('public/assets/people/delhi-adult.glb');
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 validateCharacter(gltf);
 const root=gltf.scene,mixer=new THREE.AnimationMixer(root),names=gltf.animations.map(c=>c.name);
 for(const name of ['idle','walk','run','turn','talk','wait','sit_down','sit','stand','drink','pay','react','flee','enter','exit','takeover','smoke','prepare','sit_drink','sit_smoke','drive'])assert.ok(names.includes(name),name);
 let triangles=0;root.traverse(o=>{if(o instanceof THREE.Mesh)triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});assert.ok(triangles<=12000);
 const sample=(name:string)=>{mixer.stopAllAction();mixer.clipAction(gltf.animations.find(c=>c.name===name)!).reset().play();mixer.update(0.5);root.updateMatrixWorld(true);const bounds=new THREE.Box3();root.traverse(o=>{if(o instanceof THREE.SkinnedMesh){o.skeleton.update();o.computeBoundingBox();bounds.union(o.boundingBox!.clone().applyMatrix4(o.matrixWorld));}});return bounds;};
 const standing=sample('idle');assert.ok(standing.max.y>1.7&&standing.max.y<1.9);assert.ok(standing.min.y>=-0.025);assert.ok(Math.abs(standing.min.y+PEDESTRIAN_FLOOR_OFFSET-0.035)<0.015);
 const sitting=sample('sit');assert.ok(sitting.min.y>=-0.025,`feet underground: ${sitting.min.y}`);assert.ok(sitting.max.y>1.3&&sitting.max.y<1.5);
 sample('drink');const hand=root.getObjectByName('hand_r')!,head=root.getObjectByName('Head')!;
 const grip=new THREE.Vector3(0,0.135,0.025).applyMatrix4(hand.matrixWorld),mouth=head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,0.05,0.12));
 assert.ok(grip.distanceTo(mouth)<0.23,`cup grip does not reach mouth: ${grip.distanceTo(mouth)}`);
 sample('drive');for(const name of ['hand_r','hand_l']){const grip=new THREE.Vector3(0,0.135,0).applyMatrix4(root.getObjectByName(name)!.matrixWorld).multiplyScalar(0.93).add(new THREE.Vector3(-0.35,0.18,-0.2));assert.ok(grip.distanceTo(new THREE.Vector3(-0.35,1.1,0.32))<0.25,'driver hands reach wheel');}
 const license=await readFile('public/assets/people/QUATERNIUS-LICENSE.txt','utf8');assert.match(license,/CC0/);assert.match(license,/Quaternius/i);
 mixer.stopAllAction();mixer.uncacheRoot(root);root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
});

test('character compatibility check rejects incomplete animations and missing attachment bones',async()=>{
 const bytes=await readFile('public/assets/people/delhi-adult.glb');
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const clips=gltf.animations;gltf.animations=clips.filter(c=>c.name!=='drive');assert.throws(()=>validateCharacter(gltf),/drive/);
 gltf.animations=clips;gltf.scene.getObjectByName('hand_r')!.name='incompatible-hand';assert.throws(()=>validateCharacter(gltf),/hand_r/);
});
