import type { Settings } from './ProgressStore';
import type { Point } from '../core/math';
import { regionAt } from '../world/WorldRoads';
import type { RegionId } from '../world/WorldRoads';

/** Original synthetic ambience, no external recordings or network audio. Fixed voice budget. */
interface AmbienceVoice { panner: PannerNode; filter: BiquadFilterNode; gain: GainNode; baseFreq: number; baseGain: number; offset: Point }
const REGION_AMBIENCE: Record<RegionId, { gain: number; freqMul: number }> = {
  delhi: { gain: 1, freqMul: 1 },
  gurgaon: { gain: 0.8, freqMul: 0.9 },
  noida: { gain: 0.8, freqMul: 0.9 },
  'gurgaon-corridor': { gain: 1.15, freqMul: 1.4 },
  'yamuna-corridor': { gain: 1.15, freqMul: 1.4 },
};

export class StreetAudio {
 private context:AudioContext|undefined;private master:GainNode|undefined;private engine:OscillatorNode|undefined;private engineGain:GainNode|undefined;private engineFilter:BiquadFilterNode|undefined;private tireGain:GainNode|undefined;private skidGain:GainNode|undefined;private windGain:GainNode|undefined;private windFilter:BiquadFilterNode|undefined;private sources:AudioScheduledSourceNode[]=[];private panners:PannerNode[]=[];private enginePan:PannerNode|undefined;private ambience:AmbienceVoice[]=[];private hornUntil=0;private noise:AudioBuffer|undefined;
 start():void {
  if(this.context){void this.context.resume();return;}
  const c=this.context=new AudioContext();this.master=c.createGain();this.master.connect(c.destination);
  const noise=c.createBuffer(1,c.sampleRate*3,c.sampleRate),data=noise.getChannelData(0);let seed=77;
  for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*0.25;}
  this.noise=noise;
  const spatial=(x:number,z:number)=>{const p=c.createPanner();p.panningModel='equalpower';p.distanceModel='inverse';p.refDistance=2;p.maxDistance=65;p.rolloffFactor=1.8;p.positionX.value=x;p.positionY.value=1.2;p.positionZ.value=z;p.connect(this.master!);this.panners.push(p);return p;};
  // Ambience voices start at CP but follow the player (see update): every
  // region gets street life instead of only Connaught Place.
  for(const [x,z,freq,gain,offset] of [[-165,-17,1800,0.12,{x:14,z:6}],[-218,-17,280,0.09,{x:-18,z:10}],[-190,-12,650,0.035,{x:4,z:-20}]] as [number,number,number,number,Point][]){
   const source=c.createBufferSource();source.buffer=noise;source.loop=true;const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=0.7;
   const g=c.createGain();g.gain.value=gain;source.connect(filter);filter.connect(g);const panner=spatial(x,z);g.connect(panner);source.start();this.sources.push(source);
   this.ambience.push({panner,filter,gain:g,baseFreq:freq,baseGain:gain,offset});
  }
  this.engine=c.createOscillator();this.engine.type='sawtooth';this.engineGain=c.createGain();this.engineGain.gain.value=0;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=220;this.engineFilter=filter;this.engine.connect(filter);filter.connect(this.engineGain);this.enginePan=spatial(0,0);this.engineGain.connect(this.enginePan);this.engine.start();this.sources.push(this.engine);
  const tire=c.createBufferSource();tire.buffer=noise;tire.loop=true;const tireFilter=c.createBiquadFilter();tireFilter.type='highpass';tireFilter.frequency.value=900;this.tireGain=c.createGain();this.tireGain.gain.value=0;tire.connect(tireFilter);tireFilter.connect(this.tireGain);this.tireGain.connect(this.enginePan);tire.start();this.sources.push(tire);
  // Skid: bandpassed noise that only speaks while the tyres are sliding.
  const skid=c.createBufferSource();skid.buffer=noise;skid.loop=true;const skidFilter=c.createBiquadFilter();skidFilter.type='bandpass';skidFilter.frequency.value=950;skidFilter.Q.value=1.1;this.skidGain=c.createGain();this.skidGain.gain.value=0;skid.connect(skidFilter);skidFilter.connect(this.skidGain);this.skidGain.connect(this.enginePan);skid.start();this.sources.push(skid);
  // Wind: looped noise through a lowpass that opens with speed.
  const wind=c.createBufferSource();wind.buffer=noise;wind.loop=true;const windFilter=c.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=400;this.windFilter=windFilter;this.windGain=c.createGain();this.windGain.gain.value=0;wind.connect(windFilter);windFilter.connect(this.windGain);this.windGain.connect(this.master);wind.start();this.sources.push(wind);
 }
 /** Two-tone horn (370 + 466 Hz), ~0.45 s. Ignores re-triggers while sounding. */
 horn(duration=0.45):void {
  const c=this.context;if(!c||!this.master||!this.noise)return;
  if(c.currentTime<this.hornUntil)return;
  this.hornUntil=c.currentTime+Math.max(0.15,duration);
  const t=c.currentTime;
  for(const freq of [370,466.25]){
   const osc=c.createOscillator();osc.type='square';osc.frequency.value=freq;
   const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1400;
   const g=c.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.16,t+0.02);g.gain.setValueAtTime(0.16,t+Math.max(0.05,duration-0.08));g.gain.linearRampToValueAtTime(0,t+duration);
   osc.connect(filter);filter.connect(g);g.connect(this.master);osc.start(t);osc.stop(t+duration+0.05);
  }
 }
 settings(s:Settings,paused:boolean):void {if(!this.context)return;this.master!.gain.value=s.muted?0:s.volume??0.35;if(paused){void this.context.suspend();}else{void this.context.resume();}}
 update(focus:Point,yaw:number,car:Point,speed:number,driving:boolean,braking=false,steering=0):void {
  const c=this.context;if(!c)return;const listener=c.listener;listener.positionX.value=focus.x;listener.positionY.value=1.6;listener.positionZ.value=focus.z;listener.forwardX.value=Math.sin(yaw);listener.forwardY.value=0;listener.forwardZ.value=Math.cos(yaw);listener.upX.value=0;listener.upY.value=1;listener.upZ.value=0;
  const absSpeed=Math.abs(speed);
  // Ambience follows the player, with a per-region character: CP is busy,
  // Gurugram/Noida are a touch quieter, the highway corridors wash louder
  // and brighter (fast traffic, no shopfront chatter).
  const region=REGION_AMBIENCE[regionAt(focus)];
  for(const voice of this.ambience){
   voice.panner.positionX.setTargetAtTime(focus.x+voice.offset.x,c.currentTime,0.3);
   voice.panner.positionZ.setTargetAtTime(focus.z+voice.offset.z,c.currentTime,0.3);
   voice.filter.frequency.setTargetAtTime(voice.baseFreq*region.freqMul,c.currentTime,0.5);
   voice.gain.gain.setTargetAtTime(voice.baseGain*region.gain,c.currentTime,0.5);
  }
  this.enginePan!.positionX.value=car.x;this.enginePan!.positionZ.value=car.z;
  this.engine!.frequency.setTargetAtTime(40+absSpeed*4,c.currentTime,0.12);
  this.engineFilter!.frequency.setTargetAtTime(220+absSpeed*14,c.currentTime,0.2);
  this.engineGain!.gain.setTargetAtTime(driving?0.04+Math.min(0.06,absSpeed*0.002):0,c.currentTime,0.12);
  this.tireGain!.gain.setTargetAtTime(driving?Math.min(0.1,absSpeed*0.003)*(braking?1:Math.abs(steering)*0.25):0,c.currentTime,0.06);
  // Skid voice: hard braking or hard steering at speed.
  const skidding=driving&&absSpeed>8&&(braking||Math.abs(steering)>0.5);
  this.skidGain!.gain.setTargetAtTime(skidding?Math.min(0.16,0.05+absSpeed*0.003):0,c.currentTime,0.05);
  // Wind: silent in town, a real rush on the highway.
  this.windFilter!.frequency.setTargetAtTime(300+absSpeed*22,c.currentTime,0.2);
  this.windGain!.gain.setTargetAtTime(driving?Math.min(0.12,absSpeed*absSpeed*0.00008):0,c.currentTime,0.15);
 }
 dispose():void {for(const s of this.sources){try{s.stop();}catch{/* already stopped */}s.disconnect();}this.panners.forEach(p=>p.disconnect());this.master?.disconnect();void this.context?.close();this.context=undefined;this.ambience=[];}
}
