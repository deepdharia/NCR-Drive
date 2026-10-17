/** Bounded rolling samples, excluding menu time. Not a hardware benchmark. */
export class FrameMetrics {
 private samples:number[]=[];
 add(milliseconds:number):void {if(Number.isFinite(milliseconds)&&milliseconds>0){this.samples.push(milliseconds);if(this.samples.length>300)this.samples.shift();}}
 get percentiles():{p50:number;p95:number}{const sorted=[...this.samples].sort((a,b)=>a-b);return {p50:sorted[Math.floor(sorted.length*0.5)]??0,p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*0.95))]??0};}
}
