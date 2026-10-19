import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
export const CHARACTER_URL='/assets/people/delhi-adult.glb';
export const REQUIRED_CLIPS=['idle','walk','run','turn','talk','wait','sit_down','sit','stand','drink','pay','react','flee','enter','exit','takeover','smoke','prepare','sit_drink','sit_smoke','drive'];
export class CharacterAssetError extends Error {}
/** Reject incompatible/corrupt rigs before creating any actors or WebGL resources. */
export function validateCharacter(gltf:GLTF):void {
 for(const name of REQUIRED_CLIPS){const clip=gltf.animations.find(c=>c.name===name);if(!clip||!Number.isFinite(clip.duration)||clip.duration<=0||!clip.tracks.length)throw new CharacterAssetError(`Invalid character animation: ${name}`);}
 for(const name of ['root','Head','spine_02','hand_r','hand_l'])if(!(gltf.scene.getObjectByName(name) instanceof THREE.Bone))throw new CharacterAssetError(`Missing character bone: ${name}`);
 let skinned=false;
 gltf.scene.traverse(o=>{if(o instanceof THREE.SkinnedMesh){skinned=true;if(!o.skeleton.bones.length||!o.geometry.getAttribute('skinWeight')||!o.geometry.getAttribute('skinIndex'))throw new CharacterAssetError('Invalid character skin');}});
 if(!skinned)throw new CharacterAssetError('Character has no skinned meshes');
}
