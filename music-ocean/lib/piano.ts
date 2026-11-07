import {encodeWav} from './midi.mjs';
export type Note={note:number;velocity:number;start:number;duration:number;channel:number};
export type Pedal={start:number;value:number;channel:number};
type Voice={source:AudioScheduledSourceNode;gain:GainNode;channel:number};
const PITCHES=[48,51,54,57,60,63,66,69,72,75,78,81,84];
const LAYERS=[4,8,12,16];
const names=['C','Cs','D','Ds','E','F','Fs','G','Gs','A','As','B'];
const layer=(v:number)=>v<=45?4:v<=78?8:v<=106?12:16;
const anchor=(n:number)=>PITCHES.reduce((a,b)=>Math.abs(n-a)<=Math.abs(n-b)?a:b);
const key=(n:number,l:number)=>`${names[n%12]}${Math.floor(n/12)-1}v${l}`;
export class Piano {
  context:AudioContext|null=null; buffers=new Map<string,AudioBuffer>();loading:Promise<void>|null=null;
  master:GainNode|null=null;active=new Map<string,Voice>();deferred=new Set<string>();pedals=new Set<number>();
  ensure(){
    if(!this.context){
      this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=.8;
      const comp=this.context.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=3;comp.knee.value=8;
      this.master.connect(comp);comp.connect(this.context.destination);
    }
    void this.context.resume();if(!this.loading)this.loading=this.load();return this.context;
  }
  async load(){
    await Promise.allSettled(PITCHES.flatMap(n=>LAYERS.map(async l=>{
      const k=key(n,l),r=await fetch(`/samples/${k}.mp3`);if(!r.ok)return;
      this.buffers.set(k,await this.context!.decodeAudioData(await r.arrayBuffer()));
    })));
  }
  voice(ctx:BaseAudioContext,n:number,v:number,time:number,destination:AudioNode){
    const gain=ctx.createGain(),p=anchor(n),sample=this.buffers.get(key(p,layer(v)));
    let source:AudioScheduledSourceNode;
    if(sample){const s=ctx.createBufferSource();s.buffer=sample;s.playbackRate.value=2**((n-p)/12);source=s;gain.gain.setValueAtTime((.32+.55*v/127)*.7,time);}
    else {const s=ctx.createOscillator();s.type='triangle';s.frequency.value=440*2**((n-69)/12);source=s;gain.gain.setValueAtTime(.001,time);gain.gain.exponentialRampToValueAtTime(.11*v/127,time+.008);gain.gain.exponentialRampToValueAtTime(.025*v/127,time+1.8);}
    source.connect(gain);gain.connect(destination);source.start(time);return {source,gain,channel:0};
  }
  on(n:number,v=88,ch=0){const ctx=this.ensure(),id=`${ch}:${n}`;this.release(id);this.deferred.delete(id);const voice=this.voice(ctx,n,v,ctx.currentTime,this.master!);voice.channel=ch;this.active.set(id,voice);if(this.active.size>48)this.release(this.active.keys().next().value!);}
  off(n:number,ch=0){const id=`${ch}:${n}`;if(this.pedals.has(ch))this.deferred.add(id);else this.release(id);}
  pedal(value:number,ch=0){if(value>=64)this.pedals.add(ch);else {this.pedals.delete(ch);for(const id of this.deferred)if(id.startsWith(`${ch}:`)){this.release(id);this.deferred.delete(id);}}}
  release(id:string){const voice=this.active.get(id);if(!voice||!this.context)return;const t=this.context.currentTime;voice.gain.gain.cancelScheduledValues(t);voice.gain.gain.setTargetAtTime(.0001,t,.07);try{voice.source.stop(t+.3);}catch{}this.active.delete(id);}
  stop(){this.pedals.clear();this.deferred.clear();for(const id of this.active.keys())this.release(id);}
  async render(notes:Note[],pedals:Pedal[]=[]){
    this.ensure();await this.loading;
    const end=Math.min(66,Math.max(8,...notes.map(n=>n.start+n.duration+1.5),...pedals.map(p=>p.start+1)));
    const ctx=new OfflineAudioContext(1,Math.ceil(end*44100),44100),master=ctx.createGain();master.gain.value=.8;const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=3;comp.knee.value=8;master.connect(comp);comp.connect(ctx.destination);
    for(const n of notes){
      const voice=this.voice(ctx,n.note,n.velocity,n.start,master);let release=n.start+n.duration;
      const channelPedals=pedals.filter(p=>p.channel===n.channel).sort((a,b)=>a.start-b.start),before=channelPedals.filter(p=>p.start<=release).at(-1);
      if(before&&before.value>=64)release=channelPedals.find(p=>p.start>release&&p.value<64)?.start??end-1;
      voice.gain.gain.setTargetAtTime(.0001,release,.07);voice.source.stop(Math.min(end,release+.4));
    }
    return encodeWav(await ctx.startRendering());
  }
}
