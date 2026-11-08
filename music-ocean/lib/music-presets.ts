import type {Lang} from './copy';

// One source for the visible templates and the actual generation direction.
// Describe the requested musical traits; do not ask for an artist's voice.
export const MAX_DIRECTION_CHARS=500;
export const MAX_PROMPT_CHARS=1000;
export const MUSIC_PRESETS = [
  {id:'neon-funk',bpm:116,genre:'FUNK / ALT POP',zh:'霓虹切分',en:'Neon Funk',
    description:{zh:'弹性贝斯、干脆鼓点、切分电钢琴。开场两拍就给出钩子，副歌大胆抬升。',en:'Rubbery bass, dry drums and syncopated keys. Instant hook, bold chorus.'},
    prompt:'116 BPM, bold syncopated funk-pop. Rubbery bass, dry punchy drums, clipped clavinet and electric piano, chromatic turnarounds. Cold-open with an instantly memorable hook in the first two beats; an early, explosive chorus.'},
  {id:'velvet-offbeat',bpm:118,genre:'ALT R&B / GROOVE',zh:'丝绒反拍',en:'Velvet Offbeat',
    description:{zh:'反拍电钢琴和紧实低频，九和弦里带一点出其不意。精致、张扬，有弹性。',en:'Offbeat keys, tight bass and unexpected ninths. Polished, playful and confident.'},
    prompt:'118 BPM, assertive alternative R&B with a crisp syncopated pocket. Staccato Rhodes, tight sub-bass, bright percussion, surprising major-7 and 9 voicings. Start with a catchy refrain immediately; energetic, playful tension and release.'},
  {id:'chrome-disco',bpm:124,genre:'NU DISCO / FRENCH TOUCH',zh:'铬光迪斯科',en:'Chrome Disco',
    description:{zh:'切分吉他、八度贝斯和滤波闪光。短促停顿后再起跳，复古里有未来感。',en:'Clipped guitar, octave bass and filter flashes. Retro shine with a future edge.'},
    prompt:'124 BPM, distinctive nu-disco with a French-touch edge. Tight muted rhythm guitar, octave bass, filtered synth accents and crisp four-on-the-floor drums. A strong two-bar hook from the opening, stop-start breaks and a swaggering chorus.'},
  {id:'glitch-hook',bpm:128,genre:'ELECTRO POP / BROKEN BEAT',zh:'碎拍电流',en:'Glitch Hook',
    description:{zh:'打击式合成器、碎拍和两小节问答。旋律鲜明，转折利落，第一秒就有记忆点。',en:'Percussive synths, broken beats and two-bar hooks. Sharp turns, instant recall.'},
    prompt:'128 BPM, agile left-field electro-pop with chopped rhythmic motifs, percussive synth hooks, punchy broken beats and chromatic turnarounds. Instant first-second melodic signature, two-bar call and response, compact sections and an audacious chorus.'},
  {id:'brass-bounce',bpm:122,genre:'ELECTRO FUNK / NEW JACK',zh:'铜管起跳',en:'Brass Bounce',
    description:{zh:'铜管短句、摇摆军鼓和会跳的贝斯。自信、俏皮，适合一听就跟着动。',en:'Brass stabs, swinging snares and bouncing bass. Confident, playful, made to move.'},
    prompt:'122 BPM, extroverted electro-funk with new-jack swing. Punchy brass stabs, tight bouncing bass, snappy breakbeat snares and rhythmic keyboard chops. Cold-open with the main hook, playful swagger, unexpected rhythmic stops and a high-impact chorus.'},
] as const;

export function musicDirection(index:number, extra:string, lang:Lang){
  const preset=MUSIC_PRESETS[index]||MUSIC_PRESETS[0];
  return `${preset.prompt} Preserve the supplied MIDI melody as the main motif. Short intro, immediate ear-catching energy, distinctive arrangement. ${lang==='zh'?'用户补充':'Additional direction'}: ${extra.trim().slice(0,MAX_DIRECTION_CHARS)||'None.'}`;
}

const PRODUCTION_NOTES = [
  ['Bold syncopated funk-pop, 116 BPM, tight 4/4 pocket.', 'Rubbery bass, dry punchy drums, clipped clavinet, bright electric piano.', 'Chromatic turnarounds, major-7 and 9 voicings, playful tension and release.', 'Cold-open with a hook in the first two beats; compact verse, rising pre-chorus, explosive chorus, short rhythmic break, bigger final chorus.', 'Crisp transients, tight low end, wide keys, dry upfront groove.'],
  ['Assertive alternative R&B, 118 BPM, crisp offbeat groove.', 'Staccato Rhodes, tight sub-bass, bright hand percussion, clipped guitar.', 'Unexpected major-7 and 9 chords with chromatic passing tones.', 'Immediate catchy refrain; intimate verse, suspended pre-chorus, bold open chorus, stripped-down bridge, final hook variation.', 'Warm keys, punchy dry drums, detailed percussion, controlled sub-bass.'],
  ['Nu-disco with a French-touch edge, 124 BPM, driving four-on-the-floor.', 'Muted rhythm guitar, octave bass, filtered synth accents, crisp disco drums.', 'Colorful seventh chords, rising inversions, short chromatic transitions.', 'Open with a strong two-bar hook; tight verse, filter-rise build, swaggering chorus, stop-start breakdown, full-energy final chorus.', 'Glossy stereo synths, dry centered bass, sharp guitar, clean punchy mix.'],
  ['Left-field electro-pop, 128 BPM, agile broken-beat groove.', 'Chopped synth motifs, percussive plucks, punchy kick, snappy snares.', 'Bright extended chords, chromatic turnarounds, unexpected harmonic pivots.', 'First-second melodic signature; two-bar call and response, compact verse, audacious chorus, sudden rhythmic stop, final hook reprise.', 'Precise edits, crisp transients, wide synths, tight low end; keep the hook upfront.'],
  ['Extroverted electro-funk, 122 BPM, new-jack swing pocket.', 'Punchy brass stabs, bouncing bass, snappy breakbeat snares, rhythmic keyboard chops.', 'Dominant ninths, funky passing chords, short brass answers.', 'Cold-open with the main hook; playful verse, rising pre-chorus, high-impact chorus, unexpected rhythmic stops, bigger final chorus.', 'Brass bright and tight, bass and kick locked together, dry drums, polished wide mix.'],
] as const;

const PRODUCTION_NOTES_ZH = [
  ['张扬的切分放克流行，每分钟116拍，紧实的四拍律动。','弹性贝斯、干脆有力的鼓、短促击弦古钢琴、明亮电钢琴。','半音经过与转折，大七和弦、九和弦，俏皮的张力与释放。','前两拍就亮出主钩子；紧凑主歌、逐步抬升的预副歌、爆发副歌、短促节奏留白，最后一遍副歌再升级。','鼓点瞬态清晰、低频紧实、电钢琴立体展开，整体干爽，律动靠前。'],
  ['自信张扬的另类节奏布鲁斯，每分钟118拍，干脆的反拍律动。','短促电钢琴、紧实超低音、明亮手打击乐、切分吉他。','大七和弦与九和弦里加入意外转折，以半音经过音连接。','开场直接给出抓耳短句；贴近耳边的主歌、制造悬念的预副歌、开阔副歌、精简过桥，结尾让主钩子变化回归。','电钢琴温暖，鼓干爽有冲击，打击乐细节清楚，低频收紧。'],
  ['带法式滤波质感的新迪斯科，每分钟124拍，持续推进的四拍舞曲律动。','闷音切分吉他、八度跳跃贝斯、滤波合成器、干脆迪斯科鼓组。','色彩鲜明的七和弦、逐步抬高的转位与短促半音连接。','开场就是两小节主钩子；紧凑主歌、滤波渐开的推进、昂扬副歌、突然停顿的间奏，最后副歌全能量释放。','合成器光泽感强，立体声开阔，贝斯居中收紧，吉他利落，混音干净有冲击。'],
  ['灵活前卫的碎拍电子流行，每分钟128拍，敏捷而有弹性的律动。','切碎的合成器动机、打击式拨弦音色、有力底鼓、短促军鼓。','明亮的延伸和弦、半音转折和出其不意的和声支点。','第一秒给出记忆点；两小节问答，紧凑主歌、大胆副歌、突然的节奏停顿，结尾重现主钩子。','剪辑精准，瞬态清晰，合成器立体展开，低频收紧，主旋律始终突出。'],
  ['外放的电子放克，每分钟122拍，带新杰克摇摆感的节奏口袋。','有冲击的铜管短句、跳跃贝斯、碎拍军鼓、节奏化键盘切片。','属九和弦、放克经过和弦与短促铜管应答。','直接用主钩子开场；俏皮主歌、逐步抬升的预副歌、高冲击副歌、意外的节奏停顿，最后一遍副歌加大力度。','铜管明亮紧凑，贝斯与底鼓咬合，鼓组干爽，整体精致且开阔。'],
] as const;

// This is both the visible, editable brief and the exact submitted prompt.
export function buildMusicPrompt(index:number,instrumental:boolean,lang:Lang='en'){
  if(lang==='zh'){
    const [style,instruments,harmony,arrangement,production]=PRODUCTION_NOTES_ZH[index]||PRODUCTION_NOTES_ZH[0];
    return `风格：${style}\n配器：${instruments}\n和声：${harmony}\n段落：${arrangement}\n制作：${production}\n旋律：保留输入的弹奏旋律作为核心动机，保持旋律轮廓和节奏的辨识度。\n${instrumental?'人声：纯音乐，不加入演唱或人声采样。':'人声：中文演唱，自信且节奏鲜明的主唱，灵活短句，副歌叠唱和声，旋律抓耳易记。'}`;
  }
  const [style,instruments,harmony,arrangement,production]=PRODUCTION_NOTES[index]||PRODUCTION_NOTES[0];
  return `Style: ${style}\nInstruments: ${instruments}\nHarmony: ${harmony}\nArrangement: ${arrangement}\nProduction: ${production}\nMelody: preserve the supplied MIDI melody as the main motif.\n${instrumental?'Vocals: instrumental only, no singing.':'Vocals: English-language, confident rhythmic lead, agile phrasing, stacked chorus harmonies and a memorable refrain.'}`;
}
export function musicPromptKey(index:number,instrumental:boolean,lang:Lang='en'){
  return `${(MUSIC_PRESETS[index]||MUSIC_PRESETS[0]).id}:${instrumental?'instrumental':'vocal'}:${lang}`;
}
export function restoreMusicDirection(saved:unknown,_lang:Lang='en'){
  const data=saved&&typeof saved==='object'?saved as Record<string,unknown>:{};
  const found=MUSIC_PRESETS.findIndex(p=>p.id===data.preset),style=found<0?0:found,instrumental=data.instrumental!==false;
  const edits:Record<string,string>={};
  if(data.version===3&&data.prompts&&typeof data.prompts==='object'){
    const prompts=data.prompts as Record<string,unknown>;
    for(let i=0;i<MUSIC_PRESETS.length;i++)for(const format of [true,false])for(const language of ['zh','en'] as const){
      const key=musicPromptKey(i,format,language);
      if(typeof prompts[key]==='string')edits[key]=prompts[key].slice(0,MAX_PROMPT_CHARS);
    }
  }else if(data.version===2&&data.prompts&&typeof data.prompts==='object'){
    // The unreleased v2 editor used English briefs in either UI language.
    const prompts=data.prompts as Record<string,unknown>;
    for(let i=0;i<MUSIC_PRESETS.length;i++)for(const format of [true,false]){
      const previousKey=`${MUSIC_PRESETS[i].id}:${format?'instrumental':'vocal'}`;
      if(typeof prompts[previousKey]==='string')edits[musicPromptKey(i,format,'en')]=prompts[previousKey].slice(0,MAX_PROMPT_CHARS);
    }
  }else if(typeof data.prompt==='string'&&data.prompt.trim()){
    // Preserve returning users' earlier free-text direction without losing it.
    const legacy=musicDirection(style,data.prompt,'en');
    const format=instrumental?' Instrumental only, no vocals.':' Confident rhythmic lead vocal and stacked chorus harmonies.';
    edits[musicPromptKey(style,instrumental,'en')]=(legacy+format).slice(0,MAX_PROMPT_CHARS);
    edits[musicPromptKey(style,instrumental,'zh')]=`${buildMusicPrompt(style,instrumental,'zh')}\n补充要求：${data.prompt.trim().slice(0,MAX_DIRECTION_CHARS)}`.slice(0,MAX_PROMPT_CHARS);
  }
  return {style,instrumental,edits};
}
