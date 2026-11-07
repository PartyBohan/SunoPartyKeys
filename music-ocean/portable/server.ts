import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {api,seal,unseal,sunoOwner,setProviderFetch} from '../lib/suno-server';
import {storage} from './cloudflare-node';
import {publicFetch} from './public-fetch';

setProviderFetch(publicFetch);

const assets=resolve(fileURLToPath(new URL('../dist-web/',import.meta.url)));
const approved=(process.env.OCEAN_ALLOWED_ORIGINS||'https://suno.popumusic.cn,https://suno.partykeys.ai').split(',').map(x=>x.trim()).filter(Boolean);
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.mp4':'video/mp4','.ico':'image/x-icon','.woff2':'font/woff2'};
const cookieValue=(value:string|undefined,name:string)=>value?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
export const server=http.createServer(async(incoming,outgoing)=>{
 try{
  const host=incoming.headers.host||'',hostOrigin=`https://${host}`;
  if(process.env.NODE_ENV==='production'&&!approved.includes(hostOrigin)){outgoing.writeHead(400);outgoing.end('Unknown application hostname');return;}
  const url=new URL(incoming.url||'/',hostOrigin);
  if(url.pathname.startsWith('/api/')){
   if(!['GET','HEAD','POST'].includes(incoming.method||'')){outgoing.writeHead(405);outgoing.end();return;}
   const chunks:Buffer[]=[];let length=0;
   for await(const data of incoming){length+=data.length;if(length>13_000_000){outgoing.writeHead(413);outgoing.end('Melody file is too large');return;}chunks.push(data);}
   const headers=new Headers();for(const [key,value] of Object.entries(incoming.headers))if(value!==undefined&&!key.startsWith('oai-authenticated-'))headers.set(key,Array.isArray(value)?value.join(','):value);
   const body=chunks.length?new Uint8Array(Buffer.concat(chunks)):undefined;
   let request=new Request(url,{method:incoming.method,headers,body:['GET','HEAD'].includes(incoming.method||'')?undefined:body});
   let newIdentity:string|undefined,deviceOwner:string|undefined;
   if(url.pathname!=='/api/health'){
    let identity=await unseal<{id:string}>(cookieValue(incoming.headers.cookie,'ocean_identity'));
    if(!identity?.id||!/^device:[a-f0-9-]{36}$/.test(identity.id)){identity={id:'device:'+crypto.randomUUID()};newIdentity=await seal(identity);}
    deviceOwner=identity.id;
    headers.set('oai-authenticated-user-id',await sunoOwner(request)||identity.id);
    request=new Request(url,{method:incoming.method,headers,body:['GET','HEAD'].includes(incoming.method||'')?undefined:body});
   }
   const response=await api(request);
   if(deviceOwner&&url.pathname==='/api/auth/callback'&&response.status===302){
    const value=response.headers.getSetCookie().find(s=>s.startsWith('ocean_suno='))?.split(';')[0].slice('ocean_suno='.length);
    const account=await unseal<{user_id?:string}>(value);
    if(account?.user_id)await storage.DB.prepare('UPDATE ocean_creations SET owner=? WHERE owner=?').bind('suno:'+account.user_id,deviceOwner).run();
   }
   outgoing.statusCode=response.status;
   for(const [key,value] of response.headers)if(key!=='set-cookie')outgoing.setHeader(key,value);
   const cookies=response.headers.getSetCookie();if(newIdentity)cookies.push(`ocean_identity=${newIdentity}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`);if(cookies.length)outgoing.setHeader('Set-Cookie',cookies);
   if(incoming.method==='HEAD'){outgoing.end();return;}outgoing.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(!['GET','HEAD'].includes(incoming.method||'')){outgoing.writeHead(405);outgoing.end();return;}
  const path=resolve(assets,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!path.startsWith(assets+sep)){outgoing.writeHead(404);outgoing.end();return;}
  let fileStat;try{fileStat=await stat(path);}catch{outgoing.writeHead(404);outgoing.end();return;}if(!fileStat.isFile()){outgoing.writeHead(404);outgoing.end();return;}
  const data=await readFile(path),headers:Record<string,string>={'Content-Type':mime[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache','Accept-Ranges':'bytes'};
  let start=0,end=data.length-1;const range=incoming.headers.range;
  if(range){const m=range.match(/^bytes=(\d+)-(\d*)$/);if(!m||Number(m[1])>=data.length){outgoing.writeHead(416,{'Content-Range':`bytes */${data.length}`});outgoing.end();return;}start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),end):end;if(end<start){outgoing.writeHead(416);outgoing.end();return;}headers['Content-Range']=`bytes ${start}-${end}/${data.length}`;}
  headers['Content-Length']=String(end-start+1);outgoing.writeHead(range?206:200,headers);outgoing.end(incoming.method==='HEAD'?undefined:data.subarray(start,end+1));
 }catch(error){const status=Number((error as any).status)||500;outgoing.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});outgoing.end(JSON.stringify({error:status===500?'The music service is temporarily unavailable.':(error as Error).message}));}
});
if(process.env.OCEAN_NO_LISTEN!=='1')server.listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log(`Music Ocean server listening on ${process.env.HOST||'127.0.0.1'}:${process.env.PORT||8787}`));
