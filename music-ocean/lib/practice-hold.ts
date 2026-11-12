import type {Target} from './practice-score';

export type PracticeInput={type:string;note?:number;velocity?:number};
export type Hold={down:Map<number,number>; completed:Set<number>};
export const newHold=():Hold=>({down:new Map(),completed:new Set()});

export function holdSeconds(target:Target,next:Target|undefined,pitch:number,rate:number) {
  const gap=next ? next.time-target.time : Infinity;
  return Math.max(.015,Math.min(target.lengths[pitch],gap))/rate;
}

export function holdProgress(hold:Hold,target:Target,next:Target|undefined,rate:number,now:number) {
  return Object.fromEntries(target.pitches.map(pitch=>{
    const start=hold.down.get(pitch);
    const progress=hold.completed.has(pitch)?1:start===undefined?0:Math.max(0,Math.min(1,(now-start)/holdSeconds(target,next,pitch,rate)));
    if (progress===1) hold.completed.add(pitch);
    return [pitch,progress];
  }));
}
