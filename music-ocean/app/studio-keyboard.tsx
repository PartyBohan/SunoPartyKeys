import type {CSSProperties} from 'react';
import {noteName} from '@/lib/midi.mjs';
import {BLACK_KEYS,WHITE_KEYS} from '@/lib/keyboard-layout.mjs';

const colors=['#ffeca3','#ffe09b','#ffcd91','#ffb187','#ff9c81','#ff877f','#fa798a','#f872a2','#f371bf','#ee75d6','#e777e6','#d77bee','#ca80ef','#b988ee','#a493f0','#959ff0','#89b2ee','#84c2ed','#83d1e7','#87dedf','#8be3d9'];
type Props={
  zh:boolean; connected:boolean; label:string; pressed:Set<number>;
  onInput:(pitch:number,type:'on'|'off')=>void;
  disabled?:boolean; start?:number; targets?:number[]; hits?:number[]; compact?:boolean;
};

export default function StudioKeyboard({zh,connected,label,pressed,onInput,disabled,start=48,targets=[],hits=[],compact}:Props) {
  function key(note:number,index:number,black=false) {
    const pitch=note-48+start;
    const style={'--key-color':colors[black?index-1:index],...(black?{left:`${index/WHITE_KEYS.length*100}%`}:{})} as CSSProperties;
    return <button key={note} type="button" className={`${black?'black-key':'white-key'} ${pressed.has(pitch)?'pressed':''} ${targets.includes(pitch)?'target-key':''} ${hits.includes(pitch)?'hit-key':''}`}
      style={style} aria-label={noteName(pitch)} disabled={disabled||pitch>127}
      onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);onInput(pitch,'on');}}
      onPointerUp={()=>onInput(pitch,'off')} onPointerCancel={()=>onInput(pitch,'off')}
      onLostPointerCapture={()=>{if(pressed.has(pitch))onInput(pitch,'off');}}
      onClick={e=>{if(e.detail===0){onInput(pitch,'on');onInput(pitch,'off');}}}>
      {!black&&pitch%12===0?<span>{noteName(pitch)}</span>:null}</button>;
  }

  return <div className={`keyboard-body${compact?' practice-keyboard':''}`}>
    <div className="keyboard-deck" aria-hidden="true">
      <div className="hardware-controls"><span className="hardware-dial"/><span className="hardware-screen">● ● ●</span><span className={`hardware-indicator${connected?' on':''}`}/></div>
      <span className="deck-label">{zh?'音乐密码':'PartyKeys'}</span>
      <span className="hardware-mark"><img src="/images/logo.png" alt=""/></span>
    </div>
    <div className="piano-keys" role="group" aria-label={label}>
      {WHITE_KEYS.map((n,i)=>key(n,i))}
      {BLACK_KEYS.map(({n,x})=>key(n,x,true))}
    </div>
  </div>;
}
