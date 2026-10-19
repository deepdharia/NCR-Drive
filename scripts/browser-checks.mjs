// Run each existing browser gate once, with a deadline and retained stdout/stderr.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const groups={
 core:['browser-smoke','production-smoke','regional-browser-wiring'],
 living:['living-wiring','living-production'],
 parks:['parks-shopping','map-waypoint','repair-production'],
 visual:['visual-browser','visual-benchmark'],
};
const group=process.argv[2];
if(!groups[group])throw Error(`Unknown browser group: ${group}`);
await mkdir('test-results',{recursive:true});
const results=[];
for(const name of groups[group]){
 const began=Date.now(),log=[];
 const child=spawn(process.execPath,['--import','tsx',`tests/${name}.mjs`],{detached:true,env:{...process.env,BENCHMARK_PHASE:'after'},stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log.push(chunk);process.stdout.write(chunk);});
 let timedOut=false,killTimer;
 const timer=setTimeout(()=>{timedOut=true;try{process.kill(-child.pid,'SIGTERM');}catch{}killTimer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},10000);},15*60*1000);
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
 clearTimeout(timer);clearTimeout(killTimer);
 await writeFile(`test-results/${name}.log`,Buffer.concat(log));
 results.push({name,code,timedOut,wallSeconds:(Date.now()-began)/1000});
 await writeFile(`test-results/browser-${group}.json`,JSON.stringify(results,null,2));
}
if(results.some(r=>r.code!==0||r.timedOut))process.exitCode=1;
