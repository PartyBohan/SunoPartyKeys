import type {Note} from './piano';
import {Piano} from './piano';

export type PracticeSound = Note & {track:string; drums:boolean};

export class PracticePlayback {
  private nodes = new Set<AudioScheduledSourceNode>();
  private tracks = new Map<string, GainNode>();
  private bus:GainNode;
  readonly context:AudioContext;

  constructor(private piano:Piano) {
    this.context=piano.ensure();
    this.bus=this.context.createGain();
    this.bus.gain.value=.68;
    this.bus.connect(piano.master!);
  }

  play(note:PracticeSound, time:number, duration:number, muted:boolean) {
    const context=this.context;
    let output=this.tracks.get(note.track);
    if (!output) {
      output=context.createGain();
      output.gain.value=muted?0:1;
      output.connect(this.bus);
      this.tracks.set(note.track,output);
    }
    if (this.nodes.size>=140) return;
    if (note.drums) {
      const tone=context.createOscillator(), gain=context.createGain();
      tone.frequency.setValueAtTime(note.note<=36?145:note.note<=50?310:800,time);
      tone.frequency.exponentialRampToValueAtTime(note.note<=36?45:110,time+.09);
      gain.gain.setValueAtTime(.14*note.velocity/127,time);
      gain.gain.exponentialRampToValueAtTime(.0001,time+.1);
      tone.connect(gain);
      gain.connect(output);
      tone.start(time);
      tone.stop(time+.11);
      this.watch(tone,gain);
    } else {
      const voice=this.piano.voice(context,note.note,note.velocity,time,output);
      voice.gain.gain.setTargetAtTime(.0001,time+duration,.047);
      voice.source.stop(time+duration+.18);
      this.watch(voice.source,voice.gain);
    }
  }

  private watch(node:AudioScheduledSourceNode,gain:GainNode) {
    this.nodes.add(node);
    node.onended=()=>{this.nodes.delete(node);node.disconnect();gain.disconnect();};
  }

  mute(track:string,value:boolean) {
    this.tracks.get(track)?.gain.setTargetAtTime(value?0:1,this.context.currentTime,.018);
  }

  stopNotes() {
    for (const node of this.nodes) {try{node.stop();}catch{}}
    this.nodes.clear();
  }

  close() {
    this.stopNotes();
    for (const track of this.tracks.values()) track.disconnect();
    this.bus.disconnect();
  }
}
