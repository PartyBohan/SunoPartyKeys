import {validateNotes} from './midi.mjs';
import {runtimeValue} from './runtime-env';
import {jobRead,jobWrite} from './jobs';
const API='https://api.suno.com/mcp';
const OAUTH='https://studio-api-prod.suno.com/api/v2/external/oauth';
const COOKIE='ocean_suno';
type Session={access_token:string;refresh_token?:string;expires_at:number};
type Custom={url:string;key:string;statusUrl:string;model:string};
export class ApiError extends Error {constructor(message:string,public status=400,public code='request_failed'){super(message);}}
const config=runtimeValue;
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const cookieValue=(req:Request,name:string)=>req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
const cookie=(name:string,value:string,age=2592000)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const origin=(req:Request)=>config('PUBLIC_ORIGIN')||new URL(req.url).origin;
async function encryptionKey(){const secret=config('OCEAN_COOKIE_SECRET');if(secret.length<32)throw new ApiError('The connection service is not configured yet.',503,'service_not_configured');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function seal(data:unknown){const iv=crypto.getRandomValues(new Uint8Array(12)),encoded=new TextEncoder().encode(JSON.stringify(data));return b64(iv)+'.'+b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(),encoded)));}
async function unseal<T>(value?:string):Promise<T|null>{try{if(!value)return null;const [a,b]=value.split('.');return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(a)},await encryptionKey(),unb64(b))));}catch{return null;}}
async function readJson(res:Response){const text=await res.text();try{return JSON.parse(text);}catch{throw new ApiError(res.ok?'The music service returned an unreadable response.':`Music service HTTP ${res.status}`,res.ok?502:res.status,'provider_response_error');}}
async function oauthToken(body:Record<string,string>){
  const res=await fetch(`${OAUTH}/token/`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'codex/0.160.0'},body:new URLSearchParams(body),signal:AbortSignal.timeout(20000)});
  const data=await readJson(res);if(!res.ok||!data.access_token)throw new ApiError('Please connect your Suno account again.',401,'connection_expired');
  return {...data,expires_at:Date.now()+Number(data.expires_in||900)*1000} as Session;
}
async function session(req:Request){let s=await unseal<Session>(cookieValue(req,COOKIE));if(!s)throw new ApiError('Connect your Suno account in Settings to continue.',401,'suno_not_connected');let updated=false;
  if(s.expires_at<Date.now()+45000){if(!s.refresh_token)throw new ApiError('Please reconnect Suno.',401,'connection_expired');s={...s,...await oauthToken({grant_type:'refresh_token',refresh_token:s.refresh_token,client_id:config('SUNO_CLIENT_ID')})};updated=true;}
  return {value:s,updated};
}
async function rpcResponse(res:Response){
  const text=await res.text();if(!res.ok)throw new ApiError(`Suno HTTP ${res.status}`,res.status,'suno_request_failed');
  if(res.headers.get('content-type')?.includes('text/event-stream')){
    for(const line of text.split('\n').reverse())if(line.startsWith('data:')){try{const data=JSON.parse(line.slice(5));if('result'in data||'error'in data)return data;}catch{}}
    throw new ApiError('Suno returned an incomplete response.',502);
  }
  try{return JSON.parse(text);}catch{throw new ApiError('Suno returned an unreadable response.',502);}
}
export async function sunoCall(token:string,tool:string,args:unknown={}){
  const headers:Record<string,string>={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':`Bearer ${token}`,'User-Agent':'codex/0.160.0'};
  const init=await fetch(API,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'xiaoshigan-music-ocean',version:'2.0.0'}}}),signal:AbortSignal.timeout(20000)});
  const initialized=await rpcResponse(init);if(initialized.error)throw new ApiError(initialized.error.message||'Unable to connect to Suno.',502);
  const sid=init.headers.get('mcp-session-id');if(sid)headers['Mcp-Session-Id']=sid;
  headers['MCP-Protocol-Version']=initialized.result?.protocolVersion||'2024-11-05';
  await fetch(API,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'}),signal:AbortSignal.timeout(10000)});
  const res=await fetch(API,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:tool,arguments:args}}),signal:AbortSignal.timeout(tool==='audio-wait'?60000:35000)});
  const payload=await rpcResponse(res);if(payload.error)throw new ApiError(payload.error.message||'Suno could not complete this request.',502);
  const result=payload.result;
  let data=result?.structuredContent;
  if(!data){const blocks=result?.content?.filter((c:{type:string})=>c.type==='text')||[],parsed=[];for(const c of blocks){try{parsed.push(JSON.parse(c.text));}catch{}}data=parsed.length===1?parsed[0]:parsed.length?{clips:parsed}:undefined;}
  if(result?.isError||data?.error&&!data?.id&&!data?.clips){const message=typeof data?.error==='string'?data.error:data?.error?.message||result?.content?.find((c:{type:string})=>c.type==='text')?.text||'Suno could not complete this request.';const candidate=Number(data?.status||data?.status_code);const status=candidate>=400&&candidate<600?candidate:data?.code==='insufficient_credits'?402:502;throw new ApiError(message,status,data?.code||'suno_request_failed');}
  return data||result;
}
export function publicHttps(value:string){
  let url:URL;try{url=new URL(value);}catch{throw new ApiError('Enter a valid HTTPS service address.');}
  const host=url.hostname.toLowerCase();if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||/^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/.test(host)||host.endsWith('.local')||!host.includes('.'))throw new ApiError('Use a public HTTPS music service address.');return url;
}
export function normalizeClip(raw:any){
  let d=raw;for(let i=0;i<6;i++){const next=d?.structuredContent||d?.data||d?.clip||(!d?.id&&d?.result)||(!d?.id&&typeof d?.audio==='object'&&d.audio);if(!next||next===d)break;d=next;}
  const items=Array.isArray(d)?d:Array.isArray(d?.clips)?d.clips:[d];
  const clean=(c:any)=>({id:c?.id||c?.clip_id||'',status:c?.status||(c?.error?'error':'queued'),title:c?.title||c?.metadata?.title||d?.title||'Ocean Echo',audio_url:c?.audio_url||c?.audio?.url||c?.stream_url||null,song_url:c?.song_url||c?.share_url||null,image_url:c?.image_url||null,duration:c?.duration||c?.metadata?.duration||null,error:typeof c?.error==='string'?c.error:c?.error_message||c?.error?.message||null,clip_ids:Array.isArray(c?.clip_ids)?c.clip_ids:[]});
  let clips=items.filter(Boolean).map(clean);const ids=Array.from(new Set<string>([...(Array.isArray(d?.clip_ids)?d.clip_ids:[]),...(Array.isArray(raw?.clip_ids)?raw.clip_ids:[]),...clips.flatMap((c:any)=>c.clip_ids)]));
  if(ids.length&&(!d?.clips&&!Array.isArray(d)))clips=ids.map(id=>({...clean(d),id}));
  const clip_ids=ids.length?ids:clips.map((c:any)=>c.id).filter(Boolean),first=clips.find((c:any)=>['complete','streaming'].includes(c.status)&&(c.audio_url||c.song_url))||clips[0]||clean({});
  return {...first,id:first.id||clip_ids[0],clip_ids,clips};
}
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const assertSameOrigin=(req:Request)=>{const source=req.headers.get('origin');if(source&&source!==new URL(req.url).origin&&source!==config('PUBLIC_ORIGIN'))throw new ApiError('Invalid request origin.',403);};
export async function api(req:Request):Promise<Response>{
  const path=new URL(req.url).pathname.replace(/^\/api\//,'');let updatedSession:Session|null=null;
  try{
    if(req.method==='POST')assertSameOrigin(req);
    if(path==='health')return json({ok:true,version:'2.0.0'});
    if(path==='auth/suno'&&req.method==='GET'){
      if(!config('SUNO_CLIENT_ID'))throw new ApiError('Suno account connection is being configured.',503,'service_not_configured');
      const verifier=b64(crypto.getRandomValues(new Uint8Array(32))),state=b64(crypto.getRandomValues(new Uint8Array(24))),challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
      const redirect=`${origin(req)}/api/auth/callback`,u=new URL(`${OAUTH}/authorize/`);
      u.search=new URLSearchParams({client_id:config('SUNO_CLIENT_ID'),redirect_uri:redirect,state,response_type:'code',code_challenge:challenge,code_challenge_method:'S256',resource:API,scope:'api:v0 credits:spend library:read offline_access profile:read'}).toString();
      return new Response(null,{status:302,headers:{Location:u.href,'Set-Cookie':cookie('ocean_oauth',await seal({verifier,state,redirect,expires:Date.now()+600000}),600),'Cache-Control':'no-store'}});
    }
    if(path==='auth/callback'){
      const u=new URL(req.url),stored=await unseal<{verifier:string;state:string;redirect:string;expires:number}>(cookieValue(req,'ocean_oauth'));
      if(u.searchParams.get('error'))return new Response(null,{status:302,headers:{Location:`${origin(req)}/?connection=cancelled`,'Set-Cookie':cookie('ocean_oauth','',0)}});
      if(!stored||stored.expires<Date.now()||stored.state!==u.searchParams.get('state')||!u.searchParams.get('code'))throw new ApiError('The connection link expired. Please try again in Settings.',400,'oauth_state_mismatch');
      const s=await oauthToken({grant_type:'authorization_code',code:u.searchParams.get('code')!,redirect_uri:stored.redirect,code_verifier:stored.verifier,client_id:config('SUNO_CLIENT_ID'),resource:API});
      const headers=new Headers({Location:`${origin(req)}/?connection=success`,'Cache-Control':'no-store'});headers.append('Set-Cookie',cookie(COOKIE,await seal({access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at})));headers.append('Set-Cookie',cookie('ocean_oauth','',0));return new Response(null,{status:302,headers});
    }
    if(path==='providers'){
      const s=await unseal<Session>(cookieValue(req,COOKIE)),custom=await unseal<Custom>(cookieValue(req,'ocean_custom'));
      return json({suno:{connected:!!s,ready:!!config('SUNO_CLIENT_ID')},custom:{connected:!!custom,url:custom?.url||'',statusUrl:custom?.statusUrl||'',model:custom?.model||''}});
    }
    if(path==='providers/disconnect'&&req.method==='POST')return new Response('{}',{headers:{'Content-Type':'application/json','Set-Cookie':cookie(COOKIE,'',0)}});
    if(path==='providers/custom'&&req.method==='POST'){
      const b=await req.json() as Record<string,any>,url=publicHttps(b.url).href,statusUrl=b.statusUrl?publicHttps(b.statusUrl.replace('{id}','sample')).href.replace('sample','{id}'):'';
      if(statusUrl&&new URL(statusUrl.replace('{id}','sample')).origin!==new URL(url).origin)throw new ApiError('Generation and status endpoints must use the same provider.');
      const previous=await unseal<Custom>(cookieValue(req,'ocean_custom'));const key=String(b.key||previous?.key||'');
      if(key.length>2048)throw new ApiError('API key is too long.');
      return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Set-Cookie':cookie('ocean_custom',await seal({url,statusUrl,key,model:String(b.model||'').slice(0,120)})),'Cache-Control':'no-store'}});
    }
    const savedRead=await jobRead(req,path);if(savedRead)return savedRead;
    const provider=new URL(req.url).searchParams.get('provider')||'suno';
    let custom:Custom|null=null;let token='';
    if(provider==='custom'){custom=await unseal<Custom>(cookieValue(req,'ocean_custom'));if(!custom)throw new ApiError('Connect another music service in Settings.',401,'custom_not_connected');}
    else {const s=await session(req);token=s.value.access_token;if(s.updated)updatedSession=s.value;}
    let result:unknown;
    const written=await jobWrite(req,path,{token,custom,call:sunoCall,normalize:normalizeClip,publicHttps});if(written){if(updatedSession)written.headers.append('Set-Cookie',cookie(COOKIE,await seal(updatedSession)));return written;}
    if(path==='account')result=await sunoCall(token,'account-usage');
    else if(path==='upload'&&req.method==='POST'){
      if(Number(req.headers.get('content-length')||0)>13000000)throw new ApiError('Melody file is too large.',413);
      const form=await req.formData(),file=form.get('audio');
      let seed:any;try{seed=JSON.parse(String(form.get('midi')||'{}'));}catch{throw new ApiError('Invalid melody notes.');}if(!validateNotes(seed.notes))throw new ApiError('Record at least 3 valid notes.');if(!(file instanceof File)||file.size<44||file.size>12000000)throw new ApiError('Use a melody between 3 notes and 60 seconds.');
      const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,4))!=='RIFF'||new TextDecoder().decode(bytes.slice(8,12))!=='WAVE')throw new ApiError('The melody could not be rendered. Please try again.');
      if(custom){
        const fd=new FormData();fd.set('audio',new Blob([bytes],{type:'audio/wav'}),'melody.wav');fd.set('midi',String(form.get('midi')||''));fd.set('prompt',String(form.get('prompt')||''));fd.set('model',custom.model);fd.set('instrumental',String(form.get('instrumental')||'true'));fd.set('duration','90');
        const res=await fetch(custom.url,{method:'POST',headers:custom.key?{Authorization:`Bearer ${custom.key}`}:{},body:fd,signal:AbortSignal.timeout(45000)});const raw=await readJson(res);if(!res.ok)throw new ApiError(raw.error?.message||raw.error||`Music service HTTP ${res.status}`,res.status);result={...normalizeClip(raw),phase:'generation'};
      }else{
        const upload=await sunoCall(token,'audio-upload-create',{title:'Music Ocean — Original Melody'}),target=publicHttps(upload.upload_url);
        const trusted=['.amazonaws.com','.cloudflarestorage.com','.suno.com','.suno.ai','.googleapis.com'];if(!trusted.some(s=>target.hostname.endsWith(s)))throw new ApiError('Suno returned an unrecognized upload host.',502,'upload_host_unsupported');
        const sent=await fetch(target.href,{method:'PUT',headers:{'Content-Type':'audio/wav'},body:bytes,signal:AbortSignal.timeout(25000)});if(!sent.ok)throw new ApiError('The melody upload failed. Your notes are saved; please retry.',502,'upload_failed');
        const complete=await sunoCall(token,'audio-upload-complete',{id:upload.id});result={...normalizeClip(complete),phase:'upload'};
      }
    }else if(path==='generate'&&req.method==='POST'){
      const b=await req.json() as Record<string,any>;if(typeof b.sourceId!=='string'||b.sourceId.length>150||typeof b.idempotencyKey!=='string')throw new ApiError('The melody is missing. Please retry.');
      const prompt=String(b.prompt||'').slice(0,2000);result=normalizeClip(await sunoCall(token,'audio-create',{description:`Create a complete ${b.instrumental?'instrumental piece without vocals':'song with warm Mandarin vocals'} from Original Melody. Keep its main melody recognizable and develop it naturally. ${prompt}`,reference_audio_ids:[b.sourceId],instrumental:!!b.instrumental,duration:90,duration_strict:false,title:String(b.title||'Ocean Echo').slice(0,256),idempotency_key:b.idempotencyKey}));
    }else if(path==='work'){
      const id=new URL(req.url).searchParams.get('id');if(!id||id.length>150)throw new ApiError('Missing work ID.');
      if(custom){if(!custom.statusUrl)throw new ApiError('This service needs a status endpoint in Settings.',400,'status_endpoint_missing');const url=custom.statusUrl.replace('{id}',encodeURIComponent(id));const res=await fetch(url,{headers:custom.key?{Authorization:`Bearer ${custom.key}`}:{},signal:AbortSignal.timeout(20000)});const raw=await readJson(res);if(!res.ok)throw new ApiError('Unable to check this work yet.',res.status);result=normalizeClip(raw);}
      else result=normalizeClip(await sunoCall(token,new URL(req.url).searchParams.get('wait')==='1'?'audio-wait':'audio-retrieve',{id}));
    }else throw new ApiError('Unknown route.',404);
    const response=json(result);if(updatedSession)response.headers.append('Set-Cookie',cookie(COOKIE,await seal(updatedSession)));return response;
  }catch(error){const e=error as ApiError;const response=json({error:e.message||'The music service is temporarily unavailable.',code:e.code||'provider_unavailable'},e.status>=400&&e.status<600?e.status:502);if(e.status===401&&e.code!=='site_signin_required'&&new URL(req.url).searchParams.get('provider')!=='custom')response.headers.append('Set-Cookie',cookie(COOKIE,'',0));else if(updatedSession)response.headers.append('Set-Cookie',cookie(COOKIE,await seal(updatedSession)));return response;}
}
