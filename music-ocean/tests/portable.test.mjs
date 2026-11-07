import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';

const directory=await mkdtemp(join(tmpdir(),'music-ocean-portable-'));
Object.assign(process.env,{OCEAN_DATA_DIR:directory,OCEAN_NO_LISTEN:'1',OCEAN_AUTH_MODE:'suno',OCEAN_COOKIE_SECRET:'portable-test-secret-only-000000000000000000000',PUBLIC_ORIGIN:'https://suno.popumusic.cn',OCEAN_ALLOWED_ORIGINS:'https://suno.popumusic.cn,https://suno.partykeys.ai',SUNO_CLIENT_ID:'test-cn-client',SUNO_PARTYKEYS_CLIENT_ID:'test-en-client'});
const {server,seal,storage,publicAddress,publicFetch}=await import('../dist-node/test-entry.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();
const realFetch=globalThis.fetch;
let providerCalls=0;
globalThis.fetch=async(input,init)=>{
 const url=String(input);
 if(url.includes('studio-api-prod.suno.com')&&url.endsWith('/token/'))return Response.json({access_token:'isolated-test-token',refresh_token:'isolated-test-refresh',expires_in:900});
 if(url==='https://api.suno.com/mcp'){
  providerCalls++;const data=JSON.parse(init.body);
  if(data.method==='initialize')return Response.json({jsonrpc:'2.0',id:data.id,result:{protocolVersion:'2024-11-05'}});
  if(data.method==='notifications/initialized')return new Response(null,{status:202});
  assert.equal(data.params.name,'account-me','test must never call a paid creation tool');
  return Response.json({jsonrpc:'2.0',id:data.id,result:{structuredContent:{data:[{profile:{user_id:'isolated-suno-account-a'}}]}}});
 }
 return realFetch(input,init);
};
function request(path,{method='GET',headers={},body}={}){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:address.port,path,method,headers},res=>{const chunks=[];res.on('data',v=>chunks.push(v));res.on('end',()=>{const buffer=Buffer.concat(chunks);resolve({status:res.statusCode,headers:res.headers,body:buffer,json:()=>JSON.parse(buffer.toString())});});});req.on('error',reject);req.end(body);});}
function cookie(headers,name){return headers['set-cookie']?.find(s=>s.startsWith(name+'='))?.split(';')[0];}
let deviceCookie;
const id='5aa1f422-e99e-4223-a520-660872748c4f';
test('portable HTTP identity is private and ignores injected platform headers',async()=>{
 const response=await request('/api/jobs',{headers:{'oai-authenticated-user-id':'suno:isolated-suno-account-a'}});
 assert.equal(response.status,200);assert.deepEqual(response.json(),{jobs:[]});deviceCookie=cookie(response.headers,'ocean_identity');assert.ok(deviceCookie);assert.match(response.headers['set-cookie'][0],/HttpOnly; Secure; SameSite=Lax/);
});
test('portable storage persists real SQL and WAV bytes with Range support',async()=>{
 const custom=await seal({url:'https://api.example.com/create',statusUrl:'',key:'test-only',model:'unit'});
 const notes=[60,64,67].map((note,i)=>({note,velocity:88,start:i*.2,duration:.1,channel:0}));
 const wav=new Uint8Array(64);wav.set(new TextEncoder().encode('RIFF'));wav.set(new TextEncoder().encode('WAVE'),8);
 const form=new FormData();form.set('audio',new Blob([wav]),'melody.wav');form.set('midi',JSON.stringify({notes,pedals:[]}));form.set('requestId',id);form.set('provider','custom');
 const encoded=new Request('http://test',{method:'POST',body:form});const body=Buffer.from(await encoded.arrayBuffer());
 const created=await request('/api/jobs?provider=custom',{method:'POST',headers:{cookie:deviceCookie+'; ocean_custom='+custom,'content-type':encoded.headers.get('content-type'),'content-length':String(body.length),origin:'https://suno.partykeys.ai'},body});
 assert.equal(created.status,201);assert.equal(created.json().notes.length,3);
 const range=await request(`/api/jobs/${id}/source`,{headers:{cookie:deviceCookie,range:'bytes=8-11'}});assert.equal(range.status,206);assert.equal(range.headers['content-range'],'bytes 8-11/64');assert.equal(range.body.toString(),'WAVE');
 const stranger=await request(`/api/jobs/${id}`,{headers:{'oai-authenticated-user-id':'forged-user'}});assert.equal(stranger.status,404);
});
test('Suno OAuth uses the matching domain and moves only the signed device library',async()=>{
 const start=await request('/api/auth/suno?site_origin=https%3A%2F%2Fsuno.partykeys.ai',{headers:{cookie:deviceCookie}});
 assert.equal(start.status,302);const location=new URL(start.headers.location);assert.equal(location.searchParams.get('client_id'),'test-en-client');assert.equal(location.searchParams.get('redirect_uri'),'https://suno.partykeys.ai/api/auth/callback');
 const callback=await request('/api/auth/callback?code=isolated-test-code&state='+location.searchParams.get('state'),{headers:{cookie:deviceCookie+'; '+cookie(start.headers,'ocean_oauth')}});
 assert.equal(callback.status,302);assert.equal(callback.headers.location,'https://suno.partykeys.ai/?connection=success');const accountCookie=cookie(callback.headers,'ocean_suno');assert.ok(accountCookie);assert.equal(providerCalls,3);
 const signedIn=await request('/api/jobs',{headers:{cookie:accountCookie}});assert.equal(signedIn.json().jobs[0].id,id);
 const disconnectedDevice=await request('/api/jobs',{headers:{cookie:deviceCookie}});assert.deepEqual(disconnectedDevice.json(),{jobs:[]});
 const otherAccount=await seal({access_token:'test',expires_at:Date.now()+900000,user_id:'isolated-account-b'});const isolated=await request(`/api/jobs/${id}`,{headers:{cookie:'ocean_suno='+otherAccount}});assert.equal(isolated.status,404);
});
test('unknown cross-origin writes fail and never reach a music provider',async()=>{const before=providerCalls;const response=await request('/api/providers/custom',{method:'POST',headers:{origin:'https://untrusted.example','content-type':'application/json'},body:'{}'});assert.equal(response.status,403);assert.equal(providerCalls,before);});
test('custom providers cannot resolve to internal or metadata addresses',async()=>{for(const address of ['127.0.0.1','10.1.2.3','169.254.169.254','172.16.0.1','192.168.1.1','198.18.0.1','::1','fe80::1','fd00::1','::ffff:127.0.0.1'])assert.equal(publicAddress(address),false,address);for(const address of ['1.1.1.1','8.8.8.8','2606:4700:4700::1111'])assert.equal(publicAddress(address),true,address);await assert.rejects(()=>publicFetch('https://127.0.0.1/'),/public Internet/);});
after(async()=>{globalThis.fetch=realFetch;await new Promise(resolve=>server.close(resolve));storage.close();await rm(directory,{recursive:true,force:true});});
