import type {Note} from './piano';
import type {Score} from './practice-midi';

export type MusicKey={tonic:number;minor:boolean};
export const keyNames=['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const pitchClass=(n:number)=>(n%12+12)%12;
const profiles=[
  [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88],
  [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17],
];

export function keyFromSignature(fifths:number, mode:number):MusicKey|undefined {
  if (fifths < -7 || fifths > 7 || mode!==0&&mode!==1) return;
  return {tonic:pitchClass(fifths*7+mode*9),minor:mode===1};
}

function estimateKey(notes:Note[]) {
  const weights=new Array<number>(12).fill(0);
  for (const note of notes) weights[pitchClass(note.note)]+=Math.min(2,note.duration);
  if (weights.filter(Boolean).length<4) return;
  const average=weights.reduce((a,b)=>a+b,0)/12;
  const norm=Math.hypot(...weights.map(v=>v-average));
  const results=profiles.flatMap((profile,mode)=>{
    const mean=profile.reduce((a,b)=>a+b,0)/12;
    const scale=Math.hypot(...profile.map(v=>v-mean))*norm;
    return keyNames.map((_,tonic)=>{
      const value=profile.reduce((sum,v,i)=>sum+(v-mean)*(weights[(i+tonic)%12]-average),0)/scale;
      return {tonic,minor:mode===1,value};
    });
  }).sort((a,b)=>b.value-a.value);
  return results[0].value>=.55&&results[0].value-results[1].value>=.035 ? results[0] : undefined;
}

export function practiceSourceKey(score:Score) {
  return score.key || estimateKey(score.parts.filter(p=>!p.drums).flatMap(p=>p.notes));
}

// The shift is applied to fingers, screen and lamps. Audio inverts it once.
export function practiceSemitones(source:number,destination:number) {
  return pitchClass(destination-source+6)-6;
}
