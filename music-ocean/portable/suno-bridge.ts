import {createHash,createPrivateKey,createPublicKey,sign,verify,randomUUID} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {publicFetch} from './public-fetch.js';

const MCP='https://api.suno.com/mcp';
const TOKEN='https://studio-api-prod.suno.com/api/v2/external/oauth/token/';
const UPLOAD_HOSTS=['.amazonaws.com','.cloudflarestorage.com','.suno.com','.suno.ai','.googleapis.com'];
const LIMIT=4_200_000;
type Claim={v:1;iat:number;exp:number;nonce:string;url:string;method:string;headers:Record<string,string>;hash:string};
const digest=(b:Uint8Array)=>createHash('sha256').update(b).digest('base64url');
function trusted(url:string,method:string){
 const u=new URL(url);
 return method==='POST'&&(url===MCP||url===TOKEN)||method==='PUT'&&u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&UPLOAD_HOSTS.some(s=>u.hostname.endsWith(s));
}

// Only the Aliyun server has the signing key. Vercel receives its public verification key.
export const bridgeFetch:typeof fetch=async(input,init)=>{
 const endpoint=process.env.OCEAN_SUNO_BRIDGE_URL,key=process.env.OCEAN_SUNO_BRIDGE_PRIVATE_KEY;
 if(!endpoint&&!key)return fetch(input,init);
 if(!endpoint||!key||!['https://suno.partykeys.ai/api/suno-bridge','https://suno-music-ocean.vercel.app/api/suno-bridge'].includes(endpoint))throw new Error('Suno connection routing is not configured.');
 const request=new Request(input,init),method=request.method,url=request.url;
 if(!trusted(url,method))throw new Error('Unsupported Suno service destination.');
 const body=new Uint8Array(await request.arrayBuffer());
 if(body.length>LIMIT)throw Object.assign(new Error('This melody is too large for the overseas connection. Record a shorter melody.'),{status:413});
 const headers:Record<string,string>={};
 for(const name of ['content-type','accept','authorization','mcp-session-id','mcp-protocol-version','user-agent']){const value=request.headers.get(name);if(value)headers[name]=value;}
 const now=Math.floor(Date.now()/1000),claim:Claim={v:1,iat:now,exp:now+60,nonce:randomUUID(),url,method,headers,hash:digest(body)};
 const payload=Buffer.from(JSON.stringify(claim)).toString('base64url');
 const privateKey=createPrivateKey({key:Buffer.from(key,'base64'),format:'der',type:'pkcs8'});
 const signature=sign(null,Buffer.from(payload),privateKey).toString('base64url');
 return fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/octet-stream','Authorization':`OceanBridge ${payload}.${signature}`},body,signal:request.signal,redirect:'error'});
};

export function createBridgeHandler(options:{publicKey?:()=>string|undefined;fetch?:typeof fetch;uploadFetch?:typeof fetch;now?:()=>number}={}){
 return async(req:IncomingMessage,res:ServerResponse)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{
   if(req.method!=='POST'){res.writeHead(405);res.end();return;}
   const key=(options.publicKey||(()=>process.env.OCEAN_BRIDGE_PUBLIC_KEY))();
   if(!key){res.writeHead(503);res.end('Suno connection is being configured.');return;}
   const authorization=req.headers.authorization||'',match=authorization.match(/^OceanBridge ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
   if(!match||authorization.length>16_000){res.writeHead(401);res.end('Unauthorized');return;}
   const publicKey=createPublicKey({key:Buffer.from(key,'base64'),format:'der',type:'spki'});
   if(!verify(null,Buffer.from(match[1]),publicKey,Buffer.from(match[2],'base64url'))){res.writeHead(401);res.end('Unauthorized');return;}
   const c=JSON.parse(Buffer.from(match[1],'base64url').toString()) as Claim,now=Math.floor((options.now||Date.now)()/1000);
   if(c.v!==1||!Number.isInteger(c.iat)||!Number.isInteger(c.exp)||c.iat>now+5||c.exp<now||c.exp-c.iat>60||!trusted(c.url,c.method)){res.writeHead(403);res.end('Invalid connection request');return;}
   const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>LIMIT){res.writeHead(413);res.end('Melody is too large');return;}chunks.push(chunk);}
   const body=Buffer.concat(chunks);if(digest(body)!==c.hash){res.writeHead(403);res.end('Invalid connection request');return;}
   const headers=new Headers();for(const [name,value] of Object.entries(c.headers||{}))if(['content-type','accept','authorization','mcp-session-id','mcp-protocol-version','user-agent'].includes(name)&&typeof value==='string')headers.set(name,value);
   const call=c.method==='PUT'?(options.uploadFetch||publicFetch):(options.fetch||fetch);
   const upstream=await call(c.url,{method:c.method,headers,body,redirect:'error',signal:AbortSignal.timeout(50000)});
   for(const name of ['content-type','mcp-session-id','retry-after','www-authenticate']){const value=upstream.headers.get(name);if(value)res.setHeader(name,value);}
   res.statusCode=upstream.status;res.end(Buffer.from(await upstream.arrayBuffer()));
  }catch{if(!res.headersSent)res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'The Suno connection is temporarily unavailable.'}));}
 };
}
