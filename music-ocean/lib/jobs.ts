import {env} from 'cloudflare:workers';
import {validateNotes} from './midi.mjs';
export type Clip={id:string;status:string;title:string;audio_url:string|null;song_url:string|null;image_url:string|null;duration:number|null;error:string|null;embed_url?:string|null};
export type Creation={id:string;provider:string;requestId:string;title:string;prompt:string;instrumental:boolean;scene:number;phase:string;sourceId?:string;clipIds:string[];clips:Clip[];notes:any[];pedals:any[];sourceKey:string;createdAt:number;updatedAt:number;error?:string;errorCode?:string;fingerprint:string;legacy?:boolean;lockUntil?:number;lease?:string;customBinding?:string;pollOffset?:number;resumePhase?:string};
type Context={token:string;custom:any;call:(token:string,tool:string,args?:any)=>Promise<any>;normalize:(raw:any)=>any;publicHttps:(url:string)=>URL;fetch?:typeof fetch;uploadFetch?:typeof fetch};
const fail=(message:string,status=400,code='request_failed')=>Object.assign(new Error(message),{status,code});
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const bindings=()=>{if(!env.DB||!env.BUCKET)throw fail('Creation storage is unavailable. Your melody is still saved on this device.',503,'storage_unavailable');return {db:env.DB,bucket:env.BUCKET};};
export function requestOwner(req:Request){const user=req.headers.get('oai-authenticated-user-id');if(!user)throw fail('Sign in to save and recover your creations.',401,'site_signin_required');return user;}
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const idValid=(id:string)=>/^[a-zA-Z0-9_-]{1,150}$/.test(id);
async function get(owner:string,id:string){const row=await bindings().db.prepare('SELECT document FROM ocean_creations WHERE owner=? AND id=?').bind(owner,id).first<{document:string}>();if(!row)throw fail('This creation was not found.',404,'creation_not_found');return JSON.parse(row.document) as Creation;}
async function save(owner:string,job:Creation){job.updatedAt=Math.max(Date.now(),job.updatedAt+1);const result=await bindings().db.prepare("UPDATE ocean_creations SET document=?,updated_at=? WHERE owner=? AND id=? AND json_extract(document,'$.lease')=?").bind(JSON.stringify(job),job.updatedAt,owner,job.id,job.lease).run();if(!(result.meta.changes||0))throw fail('Another request has recovered this task. Reload its latest state.',409,'lease_lost');}
async function claim(owner:string,j:Creation){const previous=j.updatedAt;j.lockUntil=Date.now()+180000;j.lease=crypto.randomUUID();j.updatedAt=Math.max(Date.now(),previous+1);const result=await bindings().db.prepare('UPDATE ocean_creations SET document=?,updated_at=? WHERE owner=? AND id=? AND updated_at=?').bind(JSON.stringify(j),j.updatedAt,owner,j.id,previous).run();return (result.meta.changes||0)>0;}
export function embedUrl(c:Clip,provider:string){if(provider!=='suno'||c.audio_url||!c.song_url)return null;try{const u=new URL(c.song_url),m=u.pathname.match(/^\/song\/([a-zA-Z0-9-]+)\/?$/);return u.protocol==='https:'&&['suno.com','www.suno.com'].includes(u.hostname)&&m?.[1]===c.id?`https://suno.com/embed/${c.id}`:null;}catch{return null;}}
const view=(j:Creation)=>({...j,sourceKey:undefined,fingerprint:undefined,lockUntil:undefined,lease:undefined,customBinding:undefined,source_url:`/api/jobs/${j.id}/source`,delayed:Date.now()-j.createdAt>180000&&!['complete','error'].includes(j.phase),clips:j.clips.map(c=>({...c,embed_url:embedUrl(c,j.provider)}))});
export async function readJob(req:Request,id:string){return get(requestOwner(req),id);}
export async function jobRead(req:Request,path:string):Promise<Response|null>{
 if(!path.startsWith('jobs'))return null;const owner=requestOwner(req),parts=path.split('/');
 if(req.method==='GET'&&parts.length===1){const rows=await bindings().db.prepare('SELECT document FROM ocean_creations WHERE owner=? ORDER BY created_at DESC LIMIT 40').bind(owner).all<{document:string}>();return json({jobs:rows.results.map(r=>view(JSON.parse(r.document)))});}
 if(req.method==='GET'&&parts[2]==='source'){
  const job=await get(owner,parts[1]),object=await bindings().bucket.get(job.sourceKey,req.headers.has('range')?{range:req.headers}:undefined);if(!object)throw fail('Original melody is unavailable.',404);
  const range=object.range as {offset?:number;length?:number}|undefined,offset=range?.offset||0,length=range?.length||object.size;const headers=new Headers({'Content-Type':'audio/wav','Content-Length':String(length),'Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600','Vary':'Cookie','X-Content-Type-Options':'nosniff'});if(range)headers.set('Content-Range',`bytes ${offset}-${offset+length-1}/${object.size}`);return new Response(object.body,{status:range?206:200,headers});
 }
 if(req.method==='GET'&&parts.length===2)return json(view(await get(owner,parts[1])));return null;
}
export async function jobWrite(req:Request,path:string,ctx:Context):Promise<Response|null>{
 if(!path.startsWith('jobs'))return null;const owner=requestOwner(req),parts=path.split('/');
 if(req.method==='POST'&&parts.length===1){
  if(Number(req.headers.get('content-length')||0)>13000000)throw fail('Melody file is too large.',413);
  const form=await req.formData();let seed:any;try{seed=JSON.parse(String(form.get('midi')||'{}'));}catch{throw fail('Invalid melody notes.');}
  if(!validateNotes(seed.notes))throw fail('Record at least 3 valid notes.');const file=form.get('audio');if(!(file instanceof File)||file.size<44||file.size>12000000)throw fail('Invalid melody audio.');
  const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,4))!=='RIFF'||new TextDecoder().decode(bytes.slice(8,12))!=='WAVE')throw fail('Invalid WAV audio.');
  const id=String(form.get('requestId')||'');if(!/^[0-9a-f-]{36}$/i.test(id))throw fail('Missing creation request key.');
  const provider=String(form.get('provider')||'suno');if(!['suno','custom'].includes(provider))throw fail('Unknown music service.');
  const title=String(form.get('title')||'Ocean Echo').slice(0,100),prompt=String(form.get('prompt')||'').slice(0,1000),instrumental=form.get('instrumental')!=='false';
  const audioHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.buffer))).map(x=>x.toString(16).padStart(2,'0')).join('');const customBinding=provider==='custom'?await hash(JSON.stringify([ctx.custom.url,ctx.custom.statusUrl,ctx.custom.model])):undefined;const fingerprint=await hash(JSON.stringify([seed.notes,seed.pedals||[],provider,title,prompt,instrumental,audioHash,customBinding]));let existing:Creation|null=null;try{existing=await get(owner,id);}catch(e){if((e as any).status!==404)throw e;}
  if(existing){if(existing.fingerprint!==fingerprint)throw fail('This request key already belongs to a different melody.',409);return json(view(existing));}
  const sourceKey=`originals/${(await hash(owner)).slice(0,24)}/${id}-${audioHash.slice(0,24)}.wav`,now=Date.now();await bindings().bucket.put(sourceKey,bytes,{httpMetadata:{contentType:'audio/wav'}});
  const legacyId=String(form.get('legacyId')||'');const legacy=!!legacyId&&idValid(legacyId);const legacyIds=legacy?legacyId.split(',').filter(idValid):[];
  const job:Creation={id,provider,requestId:id,title,prompt,instrumental,scene:Math.max(0,Math.min(2,Number(form.get('scene')||0))),phase:legacy?'generating':'upload_needed',clipIds:legacyIds,clips:[],notes:seed.notes,pedals:Array.isArray(seed.pedals)?seed.pedals:[],sourceKey,createdAt:now,updatedAt:now,fingerprint,legacy,customBinding};
  if(legacy&&form.get('legacyPhase')==='upload'){job.phase='source_processing';job.sourceId=legacyId;job.clipIds=[];}
  await bindings().db.prepare('INSERT OR IGNORE INTO ocean_creations(id,owner,request_key,document,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,owner,id,JSON.stringify(job),now,now).run();const winner=await get(owner,id);if(winner.fingerprint!==fingerprint)throw fail('This request key already belongs to a different melody.',409);return json(view(winner),201);
 }
 if(req.method==='POST'&&parts[2]==='advance'){
  let job=await get(owner,parts[1]);if(['complete','error','submission_unknown'].includes(job.phase))return json(view(job));
  if((job.lockUntil||0)>Date.now())return json(view(job));
  if(!await claim(owner,job))return json(view(await get(owner,job.id)));
  try{
   if(job.provider==='custom'&&job.customBinding!==await hash(JSON.stringify([ctx.custom?.url,ctx.custom?.statusUrl,ctx.custom?.model]))){throw fail('Reconnect the original API endpoint and model to check this task.',409,'provider_settings_changed');}if(job.phase==='settings_required'){job.phase=job.resumePhase||'generating';job.resumePhase=undefined;}
   if(['upload_needed','uploading'].includes(job.phase)){
    job.phase='uploading';job.error=undefined;await save(owner,job);const source=await bindings().bucket.get(job.sourceKey);if(!source)throw fail('Original melody was not found.',404);
    if(job.provider==='custom'){
     const custom=ctx.custom;if(!custom)throw fail('Connect your selected music service.',401);const fd=new FormData();fd.set('audio',new Blob([await source.arrayBuffer()],{type:'audio/wav'}),'melody.wav');fd.set('midi',JSON.stringify({format:'notes',bpm:96,notes:job.notes,pedals:job.pedals}));fd.set('prompt',job.prompt);fd.set('instrumental',String(job.instrumental));fd.set('model',custom.model);fd.set('duration','90');
     const res=await (ctx.fetch||fetch)(custom.url,{method:'POST',headers:{...(custom.key?{Authorization:`Bearer ${custom.key}`}:{ }),'Idempotency-Key':job.requestId},body:fd,signal:AbortSignal.timeout(45000)});const raw=await res.json() as any;if(!res.ok)throw fail(raw.error?.message||raw.error||'Music service unavailable.',res.status);const normalized=ctx.normalize(raw);job.clipIds=normalized.clip_ids;job.clips=normalized.clips;job.phase='generating';
    }else{
     const upload=await ctx.call(ctx.token,'audio-upload-create',{title:job.title});if(!upload.id||!upload.upload_url)throw fail('Suno did not return an upload location.',502);job.sourceId=upload.id;await save(owner,job);
     const target=ctx.publicHttps(upload.upload_url);if(!['.amazonaws.com','.cloudflarestorage.com','.suno.com','.suno.ai','.googleapis.com'].some(s=>target.hostname.endsWith(s)))throw fail('Suno returned an unrecognized upload host.',502);
     const sent=await (ctx.uploadFetch||fetch)(target.href,{method:'PUT',headers:{'Content-Type':'audio/wav'},body:await source.arrayBuffer(),signal:AbortSignal.timeout(25000)});if(!sent.ok)throw fail('The melody upload did not finish.',502);
     const completed=ctx.normalize(await ctx.call(ctx.token,'audio-upload-complete',{id:upload.id}));if(!completed.id)throw fail('Suno did not return the uploaded audio clip ID.',502,'missing_source_id');job.sourceId=completed.id;job.phase='source_processing';
    }await save(owner,job);return json(view(job));
   }
   if(job.phase==='source_processing'){
    const source=ctx.normalize(await ctx.call(ctx.token,'audio-retrieve',{id:job.sourceId}));if(['error','failed'].includes(source.status)){job.phase='error';job.error=source.error||'Suno could not process the melody.';}else if(source.status==='complete'){job.phase='generation_needed';}await save(owner,job);return json(view(job));
   }
   if(['generation_needed','submitting'].includes(job.phase)){
    job.phase='submitting';job.error=undefined;await save(owner,job);
    const raw=job.instrumental?await ctx.call(ctx.token,'audio-covers-create',{id:job.sourceId,style:job.prompt,duration:90,idempotency_key:job.requestId}):await ctx.call(ctx.token,'audio-create',{description:job.prompt,reference_audio_ids:[job.sourceId],instrumental:false,duration:90,duration_strict:false,title:job.title,idempotency_key:job.requestId});
    const normalized=ctx.normalize(raw);if(!normalized.clip_ids.length)throw fail('Suno did not return a creation ID. The request key is preserved for safe recovery.',502,'missing_creation_id');job.clipIds=normalized.clip_ids;job.clips=normalized.clips;job.phase='generating';await save(owner,job);return json(view(job));
   }
   if(job.phase==='generating'){
    if(job.provider==='custom'){
     if(!ctx.custom?.statusUrl){if(!job.clips.some(c=>c.audio_url||c.song_url))throw fail('Add a status endpoint for this music service.',400);}
     else {const res=await (ctx.fetch||fetch)(ctx.custom.statusUrl.replace('{id}',encodeURIComponent(job.clipIds[0])),{headers:ctx.custom.key?{Authorization:`Bearer ${ctx.custom.key}`}:{},signal:AbortSignal.timeout(20000)});if(!res.ok)throw fail('Unable to check the music service.',res.status);job.clips=ctx.normalize(await res.json()).clips;}
    }else{
     const outstanding=job.clipIds.filter(id=>!job.clips.some(c=>c.id===id&&['complete','error','failed','cancelled'].includes(c.status))),offset=(job.pollOffset||0)%Math.max(1,outstanding.length),targets=[...outstanding.slice(offset),...outstanding.slice(0,offset)].slice(0,4);job.pollOffset=(offset+targets.length)%Math.max(1,outstanding.length);
     const reads=await Promise.allSettled(targets.map(id=>ctx.call(ctx.token,'audio-retrieve',{id})));
     const byId=new Map(job.clips.map(c=>[c.id,c]));let expected=[...job.clipIds];
     for(let i=0;i<reads.length;i++){const r=reads[i];if(r.status!=='fulfilled')continue;const normalized=ctx.normalize(r.value);if(normalized.clip_ids.length&& !normalized.clip_ids.includes(targets[i]))expected=expected.filter(id=>id!==targets[i]);expected=Array.from(new Set([...expected,...normalized.clip_ids]));for(const c of normalized.clips)if(c.id)byId.set(c.id,c);}
     if(reads.length&&reads.every(r=>r.status==='rejected'))throw (reads[0] as PromiseRejectedResult).reason;
     job.clipIds=expected;job.clips=expected.map(id=>byId.get(id)||{id,status:'queued',title:job.title,audio_url:null,song_url:null,image_url:null,duration:null,error:null});
    }
    const playable=job.clips.some(c=>['streaming','complete'].includes(c.status)&&(c.audio_url||c.song_url||job.provider==='suno'));
    if(playable&&job.clips.every(c=>['complete','error','failed','cancelled'].includes(c.status)))job.phase='complete';
    else if(job.clips.length&&job.clips.every(c=>['error','failed','cancelled'].includes(c.status))){job.phase='error';job.error=job.clips.find(c=>c.error)?.error||'The music service could not finish this creation.';}
    job.error=job.phase==='error'?job.error:undefined;job.errorCode=undefined;await save(owner,job);
   }
  }catch(error){const e=error as any;job.error=e.message||'The music service is unavailable.';job.errorCode=e.code||'provider_unavailable';if(e.code==='provider_settings_changed'&&job.phase!=='settings_required'){job.resumePhase=job.phase;job.phase='settings_required';}if(job.phase==='uploading')job.phase=job.provider==='custom'?'submission_unknown':'upload_needed';if(e.status===402||[400,403].includes(e.status)){job.phase='error';}await save(owner,job);if(e.status===401)throw e;}finally{job.lockUntil=0;try{await save(owner,job);}catch(e){if((e as any).code!=='lease_lost')throw e;}}
  return json(view(job));
 }
 return null;
}
