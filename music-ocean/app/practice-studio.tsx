import {useEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {ArrowLeft,AudioLines,ChevronLeft,ChevronRight,FileUp,KeyboardMusic,LoaderCircle,Pause,Play,RotateCcw,Volume2,VolumeX} from 'lucide-react';
import type {Clip,Creation} from '@/lib/jobs';
import {noteName} from '@/lib/midi.mjs';
import {keyLane} from '@/lib/keyboard-layout.mjs';
import type {Piano} from '@/lib/piano';
import {MAX_MIDI_BYTES,parsePracticeMidi,type Part,type Score} from '@/lib/practice-midi';
import {buildLessons,lessonShift,phrasesFor,type Lesson} from '@/lib/practice-score';
import {PracticePlayback,type PracticeSound} from '@/lib/practice-playback';
import StudioKeyboard from './studio-keyboard';
import {keyNames,practiceSemitones,practiceSourceKey} from '@/lib/practice-key';
import {holdProgress,holdSeconds,newHold,type Hold,type PracticeInput} from '@/lib/practice-hold';
import type {LightState} from '@/lib/practice-lights';

type Source = 'native'|'suno'|'import';
type SourceStatus = {state:'idle'|'pending'|'ready'|'failed';reason?:string};
type Props = {
  job:Creation; clip:Clip; zh:boolean; heading:RefObject<HTMLHeadingElement|null>;
  getPiano:()=>Piano; onBack:()=>void; connect:()=>void; connectSuno:()=>void; device?:string; deviceMessage?:string;
  pressed:Set<number>; screenInput:(note:number,type:'on'|'off')=>void;
  input:RefObject<((event:PracticeInput)=>number|null)|null>; blocked:boolean;
  lightState:LightState; hardwareKey:number|null; setLights:(notes:number[])=>void; resetKeys:()=>void;
  request:(path:string,options?:RequestInit)=>Promise<any>;
};
const clockText=(seconds:number)=>{const time=Math.max(0,seconds);return `${Math.floor(time/60)}:${String(Math.floor(time%60)).padStart(2,'0')}`;};
const labels = {
  zh:['钢琴','键盘','风琴','吉他','贝斯','弦乐','合奏','铜管','簧管','管乐','合成主音','合成铺底','合成音效','民族乐器','打击乐','音效'],
  en:['Piano','Keys','Organ','Guitar','Bass','Strings','Ensemble','Brass','Reed','Pipe','Synth lead','Synth pad','Synth effects','Ethnic','Percussive','Effects'],
};
function nameOf(part:Lesson, zh:boolean) {
  if (part.role==='original') return zh?'我弹的原句':'My original take';
  if (part.role==='melody') return zh?'主旋律':'Lead melody';
  if (part.role==='chords') return zh?'和弦':'Chords';
  if (part.name) return part.name;
  return part.drums ? (zh?'鼓组':'Drums') : labels[zh?'zh':'en'][Math.floor(part.program/8)];
}
const statusText:Record<string,[string,string]> = {
  plan_required:['Suno 转谱需要 Premier（Studio）。你仍可导入现有 MIDI。','Suno transcription requires Premier (Studio). You can still import a MIDI file.'],
  quota_exhausted:['Suno 积分不足。你仍可导入现有 MIDI。','Suno credits are insufficient. You can still import a MIDI file.'],
  not_ready:['成品还在处理中，完成后再试。','The song is still processing. Try again when it finishes.'],
  suno_not_connected:['请在设置里连接生成这首歌的 Suno 账户。','Connect the Suno account that created this song in Settings.'],
  invalid_asset:['Suno 无法读取这个版本，请检查账户或导入 MIDI。','Suno could not access this version. Check your account or import MIDI.'],
  invalid_midi:['请选择 1 MB 以内、含音符的标准 MIDI（类型 0 或 1）。','Choose a Standard MIDI File (type 0 or 1) with notes, up to 1 MB.'],
  midi_download_failed:['暂时无法取回 MIDI 文件，可以重新获取。','Could not retrieve the MIDI file. You can try again.'],
  transcription_failed:['Suno 转谱失败，本次转谱不扣积分。','Suno transcription failed. This attempt does not consume credits.'],
  service_unavailable:['练习服务暂时不可用，可以重试。','The practice service is temporarily unavailable. Try again.'],
};
function storedChoice(key:string):Source|'original'|null {
  try {const s=localStorage.getItem(key);return s==='native'||s==='suno'||s==='import'||s==='original'?s:null;}
  catch {return null;}
}

export default function PracticeStudio(props:Props) {
  const {job,clip,zh,heading,connectSuno,request} = props;
  const say=(cn:string,en:string)=>zh?cn:en;
  const remote:Source|undefined=clip.has_midi?'native':job.provider==='suno'?'suno':undefined;
  const choiceKey=`ocean.practice.${job.id}.${clip.id}`;
  const [source,setSource]=useState<Source|'original'>(()=>storedChoice(choiceKey)||remote||'import');
  const [info,setInfo]=useState<SourceStatus>({state:'idle'}),[score,setScore]=useState<Score|null>(null);
  const [busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false);
  const running=useRef(false), fileInput=useRef<HTMLInputElement>(null);
  const path=(kind:Source)=>`/api/jobs/${encodeURIComponent(job.id)}/practice?clip=${encodeURIComponent(clip.id)}&source=${kind}`;
  const url=source==='original'?'':path(source);
  const initial=useRef(true);
  const requestRef=useRef(request);
  requestRef.current=request;
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    if (!url) return;
    let live=true, timer=0;
    async function load() {
      try {
        const res=await fetch(url);
        if (!res.ok) throw new Error('Status unavailable');
        let status:SourceStatus=await res.json();
        if (!live) return;
        // Ready imports follow the chosen song version across devices.
        if (initial.current && status.state==='idle' && source!=='import' && !storedChoice(choiceKey)) {
          const imported=await fetch(path('import')).then(r=>r.ok?r.json() as Promise<SourceStatus>:null).catch(()=>null);
          if (!live) return;
          if (imported?.state==='ready') {initial.current=false;setSource('import');return;}
        }
        initial.current=false;
        if (status.state==='pending'&&!running.current&&!document.hidden) {
          status=await requestRef.current(url+'&action=poll',{method:'POST'});
        }
        if (!live) return;
        setInfo(previous=>status.state==='idle'&&previous.state==='failed'?previous:status);
        if (status.state==='ready') {
          const file=await fetch(url+'&file=1');
          if (!file.ok) throw new Error('Score unavailable');
          const midi=parsePracticeMidi(new Uint8Array(await file.arrayBuffer()));
          if (live) setScore(midi);
        } else if (status.state==='pending') {
          timer=window.setTimeout(load,9000);
        }
      } catch {
        if (live) setInfo({state:'failed',reason:'service_unavailable'});
      }
    }
    if (!busy) void load();
    return()=>{live=false;window.clearTimeout(timer);};
  },[url,busy]);

  function select(kind:Source|'original') {
    setConfirm(false);
    if (source===kind) return;
    setScore(null);setInfo({state:'idle'});setSource(kind);
    try {localStorage.setItem(choiceKey,kind);}catch{}
  }
  async function prepare(file?:File) {
    if (running.current) return;
    const kind:Source=file?'import':remote!;
    if (!kind) return;
    select(kind);
    if (file&&(file.size<22||file.size>MAX_MIDI_BYTES)) {
      setScore(null);setInfo({state:'failed',reason:'invalid_midi'});return;
    }
    running.current=true;setBusy(true);setConfirm(false);setScore(null);
    try {
      const next=await request(path(kind)+(file?'':'&action=start'),{
        method:'POST',
        headers:file?{'Content-Type':'audio/midi'}:kind==='suno'?{'X-Confirm-MIDI-Credits':'10'}:{},
        body:file,
      });
      if (mounted.current) setInfo(next);
    } catch (error) {
      if (mounted.current) setInfo({state:'failed',reason:(error as {code?:string}).code||'service_unavailable'});
    } finally {
      running.current=false;
      if (mounted.current) setBusy(false);
    }
  }
  const original = useMemo<Score>(()=>({
    duration:job.notes.reduce((end,n)=>Math.max(end,n.start+n.duration),0),
    parts:[{id:'original',name:'',program:0,channel:0,drums:false,notes:[...job.notes].sort((a,b)=>a.start-b.start),pedals:job.pedals}],
  }),[job]);
  const current=source==='original'?original:score;
  const details = source==='original'
    ? say('只练你当时录下的音符。','Practice the notes from your recording.')
    : source==='suno'
    ? say('Suno 从成品自动转谱。主旋律与和弦是从音轨整理的练习参考。','Suno transcribes your song. Melody and chords are practice guides derived from the tracks.')
    : say('可练习每条 MIDI 音轨。主旋律与和弦为自动整理的练习参考。','Practice every MIDI track. Melody and chord guides are derived automatically.');
  const reason = info.reason && (statusText[info.reason]||statusText.service_unavailable)[zh?0:1];
  return <section className="practice-page">
    <header className="practice-heading">
      <button className="previous-step" onClick={props.onBack}><ArrowLeft size={16}/>{say('返回作品','Back to song')}</button>
      <div><h1 ref={heading} tabIndex={-1}>{say('学弹这首歌','Learn your song')}</h1><p>{clip.title||job.title}</p></div>
      <button className="device-button practice-connection" onClick={props.connect} title={props.deviceMessage}>
        <span className={`practice-led ${props.lightState}`}/>
        <span>{props.device||say('连接音乐密码','Connect PartyKeys')}{props.device&&<small>{props.lightState==='sent'?say('灯光已发送','Light cue sent'):props.lightState==='ready'?say('亮灯就绪','Lights ready'):say('可弹奏 · 亮灯不可用','MIDI ready · no lights')}{props.hardwareKey!==null?` · ${noteName(props.hardwareKey)}`:''}</small>}</span>
      </button>
    </header>
    <div className="practice-source">
      <div role="group" aria-label={say('练习谱来源','Practice score source')}>
        {remote&&<button disabled={busy} aria-pressed={source===remote} onClick={()=>select(remote)}>{remote==='suno'?say('成品转谱','Song transcription'):say('原始音轨','Original MIDI')}</button>}
        <button disabled={busy} aria-pressed={source==='import'} onClick={()=>select('import')}>{say('导入的 MIDI','Imported MIDI')}</button>
        <button disabled={busy} aria-pressed={source==='original'} onClick={()=>select('original')}>{say('我弹的原句','My original take')}</button>
      </div>
      <button className="practice-import" disabled={busy} onClick={()=>fileInput.current?.click()}><FileUp size={15}/>{say('导入 MIDI','Import MIDI')}</button>
      <input ref={fileInput} type="file" hidden accept=".mid,.midi,audio/midi" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void prepare(file);}}/>
    </div>
    {current?.parts.some(p=>p.notes.length)?<PracticePlayer key={source} {...props} score={current} original={source==='original'} details={details}/>
      :<div className="practice-setup">
        {busy||info.state==='pending'?<LoaderCircle className="spin" size={30}/>:<AudioLines size={32} strokeWidth={1.4}/>}
        <h2>{busy||info.state==='pending'?say('正在准备练习谱','Preparing your score'):say('先准备练习谱','Get a score to start')}</h2>
        <p role="status">{reason||(busy||info.state==='pending'?say('你可以返回作品页，练习谱会保留进度。','You can return to the song while your score is prepared.'):source==='import'?say('导入这首歌的标准 MIDI 文件，选择任意音轨开始练习。','Import a Standard MIDI File for this song and choose a track to practice.'):details)}</p>
        {!busy&&info.state!=='pending'&&<div className="practice-setup-actions">
          {source==='import'?<button className="next-button" onClick={()=>fileInput.current?.click()}>{say('选择 MIDI 文件','Choose MIDI file')}</button>
            :source==='native'?<button className="next-button" onClick={()=>void prepare()}>{say('读取音轨','Load tracks')}</button>
            :source==='suno'&&info.reason==='suno_not_connected'?<button className="next-button" onClick={connectSuno}>{say('连接 Suno','Connect Suno')}</button>
            :source==='suno'&&!confirm?<button className="next-button" onClick={()=>setConfirm(true)}>{say('从成品提取音轨','Extract tracks from song')}</button>:null}
          {confirm&&source==='suno'&&<>
            <p>{say('需要 Suno Premier。首次成功转谱扣 10 个积分，已有转谱可免费读取。','Requires Suno Premier. A new successful transcription costs 10 credits. Existing scores can be retrieved for free.')}</p>
            <button className="previous-step" onClick={()=>setConfirm(false)}>{say('取消','Cancel')}</button>
            <button className="next-button" onClick={()=>void prepare()}>{say('确认转谱','Confirm transcription')}</button>
          </>}
        </div>}
      </div>}
    {props.deviceMessage&&<p className="practice-device" role="status">{props.deviceMessage}</p>}
  </section>;
}

type PlayerProps = Props & {score:Score; original:boolean; details:string};
type Mode = 'demo'|'follow';
type Display = {time:number; mode:Mode|null; index:number; phase:'idle'|'playing'|'wait'|'paused'|'done'; hit:number[]; charge?:Record<number,number>; wrong?:number};
type Run = {mode:Mode; time:number; stamp:number; index:number; waiting:boolean; hold:Hold; firstHit?:number; wrong?:number; next:number; audio:PracticePlayback};
const idle=(time:number):Display=>({time,mode:null,index:0,phase:'idle',hit:[]});
const rates=[.5,.75,1];
const KEY_CUE_SECONDS=.45;

function practiceSounds(parts:Part[],selected:Lesson,from:number,to:number,mode:Mode,firstNote:number):PracticeSound[] {
  const sources=parts.filter(p=>p.id!==selected.id);
  if (mode==='demo') sources.push(selected);
  return sources.flatMap(part=>{
    const pedals=part.pedals||[];
    let pedal=0,release=0;
    return part.notes.flatMap(note=>{
      let end=note.start+note.duration;
      if (note.start>=to||part.id===selected.id&&note.start<firstNote-.035) return [];
      // Overlapping notes can end in a different order, so locate each pedal by time.
      let low=0,high=pedals.length;
      while (low<high) {const mid=(low+high)>>1;if (pedals[mid].start<=end) low=mid+1;else high=mid;}
      pedal=low-1;
      if (pedal>=0&&pedals[pedal].value>=64) {
        release=pedal+1;
        while (release<pedals.length&&pedals[release].value>=64) release++;
        end=pedals[release]?.start??to;
      }
      if (end<=from) return [];
      const start=Math.max(from,note.start);
      return [{...note,start,duration:Math.min(end,to)-start,track:part.id,drums:part.drums}];
    });
  }).sort((a,b)=>a.start-b.start);
}

function PracticePlayer({score,original,details,zh,getPiano,input,blocked,pressed,screenInput,device,setLights,resetKeys}:PlayerProps) {
  const say=(cn:string,en:string)=>zh?cn:en;
  const lessons=useMemo<Lesson[]>(()=>original?score.parts.map(p=>({...p,role:'original'})):buildLessons(score),[score,original]);
  const [partId,setPartId]=useState(lessons[0].id),[phraseIndex,setPhraseIndex]=useState(0),[rate,setRate]=useState(.5);
  const selected=lessons.find(p=>p.id===partId)||lessons[0];
  const phrases=useMemo(()=>phrasesFor(selected.notes,score.duration),[selected,score.duration]);
  const phrase=phrases[Math.min(phraseIndex,phrases.length-1)];
  const detected=useMemo(()=>practiceSourceKey(score),[score]);
  const [keyChoice,setKeyChoice]=useState(0),[manualKey,setManualKey]=useState<number|null>(null),[view,setView]=useState(4.5);
  const sourceKey=manualKey??detected?.tonic;
  const semitones=selected.drums||sourceKey===undefined||keyChoice<0?0:practiceSemitones(sourceKey,keyChoice);
  const shift=lessonShift(phrase.targets,semitones);
  const [display,setDisplay]=useState(()=>idle(phrase.start));
  const [mute,setMute]=useState<Record<string,boolean>>({}),[panel,setPanel]=useState<'tips'|'mix'|null>(null),[octave,setOctave]=useState<number|null>(null);
  const run=useRef<Run|null>(null),frame=useRef(0),sounds=useRef<PracticeSound[]>([]),wrongTimer=useRef(0);
  const playing=display.phase==='playing'||display.phase==='wait';
  const latestLights=useRef(setLights),latestReset=useRef(resetKeys);
  latestLights.current=setLights;latestReset.current=resetKeys;
  const isMuted=(id:string)=>mute[id]??(selected.omit?.includes(id)||false);

  function halt() {
    window.clearTimeout(wrongTimer.current);
    cancelAnimationFrame(frame.current);
    run.current?.audio.close();
    run.current=null;
    latestLights.current([]);
  }
  function reset(time=phrase.start) {
    halt();
    resetKeys();
    setDisplay(idle(time));
    setOctave(null);
  }
  function pause() {
    const r=run.current;
    if (!r) return;
    setDisplay({time:r.time,mode:r.mode,phase:'paused',index:r.index,hit:[...r.hold.completed]});
    halt();
    latestReset.current();
  }
  useEffect(()=>{
    const hidden=()=>{if (document.hidden) pause();};
    window.addEventListener('blur',pause);
    document.addEventListener('visibilitychange',hidden);
    return()=>{
      window.removeEventListener('blur',pause);
      document.removeEventListener('visibilitychange',hidden);
      halt();
      latestReset.current();
    };
  },[]);
  useEffect(()=>{if(blocked)pause();},[blocked]);

  function tick() {
    const r=run.current;
    if (!r) return;
    const audioTime=r.audio.context.currentTime;
    const target=r.mode==='follow'?phrase.targets[r.index]:undefined;
    const next=target?phrase.targets[r.index+1]:undefined;
    const gate=r.waiting&&r.firstHit!==undefined
      ? next?.time??Math.max(phrase.end,target!.time+Math.max(...Object.values(target!.lengths)))
      : target?.time??Math.max(r.time,phrase.end);
    r.time=Math.min(gate,r.time+Math.max(0,audioTime-r.stamp)*rate);
    r.stamp=audioTime;
    const limit=Math.min(gate,r.time+.09*rate);
    while (r.next<sounds.current.length&&sounds.current[r.next].start<limit) {
      const note=sounds.current[r.next++];
      const start=audioTime+Math.max(0,note.start-r.time)/rate;
      r.audio.play(note,start,Math.max(.025,Math.min(note.duration,gate-note.start)/rate),muteRef.current(note.track));
    }
    if (r.time>=gate&&!r.waiting) {
      if (target) {
        r.audio.stopNotes();
        r.waiting=true;
      } else {
        setDisplay({time:gate,mode:r.mode,index:r.index,phase:'done',hit:[]});
        halt();
        return;
      }
    }
    if (r.waiting&&target) {
      const charge=holdProgress(r.hold,target,next,rate,audioTime);
      if (r.hold.completed.size===target.pitches.length) {
        r.index++;r.waiting=false;r.firstHit=undefined;r.hold=newHold();r.wrong=undefined;
        setOctave(null);
      } else {
        setDisplay({time:r.time,mode:r.mode,index:r.index,phase:'wait',hit:[...r.hold.completed],charge,wrong:r.wrong});
        frame.current=requestAnimationFrame(tick);
        return;
      }
    }
    setDisplay({time:r.time,mode:r.mode,index:r.index,phase:'playing',hit:[]});
    frame.current=requestAnimationFrame(tick);
  }
  function begin(mode:Mode) {
    const resume=display.phase==='paused'&&display.mode===mode;
    const time=resume?display.time:phrase.start;
    const index=resume?display.index:0;
    reset(time);
    const audio=new PracticePlayback(getPiano()),hold=newHold();
    if (resume) for (const pitch of display.hit) hold.completed.add(pitch);
    sounds.current=practiceSounds(score.parts,selected,time,phrase.end,mode,phrase.targets[0].time);
    const waiting=resume&&mode==='follow'&&!!phrase.targets[index]&&time>=phrase.targets[index].time;
    run.current={mode,time,stamp:audio.context.currentTime,index,waiting,hold,next:0,audio};
    tick();
  }
  function playNote(event:PracticeInput) {
    const note=event.note??0, pitch=note-shift;
    const r=run.current, target=r?.mode==='follow'?phrase.targets[r.index]:undefined;
    if (blocked) return null;
    if (r&&target&&(r.waiting||target.time-r.time<=KEY_CUE_SECONDS*rate)) {
      const now=r.audio.context.currentTime, next=phrase.targets[r.index+1];
      if (event.type==='off') {
        // Register a note that reached its full length between two frames.
        if (r.waiting) holdProgress(r.hold,target,next,rate,now);
        r.hold.down.delete(pitch);
      } else if (target.pitches.includes(pitch)) {
        const start=now+Math.max(0,target.time-r.time)/rate;
        if (!r.hold.down.has(pitch)&&!r.hold.completed.has(pitch)) r.hold.down.set(pitch,start);
        r.firstHit??=start;
        r.wrong=undefined;
      } else if (r.waiting) {
        r.wrong=note;
        window.clearTimeout(wrongTimer.current);
        wrongTimer.current=window.setTimeout(()=>{if(run.current===r)r.wrong=undefined;},650);
      }
    }
    if (selected.drums) {
      if (event.type==='on'&&r&&pitch>=0&&pitch<=127) r.audio.play({note:pitch,velocity:event.velocity||88,channel:9,start:0,duration:.1,track:selected.id,drums:true},r.audio.context.currentTime,.1,false);
      return null;
    }
    return pitch;
  }
  const handleNote=useRef(playNote);
  handleNote.current=playNote;
  useEffect(()=>{
    input.current=(event)=>handleNote.current(event);
    return()=>{input.current=null;};
  },[input]);

  function changePart(id:string) {
    if (id===selected.id) return;
    const lesson=lessons.find(p=>p.id===id)!;
    reset(phrasesFor(lesson.notes,score.duration)[0].start);
    setPartId(id);
    setPhraseIndex(0);
    setMute({});
  }
  function changePhrase(index:number) {
    reset(phrases[index].start);
    setPhraseIndex(index);
  }
  function toggleMute(id:string) {
    const next=!isMuted(id);
    setMute(prev=>({...prev,[id]:next}));
    // Update the gain immediately. The scheduler also reads the latest choices.
    run.current?.audio.mute(id,next);
  }
  const muteRef=useRef(isMuted);
  muteRef.current=isMuted;
  const target=phrase.targets[Math.min(display.index,phrase.targets.length-1)];
  const pitches=target.pitches.map(n=>n+shift);
  const primary=pitches[0], targetLow=Math.min(96,Math.max(0,Math.floor(primary/12)*12-12));
  const maxTarget=pitches.at(-1)!;
  const targetWindow=Math.min(96,Math.max(0,Math.floor(primary/12)*12));
  const minKey=octave??(primary>=48&&maxTarget<=83?48:maxTarget<=targetWindow+35?targetWindow:targetLow);
  const maxKey=Math.min(127,minKey+35);
  const largeRange=phrase.targets.some(g=>g.pitches.some(p=>p+shift<48||p+shift>83));
  const focusPitch=(n:number)=>pitches.includes(n)&&display.phase!=='done';
  const okPitch=(n:number)=>display.hit.includes(n-shift);
  const phraseNotes=useMemo(()=>selected.notes.filter(n=>n.start>=phrase.start-.035&&n.start<phrase.end),[selected,phrase]);
  const bars=phraseNotes.filter(n=>{
    const active=display.phase==='wait'&&Math.abs(n.start-target.time)<.035;
    return n.note+shift>=minKey&&n.note+shift<=maxKey&&n.start>=phrase.targets[0].time&&n.start<display.time+view&&(active||n.start+n.duration>display.time-.25);
  });
  const wantsLight=display.mode==='follow'&&playing&&!blocked&&display.index<phrase.targets.length&&(display.phase==='wait'||target.time-display.time<=KEY_CUE_SECONDS*rate);
  const pendingLights=wantsLight?pitches.filter(n=>n>=48&&n<=83&&!okPitch(n)):[];
  const lightSignature=pendingLights.join(',');
  useEffect(()=>{latestLights.current(pendingLights);},[lightSignature]);
  const chordGroups=phrase.targets.filter(g=>g.pitches.length>1);
  const leap=phrase.targets.findIndex((g,i)=>i>0&&Math.abs(g.pitches[0]-phrase.targets[i-1].pitches[0])>=7);
  const leapNotes=leap>0?[phrase.targets[leap-1],phrase.targets[leap]].map(g=>noteName(g.pitches[0]+shift)).join(' → '):'';
  const quick=phrase.targets.find((g,i)=>i>0&&g.time-phrase.targets[i-1].time<.24);
  const firstChord=chordGroups[0]?.pitches.map(p=>noteName(p+shift)).join(' · ');
  const pitchLabel=(pitch:number)=>noteName(pitch);
  const lane=(pitch:number)=>keyLane(pitch-minKey+48);
  const mixing=score.parts.filter(p=>p.id!==selected.id);
  const progress=Math.min(display.index,phrase.targets.length);
  const shownProgress=display.phase==='done'&&display.mode==='follow'?phrase.targets.length:progress;
  const feedback=display.phase==='done'
    ? display.mode==='follow'?say('这一段弹完了','You played this phrase'):say('示范结束，轮到你了','Demo finished. Your turn.')
    : display.phase==='wait'?display.wrong!==undefined?say('再试一次，找亮起的键','Try the lit key again'):Object.values(display.charge||{}).some(v=>v>0&&v<1)?say('按住，等充能条填满','Hold until the bar fills'):say('按亮键，按住直到充满','Press a lit key and hold to fill')
    : playing?say('音符碰到亮线时下键','Play as notes meet the line'):say('看下一组音符，跟着亮键弹','Watch ahead, then follow the lit keys');

  return <div className="instrument practice-player">
    <div className="practice-selector">
      <label><span>{say('练习音轨','Practice track')}</span><select value={selected.id} onChange={e=>changePart(e.target.value)}>{lessons.map((part,i)=><option key={part.id} value={part.id}>{nameOf(part,zh)}{part.role&&part.role!=='original'?(zh?' · 自动整理':' · Guide'):part.role?'':` · ${say('轨','Track')} ${i-lessons.length+score.parts.length+1}`}</option>)}</select></label>
      <label className="practice-transpose"><span>{say('练习调','Fingering key')}</span><select aria-label={say('练习调','Fingering key')} value={keyChoice} disabled={selected.drums} onChange={e=>{reset();setKeyChoice(Number(e.target.value));}}>
        <option value={-1}>{say('原曲键位','Original keys')}</option>
        {keyNames.map((name,i)=><option key={name} value={i}>{name}{detected?.minor?say(' 小调',' minor'):say(' 调','')}</option>)}
      </select></label>
      {sourceKey===undefined&&!selected.drums&&keyChoice>=0&&<select className="practice-source-key" aria-label={say('选择原曲调性','Set the original key')} value={manualKey??''} onChange={e=>{reset();setManualKey(e.target.value===''?null:Number(e.target.value));}}>
        <option value="">{say('选择原曲调性','Set original key')}</option>
        {keyNames.map((name,i)=><option key={name} value={i}>{name}</option>)}
      </select>}
      <div className="practice-phrases">
        <button type="button" onClick={()=>changePhrase(phraseIndex-1)} disabled={!phraseIndex} aria-label={say('上一段','Previous phrase')}><ChevronLeft size={17}/></button>
        <select aria-label={say('练习分段','Practice phrase')} value={phraseIndex} onChange={e=>changePhrase(Number(e.target.value))}>{phrases.map((p,i)=><option key={i} value={i}>{say('第','Part ')}{i+1}{say('段','')} · {clockText(p.targets[0].time)}</option>)}</select>
        <button type="button" onClick={()=>changePhrase(phraseIndex+1)} disabled={phraseIndex>=phrases.length-1} aria-label={say('下一段','Next phrase')}><ChevronRight size={17}/></button>
      </div>
      <button className="practice-tools" aria-expanded={panel!==null} onClick={()=>setPanel(panel?null:'tips')}>{say('技巧与混音','Tips & mix')}</button>
    </div>
    <div className="practice-instrument">
      <div className="note-display practice-roll">
        <div className="practice-roll-head">
          <span><i/>{say('预判区','Look ahead')}</span>
          <span className="practice-sounding">{selected.drums?say('节奏轨','Rhythm track'):sourceKey===undefined?say('播放原曲音高','Original pitches'):`${say('原曲响起','Sounds in')} ${keyNames[sourceKey]}${detected?.minor?say(' 小调',' minor'):say(' 调','')}`}</span>
          <select aria-label={say('瀑布流预判时间','Waterfall preview time')} value={view} onChange={e=>setView(Number(e.target.value))}>
            <option value={3}>{say('近 · 3 秒','Near · 3s')}</option><option value={4.5}>{say('标准 · 4.5 秒','Standard · 4.5s')}</option><option value={6}>{say('远 · 6 秒','Far · 6s')}</option>
          </select>
        </div>
        <div className="roll-grid practice-grid" aria-hidden="true">
          {display.phase!=='done'&&pitches.filter(n=>n>=minKey&&n<=maxKey).map(n=><span key={n} className={`practice-lane${okPitch(n)?' hit':''}`} style={{left:`${lane(n)}%`}}/>)}
          <div className={`practice-strike ${display.phase==='wait'?'active':''}`}/>
          {bars.map((n,i)=>{
            const pitch=n.note+shift, current=focusPitch(pitch)&&Math.abs(n.start-target.time)<.035;
            const charge=display.charge?.[n.note]??0;
            const bottom=current&&display.phase==='wait'?5:5+(n.start-display.time)*91/view;
            return <div key={`${n.start}-${n.note}-${i}`} className={`practice-note${current?' current':''}${current&&okPitch(pitch)?' hit':''}`} style={{left:`${lane(pitch)}%`,bottom:`${bottom}%`,height:`${Math.max(5,n.duration*91/view)}%`}}>
              {current&&<><span style={{height:`${charge*100}%`}}/><b>{noteName(pitch)}</b></>}
            </div>;
          })}
        </div>
      </div>
      <StudioKeyboard zh={zh} connected={!!device} label={say('练习琴键','Practice keys')} pressed={pressed} onInput={screenInput} start={minKey} targets={display.phase==='done'||playing&&display.mode==='follow'&&!wantsLight?[]:pitches} hits={display.hit.map(n=>n+shift)} charges={Object.fromEntries(Object.entries(display.charge||{}).map(([n,value])=>[Number(n)+shift,value]))} compact/>
      <div className="practice-feedback">
        <span role="status">{feedback}</span>
        <span className="practice-pitches" aria-label={say('当前目标音','Target notes')}>{display.phase==='done'?null:pitches.map(n=><kbd key={n} className={okPitch(n)?'hit':''}>{pitchLabel(n)}{display.phase==='wait'&&<small>{okPitch(n)?'✓':`${(Math.ceil(10*holdSeconds(target,phrase.targets[display.index+1],n-shift,rate)*(1-(display.charge?.[n-shift]||0)))/10).toFixed(1)}s`}</small>}</kbd>)}</span>
        {largeRange&&<span className="practice-octaves"><button disabled={minKey<=0} onClick={()=>setOctave(Math.max(0,minKey-12))} aria-label={say('低一个八度','Lower keyboard octave')}><ChevronLeft size={14}/></button>{pitchLabel(minKey)}–{pitchLabel(maxKey)}<button disabled={minKey>=96} onClick={()=>setOctave(Math.min(96,minKey+12))} aria-label={say('高一个八度','Raise keyboard octave')}><ChevronRight size={14}/></button></span>}
      </div>
    </div>
    {panel&&<aside className="practice-panel">
      <div className="practice-panel-tabs" role="group" aria-label={say('学习工具','Learning tools')}>
        <button onClick={()=>setPanel('tips')} aria-pressed={panel==='tips'}>{say('弹奏技巧','How to play')}</button>
        <button onClick={()=>setPanel('mix')} aria-pressed={panel==='mix'}>{say('伴奏混音','Track mixer')}</button>
      </div>
      {panel==='tips'?<div className="practice-tips">
        <strong>{nameOf(selected,zh)} · {say('第','Part ')}{phraseIndex+1}{say('段','')}</strong>
        <p>{selected.drums?say('把亮键当成打击垫，先把这一段的节奏弹准。','Treat the lit keys as pads. Work on the rhythm first.'):
          chordGroups.length?say(`这段有 ${chordGroups.length} 组和弦。每个亮键按到充满，就能练下一组。`,`This phrase has ${chordGroups.length} chord groups. Hold each lit key until it fills to advance.`):
          say('音符触线时按亮键，长音保持按住。','Play the lit key at the line. Keep holding long notes.')}</p>
        {firstChord&&<p>{say('先练第一组','Try the first group')} <b>{firstChord}</b></p>}
        {leapNotes&&<p>{say('先单练这次大跳','Practice this leap on its own')} <b>{leapNotes}</b></p>}
        {quick&&<p>{say(`从 ${clockText(quick.time)} 开始有密集音符，先用半速听清起落。`,`The notes get close together at ${clockText(quick.time)}. Listen at half speed first.`)}</p>}
        {shift!==semitones&&<p>{say('键位已换到 36 键可弹的八度。','Fingering moved by an octave to fit 36 keys.')}</p>}
        {largeRange&&<p>{say('音域超过 36 键时，用琴键旁的箭头切换屏幕八度。','Use the octave arrows when notes extend beyond 36 keys.')}</p>}
        {!score.key&&sourceKey!==undefined&&!selected.drums&&<label className="practice-key-override">{say('原曲调性','Original key')} <select value={manualKey??''} onChange={e=>{reset();setManualKey(e.target.value===''?null:Number(e.target.value));}}>
          <option value="">{say('自动识别','Auto detect')}</option>{keyNames.map((name,i)=><option key={name} value={i}>{name}</option>)}
        </select></label>}
        <small>{details}</small>
      </div>:<div className="practice-mixer">
        <small>{say('跟弹时，自己弹的轨由你演奏。示范以钢琴与节奏音色播放 MIDI。','In follow mode, you play the selected part. Demos use piano and rhythm sounds for MIDI.')}</small>
        {!mixing.length?<p>{say('这个练习谱只有一条音轨。','This score has one track.')}</p>:mixing.map(part=><button className="practice-mix-row" key={part.id} onClick={()=>toggleMute(part.id)} aria-pressed={isMuted(part.id)} title={isMuted(part.id)?say('打开声音','Unmute'):say('静音','Mute')}>
          {isMuted(part.id)?<VolumeX size={15}/>:<Volume2 size={15}/>}<span>{nameOf(part,zh)}</span><small>{isMuted(part.id)?say('已静音','Muted'):say('有声','Audible')}</small>
        </button>)}
      </div>}
    </aside>}
    <div className="practice-transport">
      <div className="practice-speed" role="group" aria-label={say('练习速度','Practice speed')}>{rates.map(speed=><button key={speed} aria-pressed={rate===speed} onClick={()=>{if(rate!==speed){reset();setRate(speed);}}}>{Math.round(speed*100)}%</button>)}</div>
      <button className="previous-step" onClick={()=>display.mode==='demo'&&playing?pause():begin('demo')}>{display.mode==='demo'&&playing?<Pause size={15}/>:<Play size={15}/>}<span>{display.mode==='demo'&&playing?say('暂停','Pause'):display.mode==='demo'&&display.phase==='paused'?say('继续示范','Resume demo'):say('听示范','Hear demo')}</span></button>
      <button className="next-button" onClick={()=>display.mode==='follow'&&playing?pause():begin('follow')}>{display.mode==='follow'&&playing?<Pause size={15}/>:<KeyboardMusic size={15}/>}<span>{display.mode==='follow'&&playing?say('暂停跟弹','Pause follow'):display.mode==='follow'&&display.phase==='paused'?say('继续跟弹','Resume playing'):say('开始跟弹','Play along')}</span></button>
      {display.phase==='done'&&display.mode==='follow'&&phraseIndex+1<phrases.length
        ?<button className="previous-step" onClick={()=>changePhrase(phraseIndex+1)}>{say('下一段','Next phrase')}<ChevronRight size={16}/></button>
        :<button className="practice-reset" aria-label={say('重练本段','Restart phrase')} onClick={()=>reset()}><RotateCcw size={16}/></button>}
      <div className="practice-meter"><progress aria-label={say('本段进度','Phrase progress')} max={phrase.targets.length} value={shownProgress}/><small>{shownProgress}/{phrase.targets.length} {say('组','groups')}</small></div>
    </div>
  </div>;
}
