import {Check} from 'lucide-react';
import {MUSIC_PRESETS} from '@/lib/music-presets';
import type {Lang} from '@/lib/copy';
const PALETTES=[['#ff986f','#f8ce82','#73cdb6','#6178bc'],['#88a7df','#b69bcb','#87c9d2','#f2b7b7'],['#efd3a0','#d6ab9d','#bba4d9','#f5e4c4'],['#6bcfdc','#6b88e7','#c888db','#d3bce8'],['#edbb67','#cf8b64','#6caaa7','#c5d7ba']];
export default function MusicStyleCard({index,lang,selected,disabled,onClick}:{index:number;lang:Lang;selected:boolean;disabled?:boolean;onClick:()=>void}){
 const p=MUSIC_PRESETS[index];
 return <button className={`music-style-card style-${index} ${selected?'selected':''}`} aria-label={`${p[lang]} · ${p.bpm} BPM`} aria-pressed={selected} disabled={disabled} onClick={onClick}>
  <img className="style-scene" src={`/images/styles/${p.id}.jpg`} alt="" draggable={false}/>
  <span className="style-palette" aria-hidden="true">{PALETTES[index].map(c=><i key={c} style={{backgroundColor:c}}/>)}</span>
  <span className="style-product" aria-hidden="true"><img src="/images/keyboard-black-angle.png" alt="" draggable={false}/></span>
  <span className="style-caption"><strong>{p[lang]}</strong><small>{p.bpm} BPM</small></span>
  {selected&&<span className="style-selected"><Check size={13}/></span>}
 </button>;
}
