export const noteName = n => ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][n%12] + (Math.floor(n/12)-1);
export const DEMO = [64,67,69,67,64,62,60,64,67,65,69,72,71,69,67,64,62,60].map((note,i)=>({note,velocity:i%3?78:94,start:i*.42,duration:i===17?1.4:.36,channel:0}));

/** Stateful byte-stream parser: running status, split packets and realtime interleaving. */
export class MidiParser {
  constructor(emit){this.emit=emit;this.status=0;this.pending=[];this.sysex=false;this.system=0;}
  feed(data,time,portId=''){
    for(const raw of Array.from(data||[])){
      const b=Number(raw)&255;
      if(b>=248)continue;
      if(b===240){this.sysex=true;this.status=0;this.pending=[];continue;}
      if(b===247){this.sysex=false;continue;}
      if(this.sysex)continue;
      if(b&128){
        this.pending=[];
        if(b>=240){this.status=0;this.system=b===242?2:([241,243].includes(b)?1:0);continue;}
        this.status=b;this.system=0;continue;
      }
      if(this.system){this.system--;continue;}
      if(!this.status)continue;
      this.pending.push(b);const command=this.status&240;
      if(this.pending.length<(command===192||command===208?1:2))continue;
      const [a,v=0]=this.pending;this.pending=[];
      const base={time,portId,channel:this.status&15};
      if(command===144&&v>0)this.emit({...base,type:'on',note:a,velocity:v});
      else if(command===128||(command===144&&v===0))this.emit({...base,type:'off',note:a,velocity:0});
      else if(command===176&&a===64)this.emit({...base,type:'pedal',value:v,on:v>=64});
    }
  }
}
export function normalizeTime(value,now,timeOrigin){
  let t=Number(value);if(!Number.isFinite(t))return now;
  if(t>1e11&&Number.isFinite(timeOrigin))t-=timeOrigin;
  return Math.abs(t-now)>60000?now:t;
}
export function validateNotes(notes,min=3){
  return Array.isArray(notes)&&notes.length>=min&&notes.length<=1024&&notes.every(n=>
    Number.isInteger(n.note)&&n.note>=0&&n.note<=127&&Number.isInteger(n.velocity)&&n.velocity>=1&&n.velocity<=127&&
    Number.isFinite(n.start)&&n.start>=0&&n.start<=60&&Number.isFinite(n.duration)&&n.duration>0&&n.duration<=60&&n.start+n.duration<=65&&
    Number.isInteger(n.channel??0)&&(n.channel??0)>=0&&(n.channel??0)<=15);
}
export function toMidi(notes,pedals=[],bpm=96){
  const ppq=480,tempo=Math.round(60000000/bpm),ticks=s=>Math.round(s*bpm/60*ppq);
  const vlq=n=>{let a=[n&127];while(n>>=7)a.unshift((n&127)|128);return a;};
  const bytes=s=>Array.from(new TextEncoder().encode(s));
  const u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
  const ev=[[0,0,[255,81,3,(tempo>>16)&255,(tempo>>8)&255,tempo&255]],[0,0,[255,88,4,4,2,24,8]],[0,0,[192,0]]];
  for(const n of notes){ev.push([ticks(n.start),2,[144|(n.channel??0),n.note,n.velocity]],[ticks(n.start+n.duration),1,[128|(n.channel??0),n.note,0]]);}
  for(const p of pedals)ev.push([ticks(p.start),1,[176|(p.channel??0),64,p.value]]);
  const end=Math.max(0,...notes.map(n=>ticks(n.start+n.duration)));
  for(let ch=0;ch<16;ch++)ev.push([end+1,3,[176|ch,64,0]]);
  ev.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let previous=0;const body=[];
  for(const [t,,msg]of ev){body.push(...vlq(t-previous),...msg);previous=t;}
  body.push(0,255,47,0);
  return new Uint8Array([...bytes('MThd'),0,0,0,6,0,0,0,1,1,224,...bytes('MTrk'),...u32(body.length),...body]);
}
export function encodeWav(buffer){
  const samples=buffer.getChannelData(0),ab=new ArrayBuffer(44+samples.length*2),v=new DataView(ab);
  const text=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  text(0,'RIFF');v.setUint32(4,36+samples.length*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,samples[i]))*32767,true);
  return new Blob([ab],{type:'audio/wav'});
}
