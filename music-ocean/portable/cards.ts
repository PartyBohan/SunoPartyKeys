import {randomBytes} from 'node:crypto';
import {readJob,requestOwner} from '../lib/jobs';
import {ApiError,sunoCall,sunoSession,setSessionCookie} from '../lib/suno-server';
import {storage} from './cloudflare-node';
import {bridgeFetch,isSunoDownloadUrl} from './suno-bridge';

type Card={token:string;owner:string;jobId:string;clipId:string;title:string;scene:number;notes:{note:number;start:number;duration:number}[];duration:number;status:string;audioKey?:string;coverKey?:string;creditsRemaining?:number;lockUntil?:number;lease?:string;error?:string;revoked?:boolean;updatedAt:number};
const ORIGIN='https://suno.popumusic.cn';
const scenes=['tidal-prelude','moon-current','amber-reef'];
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const valid=(s:string)=>/^[A-Za-z0-9_-]{32}$/.test(s);
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function view(c:Card,privateView=true){return {token:c.token,title:c.title,scene:c.scene,notes:c.notes,duration:c.duration,status:c.status,...(privateView?{creditsRemaining:c.creditsRemaining,error:c.error}:{}),url:`${ORIGIN}/s/${c.token}`,audioUrl:c.status==='ready'?`/api/cards/${c.token}/audio`:undefined,downloadUrl:c.status==='ready'?`/api/cards/${c.token}/download`:undefined,coverUrl:c.coverKey&&c.status==='ready'?`/api/cards/${c.token}/cover`:`/images/${scenes[c.scene]}.webp`};}
function attachmentName(title:string){const name=(title.toWellFormed().replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g,' ').replace(/\s+/g,' ').trim().replace(/\.mp3$/i,'')||'music-ocean')+'.mp3';return `attachment; filename="music-ocean.mp3"; filename*=UTF-8''${encodeURIComponent(name).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}`;}
async function get(token:string){if(!valid(token))throw new ApiError('音乐卡不存在或已停止分享。',404);const row=await storage.DB.prepare('SELECT document FROM ocean_cards WHERE token=?').bind(token).first();if(!row)throw new ApiError('音乐卡不存在或已停止分享。',404);return JSON.parse(String(row.document)) as Card;}
async function ownerCard(req:Request,token:string){const c=await get(token);if(c.owner!==requestOwner(req)||c.revoked)throw new ApiError('音乐卡不存在或已停止分享。',404);return c;}
async function publicCard(token:string){const c=await get(token);if(c.revoked||c.status!=='ready')throw new ApiError('音乐卡不存在或尚未准备好。',404);return c;}
async function save(c:Card,claimed=false){c.updatedAt=Math.max(Date.now(),c.updatedAt+1);const sql=claimed?"UPDATE ocean_cards SET document=?,updated_at=? WHERE token=? AND json_extract(document,'$.lease')=?":"UPDATE ocean_cards SET document=?,updated_at=? WHERE token=?";const q=storage.DB.prepare(sql),args=[JSON.stringify(c),c.updatedAt,c.token];if(claimed)args.push(c.lease!);const r=await q.bind(...args).run();if(!r.meta.changes)throw new ApiError('音乐卡状态已更新，请重试。',409);}
async function claim(c:Card){if((c.lockUntil||0)>Date.now())return false;const before=c.updatedAt;c.lockUntil=Date.now()+180000;c.lease=randomBytes(16).toString('hex');c.updatedAt=Math.max(Date.now(),before+1);const r=await storage.DB.prepare('UPDATE ocean_cards SET document=?,updated_at=? WHERE token=? AND updated_at=?').bind(JSON.stringify(c),c.updatedAt,c.token,before).run();return !!r.meta.changes;}
function mp3(bytes:Uint8Array){return bytes.length>=128&&bytes.length<=4_200_000&&(Buffer.from(bytes.subarray(0,3)).toString()==='ID3'||bytes[0]===255&&(bytes[1]&224)===224);}
async function audioFile(url:string){for(let i=0;i<4;i++){if(!isSunoDownloadUrl(url))throw new ApiError('下载地址暂不受支持，请上传从 Suno 下载的 MP3。',502);const r=await bridgeFetch(url,{method:'GET',signal:AbortSignal.timeout(60000)});if([301,302,303,307,308].includes(r.status)){const next=r.headers.get('location');if(!next)break;url=new URL(next,url).href;continue;}if(!r.ok)throw new ApiError('歌曲文件暂未下载完成，请稍后继续。',502);if(Number(r.headers.get('content-length'))>4_200_000)throw new ApiError('MP3 超过本次分享的 4.2 MB 上限。',413);const bytes=new Uint8Array(await r.arrayBuffer());if(!mp3(bytes))throw new ApiError('服务未返回有效的 MP3，请稍后重试。',502);return bytes;}throw new ApiError('歌曲下载地址重定向过多。',502);}
async function prepare(req:Request,c:Card,confirmed:boolean){
 if(c.status==='ready')return json(view(c));
 if(confirmed&&c.status!=='requires_credit')throw new ApiError('请先查询本次导出是否需要下载额度。',409);
 const connection=await sunoSession(req);let response:Response;
 if(!connection.value.download){const response=json({...view(c),status:'connection_required'});if(connection.updated)await setSessionCookie(response,connection.value);return response;}
 if(!await claim(c))return json({...view(c),status:'preparing'});
 try{
  const result=await sunoCall(connection.value.access_token,'audio-download',{id:c.clipId,format:'mp3',...(confirmed?{confirm:true}:{})});
  c.error=undefined;
  if(result.status==='requires_credit'){c.status='requires_credit';c.creditsRemaining=typeof result.credits_remaining==='number'?result.credits_remaining:undefined;}
  else if(result.status==='processing')c.status='processing';
  else if(typeof result.url==='string'){const bytes=await audioFile(result.url);c.audioKey=`card-audio/${c.token}.mp3`;await storage.BUCKET.put(c.audioKey,bytes);c.status='ready';}
  else throw new ApiError('Suno 尚未返回可用的 MP3 文件。',502);
 }catch(e){c.status='error';c.error=e instanceof ApiError?e.message:'歌曲导出暂未完成，请稍后继续，或上传已下载的 MP3。';}
 finally{c.lockUntil=0;await save(c,true);}
 response=json(view(c));if(connection.updated)await setSessionCookie(response,connection.value);return response;
}
export async function cardApi(req:Request):Promise<Response|null>{
 const u=new URL(req.url),parts=u.pathname.split('/').filter(Boolean);if(parts[0]!=='api'||parts[1]!=='cards')return null;
 try{
  if(req.method==='POST'){const origin=req.headers.get('origin');if(origin&&!['https://suno.popumusic.cn','https://suno.partykeys.ai',u.origin].includes(origin))throw new ApiError('Invalid request origin.',403);}
  if(parts.length===2&&req.method==='POST'){
   const b=await req.json() as Record<string,unknown>,job=await readJob(req,String(b.jobId||'')),clip=job.clips.find(x=>x.id===b.clipId&&x.status==='complete');if(!clip||job.provider!=='suno')throw new ApiError('请先选择已完成的 Suno 作品。');
   const rows=await storage.DB.prepare('SELECT document FROM ocean_cards WHERE owner=? AND job_id=? AND clip_id=? ORDER BY updated_at DESC LIMIT 1').bind(requestOwner(req),job.id,clip.id).all();const previous=rows.results[0]&&JSON.parse(String(rows.results[0].document)) as Card|undefined;
   if(previous&&!previous.revoked){if((previous.lockUntil||0)>Date.now())return json({...view(previous),status:'preparing'});if(b.title){previous.title=String(b.title).trim().slice(0,46)||job.title;await save(previous);}return json(view(previous));}
   const c:Card={token:randomBytes(24).toString('base64url'),owner:requestOwner(req),jobId:job.id,clipId:clip.id,title:String(b.title||job.title).trim().slice(0,46)||job.title,scene:job.scene,notes:job.notes.map(({note,start,duration})=>({note,start,duration})),duration:clip.duration||0,status:'draft',updatedAt:Date.now()};
   if(typeof b.cover==='string'&&b.cover.startsWith('data:image/png;base64,')){const bytes=Buffer.from(b.cover.slice(22),'base64');if(bytes.length>1_000_000||bytes.length<32||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)>1200||bytes.readUInt32BE(20)>1200)throw new ApiError('封面图片无效。');c.coverKey=`card-audio/${c.token}-cover.png`;await storage.BUCKET.put(c.coverKey,bytes);}
   const inserted=await storage.DB.prepare('INSERT OR IGNORE INTO ocean_cards(token,owner,job_id,clip_id,document,updated_at) VALUES(?,?,?,?,?,?)').bind(c.token,c.owner,c.jobId,c.clipId,JSON.stringify(c),c.updatedAt).run();if(!inserted.meta.changes){const rows=await storage.DB.prepare("SELECT document FROM ocean_cards WHERE owner=? AND job_id=? AND clip_id=? AND json_extract(document,'$.revoked') IS NOT 1 LIMIT 1").bind(c.owner,c.jobId,c.clipId).all();if(!rows.results[0])throw new ApiError('音乐卡状态已改变，请重试。',409);return json(view(JSON.parse(String(rows.results[0].document))));}return json(view(c),201);
  }
  const token=parts[2];if(!token||!valid(token))throw new ApiError('音乐卡不存在。',404);
  if(req.method==='POST'){
   const c=await ownerCard(req,token);
   if(parts[3]==='revoke'){if((c.lockUntil||0)>Date.now())throw new ApiError('歌曲仍在准备，请稍后停止分享。',409);c.revoked=true;await save(c);return json({ok:true});}
   if(parts[3]==='prepare'){const b=await req.json() as Record<string,unknown>;return await prepare(req,c,b.confirm===true);}
   if(parts[3]==='upload'){
    if(c.status==='ready')return json(view(c));if(!await claim(c))return json({...view(c),status:'preparing'});
    try{const form=await req.formData(),f=form.get('audio');if(!(f instanceof File)||f.size>4_200_000)throw new ApiError('请上传 4.2 MB 以内的 MP3。');const bytes=new Uint8Array(await f.arrayBuffer());if(!mp3(bytes))throw new ApiError('请上传有效的 MP3。');c.audioKey=`card-audio/${c.token}.mp3`;await storage.BUCKET.put(c.audioKey,bytes);c.status='ready';c.error=undefined;}finally{c.lockUntil=0;await save(c,true);}return json(view(c));
   }
  }
  if(req.method==='GET'||req.method==='HEAD'){
   const c=await publicCard(token);if(parts.length===3)return json(view(c,false));
   if(parts.length!==4)throw new ApiError('文件不存在。',404);
   const download=parts[3]==='download',audio=parts[3]==='audio'||download,key=audio?c.audioKey:parts[3]==='cover'?c.coverKey:undefined;if(!key)throw new ApiError('文件不存在。',404);
   const object=await storage.BUCKET.get(key,audio&&req.headers.has('range')?{range:req.headers}:undefined);if(!object)throw new ApiError('文件暂不可用。',404);const range=object.range,offset=range?.offset||0,length=range?.length||object.size;
   const headers=new Headers({'Content-Type':audio?'audio/mpeg':'image/png','Content-Length':String(length),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Accept-Ranges':'bytes'});if(download)headers.set('Content-Disposition',attachmentName(c.title));if(range)headers.set('Content-Range',`bytes ${offset}-${offset+length-1}/${object.size}`);return new Response(req.method==='HEAD'?null:object.body,{status:range?206:200,headers});
  }
  throw new ApiError('Unknown route.',404);
 }catch(e){const error=e as ApiError;return json({error:error.message||'音乐卡暂不可用。',code:error.code},error.status||502);}
}
export async function cardPage(req:Request,template:string){const token=new URL(req.url).pathname.match(/^\/s\/([A-Za-z0-9_-]{32})\/?$/)?.[1];if(!token)return new Response('音乐卡不存在。',{status:404});try{const c=await publicCard(token),v=view(c,false),title=escape(c.title+' · 音乐密码'),description=escape(`我弹了 ${c.notes.length} 个音，做了这首歌。点开音乐卡就能听。`),cover=ORIGIN+v.coverUrl;
 const meta=`<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><link rel="canonical" href="${v.url}"><meta property="og:type" content="music.song"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${v.url}"><meta property="og:image" content="${cover}"><meta property="og:audio" content="${ORIGIN+v.audioUrl}"><meta property="og:audio:type" content="audio/mpeg"><meta name="description" content="${description}"><script id="ocean-share-data" type="application/json">${JSON.stringify(v).replace(/</g,'\\u003c')}</script>`;
 const html=template.replace(/<meta\s+name=["']description["'][^>]*>/gi,'').replace(/<title>[\s\S]*?<\/title>/,`<title>${title}</title>`).replace('</head>',meta+'</head>');return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>音乐卡已停止分享</title><p>这张音乐卡不存在或已停止分享。</p>',{status:404,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});}}
