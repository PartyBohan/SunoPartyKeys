import type {Note} from './piano';
import type {Part, Score} from './practice-midi';

export type Target = {time:number; pitches:number[]};
export type Phrase = {start:number; end:number; targets:Target[]};
export type Lesson = Part & {role?:'melody'|'chords'|'original'; omit?:string[]};

export function targetsFor(notes:Note[]):Target[] {
  const groups:Target[] = [];
  for (const n of notes) {
    const previous = groups.at(-1);
    if (!previous || n.start - previous.time > .035) {
      groups.push({time:n.start,pitches:[n.note]});
    } else if (!previous.pitches.includes(n.note)) {
      previous.pitches.push(n.note);
    }
  }
  for (const group of groups) group.pitches.sort((a,b)=>a-b);
  return groups;
}

export function buildLessons(score:Score):Lesson[] {
  const pitched = score.parts.filter(part => !part.drums);
  if (!pitched.length) return score.parts;
  const parts = pitched.map(part => ({part, groups:targetsFor(part.notes)}));
  const lead = parts.find(p=>/melody|lead|vocal|主旋律|人声/i.test(p.part.name)) || [...parts].sort((a,b)=>{
    const weight = (p:typeof a) => {
      const solo = p.groups.filter(g=>g.pitches.length===1).length / p.groups.length;
      const pitch = p.part.notes.reduce((sum,n)=>sum+n.note,0)/p.part.notes.length;
      const bass = p.part.program>=32 && p.part.program<=39 || /bass|贝斯/i.test(p.part.name);
      return solo*40 + pitch + Math.log(p.groups.length) - (bass?50:0);
    };
    return weight(b)-weight(a);
  })[0];
  let leadIndex = 0;
  const melody = lead.groups.map(group => {
    const pitch = group.pitches.at(-1)!;
    while (lead.part.notes[leadIndex].start < group.time) leadIndex++;
    let index = leadIndex;
    while (lead.part.notes[index].note !== pitch) index++;
    return lead.part.notes[index];
  });
  // Build a playable voicing from simultaneous sounding accompaniment notes.
  // Preserve actual pitches and use the strongest note per pitch class.
  const others = pitched.filter(p => p.id !== lead.part.id);
  const explicitHarmony = others.filter(p=>/chord|harmony|和弦|和声/i.test(p.name));
  const accompaniment = explicitHarmony.length ? explicitHarmony : others.length ? others : [lead.part];
  const events = accompaniment.flatMap(p=>p.notes).sort((a,b)=>a.start-b.start);
  const chords:Note[] = [];
  const sounding = new Map<number, Note>();
  let next = 0, last = '';
  for (const {time} of targetsFor(events)) {
    for (const [pitch,note] of sounding) if (note.start+note.duration<=time+.045) sounding.delete(pitch);
    while (next<events.length && events[next].start<=time+.035) {
      const note = events[next++], prior = sounding.get(note.note);
      if (!prior || note.start+note.duration > prior.start+prior.duration) sounding.set(note.note,note);
    }
    const voice = new Map<number, Note>();
    for (const note of sounding.values()) {
      const current = voice.get(note.note%12);
      if (!current || note.velocity>current.velocity) voice.set(note.note%12,note);
    }
    if (voice.size < 3) {last='';continue;}
    const voicing = [...voice.values()].sort((a,b)=>a.note-b.note);
    const representative = voicing.length>4 ? [voicing[0],...voicing.slice(-3)] : voicing;
    const key = representative.map(n=>n.note).join(',');
    if (key===last) continue;
    last = key;
    const duration = Math.min(2, Math.max(.12, Math.min(...representative.map(n=>n.start+n.duration-time))));
    for (const note of representative) chords.push({...note,start:time,duration});
  }
  const result:Lesson[] = [{...lead.part,id:'melody',role:'melody',notes:melody,omit:[lead.part.id]}];
  if (chords.length) result.push({id:'chords',name:'',channel:0,program:0,drums:false,role:'chords',notes:chords,omit:accompaniment.map(p=>p.id)});
  return [...result,...score.parts];
}

export function phrasesFor(notes:Note[], duration:number):Phrase[] {
  const groups = targetsFor(notes), phrases:Phrase[] = [];
  for (let i=0;i<groups.length;) {
    const targets = [groups[i++]];
    while (i<groups.length && targets.length<32 && groups[i].time-targets[0].time<16 && groups[i].time-targets.at(-1)!.time<5) {
      targets.push(groups[i++]);
    }
    const start = Math.max(0,targets[0].time-.9);
    const end = Math.min(groups[i]?.time ?? duration+.4,targets.at(-1)!.time+1.2);
    phrases.push({start,end,targets});
  }
  return phrases;
}

export function lessonShift(targets:Target[]) {
  const pitches = targets.flatMap(g=>g.pitches), low = Math.min(...pitches), high = Math.max(...pitches);
  const min = Math.ceil((48-low)/12), max = Math.floor((83-high)/12);
  return min <= max ? 12*Math.min(max,Math.max(0,min)) : 0;
}

export function acceptPracticeNote(target:Target, shift:number, note:number, hit:Set<number>) {
  if (!target.pitches.includes(note-shift)) return 'wrong';
  hit.add(note-shift);
  return hit.size===target.pitches.length ? 'complete' : 'partial';
}
