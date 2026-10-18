import type { Settings } from './ProgressStore';
import type { Point } from '../core/math';
/** Original synthetic ambience, no external recordings or network audio. Fixed voice budget. */
export class StreetAudio {
 private context:AudioContext|undefined;private master:GainNode|undefined;private engine:OscillatorNode|undefined;private engineGain:GainNode|undefined;private tireGain:GainNode|undefined;private sources:AudioScheduledSourceNode[]=[];private panners:PannerNode[]=[];private enginePan:PannerNode|undefined;
 start():void {
  if(this.context){void this.context.resume();return;}
  const c=this.context=new AudioContext();this.master=c.createGain();this.master.connect(c.destination);
  const noise=c.createBuffer(1,c.sampleRate*3,c.sampleRate),data=noise.getChannelData(0);let seed=77;
  for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*0.25;}
  const spatial=(x:number,z:number)=>{const p=c.createPanner();p.panningModel='equalpower';p.distanceModel='inverse';p.refDistance=2;p.maxDistance=65;p.rolloffFactor=1.8;p.positionX.value=x;p.positionY.value=1.2;p.positionZ.value=z;p.connect(this.master!);this.panners.push(p);return p;};
  for(const [x,z,freq,gain] of [[-165,-17,1800,0.12],[-218,-17,280,0.09],[-190,-12,650,0.035]]){
   const source=c.createBufferSource();source.buffer=noise;source.loop=true;const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=0.7;
   const g=c.createGain();g.gain.value=gain;source.connect(filter);filter.connect(g);g.connect(spatial(x,z));source.start();this.sources.push(source);
  }
  this.engine=c.createOscillator();this.engine.type='sawtooth';this.engineGain=c.createGain();this.engineGain.gain.value=0;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=220;this.engine.connect(filter);filter.connect(this.engineGain);this.enginePan=spatial(0,0);this.engineGain.connect(this.enginePan);this.engine.start();this.sources.push(this.engine);
  const tire=c.createBufferSource();tire.buffer=noise;tire.loop=true;const tireFilter=c.createBiquadFilter();tireFilter.type='highpass';tireFilter.frequency.value=900;this.tireGain=c.createGain();this.tireGain.gain.value=0;tire.connect(tireFilter);tireFilter.connect(this.tireGain);this.tireGain.connect(this.enginePan);tire.start();this.sources.push(tire);
 }
 settings(s:Settings,paused:boolean):void {if(!this.context)return;this.master!.gain.value=s.muted?0:s.volume??0.35;if(paused){void this.context.suspend();}else{void this.context.resume();}}
 update(focus:Point,yaw:number,car:Point,speed:number,driving:boolean,braking=false,steering=0):void {
  const c=this.context;if(!c)return;const listener=c.listener;listener.positionX.value=focus.x;listener.positionY.value=1.6;listener.positionZ.value=focus.z;listener.forwardX.value=Math.sin(yaw);listener.forwardY.value=0;listener.forwardZ.value=Math.cos(yaw);listener.upX.value=0;listener.upY.value=1;listener.upZ.value=0;
  this.enginePan!.positionX.value=car.x;this.enginePan!.positionZ.value=car.z;this.engine!.frequency.setTargetAtTime(35+Math.abs(speed)*3,c.currentTime,0.12);this.tireGain!.gain.setTargetAtTime(driving?Math.min(0.1,Math.abs(speed)*0.003)*(braking?1:Math.abs(steering)*0.25):0,c.currentTime,0.06);this.engineGain!.gain.setTargetAtTime(driving?0.025+Math.min(0.025,Math.abs(speed)*0.001):0,c.currentTime,0.12);
 }
 dispose():void {for(const s of this.sources){s.stop();s.disconnect();}this.panners.forEach(p=>p.disconnect());this.master?.disconnect();void this.context?.close();this.context=undefined;}
}
