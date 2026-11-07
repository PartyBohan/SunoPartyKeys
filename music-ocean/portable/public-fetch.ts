import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import https from 'node:https';
import {gunzipSync,inflateSync,brotliDecompressSync} from 'node:zlib';

export function publicAddress(address:string){
 if(isIP(address)===4){const [a,b,c]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);}
 if(isIP(address)===6)return /^[23]/i.test(address)&&!/^2001:db8:/i.test(address);
 return false;
}
const denied=()=>Object.assign(new Error('Music APIs must use public Internet addresses.'),{status:403,code:'private_provider_address'});
export async function publicFetch(input:Parameters<typeof fetch>[0],init:RequestInit={}){
 const url=new URL(input instanceof Request?input.url:input);if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')throw denied();
 const literal=url.hostname.replace(/^\[|\]$/g,'');if(isIP(literal)&&!publicAddress(literal))throw denied();
 const encoded=new Request(input,{...init,redirect:'manual'}),body=encoded.body?Buffer.from(await encoded.arrayBuffer()):undefined;
 const headers=Object.fromEntries(encoded.headers);headers['accept-encoding']='identity';if(body)headers['content-length']=String(body.length);
 return new Promise<Response>((resolve,reject)=>{
  const req=https.request(url,{method:encoded.method,headers,signal:encoded.signal,
   lookup(host,options,callback){lookup(host,{all:true,verbatim:true}).then(addresses=>{if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw denied();if((options as any).all)(callback as any)(null,addresses);else (callback as any)(null,addresses[0].address,addresses[0].family);}).catch(error=>callback(error,''));},
  },res=>{const chunks:Buffer[]=[];let length=0;res.on('data',(chunk:Buffer)=>{length+=chunk.length;if(length>20_000_000){req.destroy(new Error('Music API response is too large.'));return;}chunks.push(chunk);});res.on('end',()=>{try{let result=Buffer.concat(chunks);const encoding=res.headers['content-encoding'];const options={maxOutputLength:20_000_000};if(encoding==='gzip')result=gunzipSync(result,options);else if(encoding==='deflate')result=inflateSync(result,options);else if(encoding==='br')result=brotliDecompressSync(result,options);const responseHeaders=new Headers();for(const [key,value] of Object.entries(res.headers))if(value!==undefined&&!['content-encoding','content-length','transfer-encoding'].includes(key))responseHeaders.set(key,Array.isArray(value)?value.join(','):value);resolve(new Response([204,304].includes(res.statusCode||0)?null:new Uint8Array(result),{status:res.statusCode||502,headers:responseHeaders}));}catch(error){reject(error);}});res.on('error',reject);});req.on('error',reject);req.end(body);
 });
}
