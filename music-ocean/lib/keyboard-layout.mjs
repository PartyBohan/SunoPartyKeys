// PartyKeys 36: C3–B5. Derive all positions from pitches so the 2+3 groups stay intact.
const whitePitchClasses=new Set([0,2,4,5,7,9,11]);
export const KEYBOARD_NOTES=Array.from({length:36},(_,i)=>48+i);
export const WHITE_KEYS=KEYBOARD_NOTES.filter(n=>whitePitchClasses.has(n%12));
export const BLACK_KEYS=KEYBOARD_NOTES.filter(n=>!whitePitchClasses.has(n%12)).map(n=>({n,x:WHITE_KEYS.filter(w=>w<n).length}));
