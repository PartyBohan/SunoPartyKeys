import {Check} from 'lucide-react';
import {MUSIC_PRESETS} from '@/lib/music-presets';
import type {Lang} from '@/lib/copy';
// Exact artwork from the music keyboard's existing official skin library.
// The original perspective keyboard is embedded in these images, never repainted.
const ART=['library-neon-funk.png','library-velvet-offbeat.png','library-chrome-disco.jpg','library-glitch-hook.jpg','library-brass-bounce.jpg'];
export default function MusicStyleCard({index,lang,selected,disabled,onClick}:{index:number;lang:Lang;selected:boolean;disabled?:boolean;onClick:()=>void}){
 const p=MUSIC_PRESETS[index];
 return <button className={`music-style-card style-${index} ${selected?'selected':''}`} aria-label={`${p[lang]} · ${p.bpm} BPM`} aria-pressed={selected} disabled={disabled} onClick={onClick}>
  <img className="style-scene" src={`/images/styles/${ART[index]}`} alt="" draggable={false}/>
  <span className="style-caption"><strong>{p[lang]}</strong><small>{p.bpm} BPM</small></span>
  {selected&&<span className="style-selected"><Check size={14}/></span>}
 </button>;
}
