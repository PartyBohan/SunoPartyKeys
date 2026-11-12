import type {Target} from './practice-score';

export type PracticeInput={type:string;note?:number;velocity?:number;portId?:string};
export type Hold={down:Map<number,number>; completed:Set<number>};
export const newHold=():Hold=>({down:new Map(),completed:new Set()});

export function holdSeconds(target:Target,next:Target|undefined,pitch:number,rate:number) {
  const gap=next ? next.time-target.time : Infinity;
  return Math.max(.015,Math.min(target.lengths[pitch],gap))/rate;
}

export function holdProgress(hold:Hold,target:Target,next:Target|undefined,rate:number,now:number) {
  return Object.fromEntries(target.pitches.map(pitch=>{
    const start=hold.down.get(pitch);
    const seconds=holdSeconds(target,next,pitch,rate), elapsed=start===undefined?-1:now-start;
    const closeEnough=elapsed>=0&&(seconds<=.24||elapsed>=seconds-Math.min(.06,seconds*.1));
    const progress=hold.completed.has(pitch)||closeEnough?1:Math.max(0,elapsed/seconds);
    if (progress===1) hold.completed.add(pitch);
    return [pitch,progress];
  }));
}
