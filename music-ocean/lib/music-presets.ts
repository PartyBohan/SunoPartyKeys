import type {Lang} from './copy';

// One source for the visible templates and the actual generation direction.
// Describe the requested musical traits; do not ask for an artist's voice.
export const MAX_DIRECTION_CHARS=500;
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
