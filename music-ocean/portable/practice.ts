import {readJob} from '../lib/jobs';
import {ApiError,assertSameOrigin,publicHttps,setSessionCookie,sunoCall,sunoSession} from '../lib/suno-server';
import {MAX_MIDI_BYTES,parsePracticeMidi} from '../lib/practice-midi';
import {storage} from './cloudflare-node';
import {publicFetch} from './public-fetch';
import {bridgeFetch,isSunoDownloadUrl} from './suno-bridge';

const headers = {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json = (data:unknown,status=200) => Response.json(data,{status,headers});
type State = {state:'pending'|'ready'|'failed'; lease:number; reason?:string};
type PracticeServices = {transcribe:typeof sunoCall; download:typeof getMidi};

async function getMidi(value:string, suno:boolean) {
  let url = publicHttps(value);
  const signal = AbortSignal.timeout(22000);
  for (let redirects=0;redirects<=3;redirects++) {
    if (suno && !isSunoDownloadUrl(url.href)) throw new ApiError('Unknown Suno MIDI file host.',502,'midi_download_failed');
    const response = await (suno?bridgeFetch:publicFetch)(url.href,{redirect:'manual',signal});
    const location = response.headers.get('location');
    if (location && response.status>=300 && response.status<400) {
      url = publicHttps(new URL(location,url).href);
      continue;
    }
    if (!response.ok || Number(response.headers.get('content-length'))>MAX_MIDI_BYTES) break;
    const reader = response.body?.getReader();
    if (!reader) break;
    const chunks:Uint8Array[] = [];
    let size=0;
    try {
      while (true) {
        const {done,value:chunk} = await reader.read();
        if (done) break;
        size+=chunk.length;
        if (size>MAX_MIDI_BYTES) throw new ApiError('MIDI file is too large.',413,'invalid_midi');
        chunks.push(chunk);
      }
    } finally {
      await reader.cancel().catch(()=>{});
    }
    const bytes = new Uint8Array(size);
    let offset=0;
    for (const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length;}
    return bytes;
  }
  throw new ApiError('Could not fetch the MIDI file.',502,'midi_download_failed');
}

const services:PracticeServices = {transcribe:sunoCall,download:getMidi};
const reasons:Record<string,string> = {
  plan_required:'plan_required',feature_not_on_plan:'plan_required',insufficient_credits:'quota_exhausted',
  quota_exhausted:'quota_exhausted',not_found:'invalid_asset',invalid_asset:'invalid_asset',not_ready:'not_ready',
  invalid_midi:'invalid_midi',midi_download_failed:'midi_download_failed',
  suno_not_connected:'suno_not_connected',connection_expired:'suno_not_connected',
};
const report = (error:unknown) => {
  const e = error as ApiError;
  return reasons[e.code] || (e.status===401?'suno_not_connected':e.status===403?'plan_required':e.status===402?'quota_exhausted':'service_unavailable');
};
function validate(bytes:Uint8Array) {
  try {parsePracticeMidi(bytes);}
  catch {throw new ApiError('Use a valid Standard MIDI file up to 1 MB.',422,'invalid_midi');}
}

export async function practiceApi(req:Request, svc=services):Promise<Response|null> {
  const url = new URL(req.url), match = url.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]{1,150})\/practice$/);
  if (!match) return null;
  try {
    const job = await readJob(req,match[1]);
    const clip = job.clips.find(c=>c.id===url.searchParams.get('clip')&&c.status==='complete');
    if (!clip || !/^[A-Za-z0-9_-]{1,150}$/.test(clip.id)) throw new ApiError('Choose a finished track first.',404,'not_ready');
    const source = url.searchParams.get('source') || (clip.midi_url?'native':'suno');
    if (!(source==='import'||source==='native'&&clip.midi_url||source==='suno'&&job.provider==='suno')) {
      throw new ApiError('Choose an available MIDI source.',400,'invalid_source');
    }
    const key = `practice/${job.id}/${clip.id}-${source}.mid`;
    const where = [job.id,clip.id,source];
    const {DB,BUCKET} = storage;
    const status = async () => await DB.prepare('SELECT state,lease,reason FROM ocean_practice WHERE job_id=? AND clip_id=? AND source=?').bind(...where).first() as State|null;
    const view = (s:State|null) => ({state:s?.state||'idle',reason:s?.reason||undefined});
    if (req.method==='GET') {
      const current = await status();
      if (url.searchParams.get('file')!=='1') return json(view(current));
      const midi = current?.state==='ready' ? await BUCKET.get(key) : null;
      if (!midi) throw new ApiError('MIDI is not ready.',404,'not_ready');
      return new Response(await midi.arrayBuffer(),{headers:{...headers,'Content-Type':'audio/midi'}});
    }
    if (req.method!=='POST') return json({error:'Method not allowed'},405);
    assertSameOrigin(req);
    if (source==='import') {
      if (!req.headers.get('content-type')?.startsWith('audio/midi') || Number(req.headers.get('content-length'))>MAX_MIDI_BYTES) {
        throw new ApiError('Use a valid MIDI file up to 1 MB.',422,'invalid_midi');
      }
      const bytes = new Uint8Array(await req.arrayBuffer());
      validate(bytes);
      await BUCKET.put(key,bytes);
      await DB.prepare("INSERT INTO ocean_practice(job_id,clip_id,source,state) VALUES(?,?,?,'ready') ON CONFLICT(job_id,clip_id,source) DO UPDATE SET state='ready'").bind(...where).run();
      return json({state:'ready'});
    }
    const action = url.searchParams.get('action');
    if (action!=='start'&&action!=='poll') throw new ApiError('Choose a practice action.');
    if (source==='suno'&&action==='start'&&req.headers.get('x-confirm-midi-credits')!=='10') {
      throw new ApiError('Confirm up to 10 Suno credits before transcription.',400,'confirmation_required');
    }
    if (action==='start') {
      await DB.prepare("INSERT OR IGNORE INTO ocean_practice(job_id,clip_id,source,state) VALUES(?,?,?,'pending')").bind(...where).run();
    }
    const current = await status();
    if (!current || current.state==='ready' || current.state==='failed'&&action==='poll') return json(view(current));
    const now = Date.now(), lease = now+120_000;
    const claimed = await DB.prepare("UPDATE ocean_practice SET state='pending',lease=?,reason=NULL WHERE job_id=? AND clip_id=? AND source=? AND state!='ready' AND lease<=?").bind(lease,...where,now).run();
    if (!claimed.meta.changes) return json(view(await status()));
    let session:Awaited<ReturnType<typeof sunoSession>>|undefined;
    let state:State['state']='pending',reason:string|null=null;
    try {
      let midiUrl = clip.midi_url;
      if (source==='suno') {
        session = await sunoSession(req);
        const raw = await svc.transcribe(session.value.access_token,'audio-midi',{id:clip.id});
        const result = raw?.data || raw;
        if (result.reason) throw new ApiError('Transcription is unavailable.',422,result.reason);
        if (result.status==='ok'&&typeof result.url==='string') midiUrl=result.url;
        else if (result.status==='processing') midiUrl=null;
        else throw new ApiError('The MIDI transcription failed.',502,'transcription_failed');
      }
      if (midiUrl) {
        const bytes = await svc.download(midiUrl,job.provider==='suno');
        validate(bytes);
        await BUCKET.put(key,bytes);
        state='ready';
      }
    } catch (error) {
      state='failed';
      reason=report(error);
      if ((error as ApiError).code==='transcription_failed') reason='transcription_failed';
    }
    await DB.prepare('UPDATE ocean_practice SET state=?,lease=0,reason=? WHERE job_id=? AND clip_id=? AND source=? AND lease=?').bind(state,reason,...where,lease).run();
    const response = json(view(await status()));
    if (session?.updated) await setSessionCookie(response,session.value);
    return response;
  } catch (error) {
    const e = error as ApiError;
    return json({error:e.status&&e.status<500?e.message:'The practice service is temporarily unavailable.',code:e.code},e.status||500);
  }
}
