import type {Note, Pedal} from './piano';

export const MAX_MIDI_BYTES = 1_048_576;
const MAX_NOTES = 30_000;
const MAX_SECONDS = 1_000;
export type Part = {id:string; name:string; program:number; channel:number; notes:Note[]; drums:boolean; pedals?:Pedal[]};
export type Score = {parts:Part[]; duration:number};

class MidiReader {
  pos = 0;
  constructor(readonly bytes:Uint8Array) {}
  get left() {return this.bytes.length - this.pos;}
  take(length:number) {
    if (length > this.left) throw new Error('Truncated MIDI file');
    const value = this.bytes.subarray(this.pos, this.pos + length);
    this.pos += length;
    return value;
  }
  number(length:number) {
    let value = 0;
    for (const byte of this.take(length)) value = value * 256 + byte;
    return value;
  }
  delta() {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const byte = this.number(1);
      value = value * 128 + (byte & 127);
      if (byte < 128) return value;
    }
    throw new Error('Invalid MIDI event length');
  }
  chunk(type:string) {
    if (String.fromCharCode(...this.take(4)) !== type) throw new Error('Invalid MIDI chunk');
    return new MidiReader(this.take(this.number(4)));
  }
}

type RawPart = Part & {active:Map<number, Note[]>};

export function parsePracticeMidi(bytes:Uint8Array):Score {
  if (bytes.length < 22 || bytes.length > MAX_MIDI_BYTES) throw new Error('MIDI file is outside the supported size');
  const file = new MidiReader(bytes), header = file.chunk('MThd');
  const format = header.number(2), count = header.number(2), division = header.number(2);
  if (format > 1 || !count || count > 128 || format === 0 && count !== 1 || !division || division >= 32768) {
    throw new Error('Use a Standard MIDI File (type 0 or 1, PPQ)');
  }
  const tempos = [{tick:0, us:500000}], parts:Part[] = [];
  let total = 0;
  for (let index = 0; index < count; index++) {
    const track = file.chunk('MTrk'), channels = new Map<number,RawPart>();
    let tick = 0, running = 0, name = '';
    while (track.left) {
      tick += track.delta();
      let status = track.number(1);
      if (status < 128) {
        if (!running) throw new Error('Invalid MIDI running status');
        track.pos--;
        status = running;
      }
      if (status === 255) {
        const type = track.number(1), value = track.take(track.delta());
        if (type === 3) name = new TextDecoder().decode(value.subarray(0, 120)).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 64);
        if (type === 81 && value.length === 3) {
          const us = value[0]*65536 + value[1]*256 + value[2];
          if (us) tempos.push({tick,us});
        }
        if (type === 47) break;
        continue;
      }
      if (status === 240 || status === 247) {
        running = 0;
        track.take(track.delta());
        continue;
      }
      if (status >= 240) throw new Error('Unsupported MIDI system event');
      running = status;
      const type = status >> 4, channel = status & 15, first = track.number(1);
      const second = type === 12 || type === 13 ? 0 : track.number(1);
      if (first > 127 || second > 127) throw new Error('Invalid MIDI channel event');
      let part = channels.get(channel);
      if (!part) {
        part = {id:`track-${index+1}-${channel+1}`,name:'',program:0,channel,drums:channel===9,notes:[],pedals:[],active:new Map()};
        channels.set(channel, part);
      }
      if (type === 12 && !part.notes.length) part.program = first;
      if (type === 11 && first === 64) part.pedals!.push({start:tick,value:second,channel});
      if (type === 9 && second) {
        if (++total > MAX_NOTES) throw new Error('MIDI file has too many notes');
        const note = {note:first,velocity:second,start:tick,duration:0,channel};
        part.notes.push(note);
        const held = part.active.get(first) || [];
        held.push(note);
        part.active.set(first, held);
      } else if (type === 8 || type === 9) {
        const note = part.active.get(first)?.shift();
        if (note) note.duration = Math.max(1, tick - note.start);
      }
    }
    for (const {active, ...part} of channels.values()) {
      if (!part.notes.length) continue;
      for (const notes of active.values()) for (const note of notes) note.duration = Math.max(1, tick - note.start);
      part.name = name;
      parts.push(part);
    }
  }
  if (!parts.length || parts.length > 128) throw new Error('MIDI must contain 1–128 playable tracks');
  let lastTick = 0, seconds = 0, tempo = 500000;
  const clock = tempos.sort((a,b) => a.tick - b.tick).map(event => {
    seconds += (event.tick - lastTick) * tempo / division / 1e6;
    lastTick = event.tick;
    tempo = event.us;
    return {...event,seconds};
  });
  function time(tick:number) {
    let a = 0, b = clock.length;
    while (a + 1 < b) {
      const mid = (a+b)>>1;
      if (clock[mid].tick <= tick) a = mid; else b = mid;
    }
    const event = clock[a];
    return event.seconds + (tick - event.tick) * event.us / division / 1e6;
  }
  let duration = 0;
  for (const part of parts) {
    for (const note of part.notes) {
      const end = time(note.start + note.duration);
      if (end > MAX_SECONDS) throw new Error('MIDI exceeds the supported song duration');
      note.start = time(note.start);
      note.duration = Math.max(.015, end - note.start);
      duration = Math.max(duration, note.start + note.duration);
    }
    for (const pedal of part.pedals || []) pedal.start = time(pedal.start);
  }
  return {parts,duration};
}
