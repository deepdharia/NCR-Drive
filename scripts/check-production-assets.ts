import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { validateCharacter } from '../src/people/CharacterAsset';
// Vite otherwise succeeds with missing public files. Parse the actual shipped bytes.
const path='dist/assets/people/delhi-adult.glb';
const bytes=await readFile(path);
const source=await readFile('public/assets/people/delhi-adult.glb');
if(!bytes.equals(source))throw new Error('Packaged character differs from the committed runtime asset');
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
validateCharacter(gltf);
console.log(`Production character loadable: ${bytes.length} bytes, ${gltf.animations.length} clips, SHA256 ${createHash('sha256').update(bytes).digest('hex')}`);
