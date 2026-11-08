import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
const directory=await mkdtemp(join(tmpdir(),'music-ocean-card-tests-'));
Object.assign(process.env,{OCEAN_DATA_DIR:directory,OCEAN_NO_LISTEN:'1',OCEAN_AUTH_MODE:'suno',OCEAN_COOKIE_SECRET:'card-tests-only-secret-000000000000000000000000',PUBLIC_ORIGIN:'https://suno.popumusic.cn',OCEAN_ALLOWED_ORIGINS:'https://suno.popumusic.cn,https://suno.partykeys.ai',SUNO_CLIENT_ID:'test-client'});
const {server,seal,unseal,storage}=await import('../dist-node/test-entry.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port,nativeFetch=globalThis.fetch;let calls=0,spends=0;
const bytes=new Uint8Array(256);bytes.set(new TextEncoder().encode('ID3'));
globalThis.fetch=async(input,init)=>{
 const url=String(input);if(url==='https://api.suno.com/mcp'){
  const d=JSON.parse(init.body);if(d.method==='initialize')return Response.json({result:{protocolVersion:'2024-11-05'}});if(d.method==='notifications/initialized')return new Response(null,{status:202});
  assert.equal(d.params.name,'audio-download','no generation is allowed in card tests');calls++;const a=d.params.arguments;assert.equal(a.id,'fixture-clip');assert.equal(a.format,'mp3');
  if(a.confirm){spends++;await new Promise(r=>setTimeout(r,30));return Response.json({result:{structuredContent:{status:'ok',url:'https://cdn1.suno.ai/fixture.mp3?test=temporary'}}});}
  return Response.json({result:{structuredContent:{status:'requires_credit',credits_remaining:7}}});
 }
 if(url==='https://cdn1.suno.ai/fixture.mp3?test=temporary')return new Response(bytes,{headers:{'Content-Type':'audio/mpeg'}});
 throw Error('Unexpected network request in isolated tests: '+url);
};
function request(path,{method='GET',headers={},body}={}){return new Promise((resolve,reject)=>{const r=http.request({hostname:'127.0.0.1',port,path,method,headers},res=>{const chunks=[];res.on('data',v=>chunks.push(v));res.on('end',()=>{const body=Buffer.concat(chunks);resolve({status:res.statusCode,headers:res.headers,body,text:()=>body.toString(),json:()=>JSON.parse(body.toString())});});});r.on('error',reject);r.end(body);});}
let ownerCookie,authCookie,token,jobId='00000000-0000-4000-8000-000000000001';
const post=(path,body={},cookie=authCookie)=>request(path,{method:'POST',headers:{cookie,'Content-Type':'application/json',origin:'https://suno.popumusic.cn'},body:JSON.stringify(body)});
test('only a creation owner can prepare a private, unpredictable share draft',async()=>{
 const identity=await request('/api/jobs');ownerCookie=identity.headers['set-cookie'].find(x=>x.startsWith('ocean_identity=')).split(';')[0];const owner=(await unseal(ownerCookie.slice('ocean_identity='.length))).id;
 const job={id:jobId,provider:'suno',title:'LOCAL FIXTURE · NOT A GENERATED SONG',notes:[60,64,67].map((note,i)=>({note,start:i,duration:.5,velocity:88,channel:0})),pedals:[],scene:0,clips:[{id:'fixture-clip',status:'complete',duration:90,song_url:'https://suno.com/song/fixture-clip'}],phase:'complete'};
 await storage.DB.prepare('INSERT INTO ocean_creations(id,owner,request_key,document,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(jobId,owner,jobId,JSON.stringify(job),Date.now(),Date.now()).run();
 authCookie=ownerCookie+'; ocean_suno='+await seal({access_token:'test-only',expires_at:Date.now()+900000,download:true});
 const foreign=await post('/api/cards',{jobId,clipId:'fixture-clip'},'ocean_suno='+await seal({access_token:'foreign',expires_at:Date.now()+900000,download:true}));assert.equal(foreign.status,404);
 const result=await post('/api/cards',{jobId,clipId:'fixture-clip',title:'A <script>alert("test")</script>'});assert.equal(result.status,201);token=result.json().token;assert.match(token,/^[A-Za-z0-9_-]{32}$/);assert.equal(calls,0);
 assert.equal((await request('/api/cards/'+token)).status,404);assert.equal((await request('/s/'+token)).status,404);
});
test('download scope is opt-in and a missing scope never triggers an export',async()=>{
 const base=await request('/api/auth/suno'),extra=await request('/api/auth/suno?download=1');assert.ok(!new URL(base.headers.location).searchParams.get('scope').split(' ').includes('download'));assert.ok(new URL(extra.headers.location).searchParams.get('scope').split(' ').includes('download'));
 const noScope=ownerCookie+'; ocean_suno='+await seal({access_token:'test-only',expires_at:Date.now()+900000});
 const result=await post('/api/cards/'+token+'/prepare',{},noScope);assert.equal(result.json().status,'connection_required');assert.equal(calls,0);
});
test('a provider quote precedes a charged export and concurrent clicks spend once',async()=>{
 assert.equal((await post('/api/cards/'+token+'/prepare',{confirm:true})).status,409);
 let r=await post('/api/cards/'+token+'/prepare');assert.equal(r.json().status,'requires_credit');assert.equal(r.json().creditsRemaining,7);assert.equal(spends,0);
 const oldScope=ownerCookie+'; ocean_suno='+await seal({access_token:'test-only',expires_at:Date.now()+900000});
 const results=await Promise.all([post('/api/cards/'+token+'/prepare',{confirm:true}),post('/api/cards/'+token+'/prepare',{confirm:true}),post('/api/cards/'+token+'/prepare',{},oldScope)]);assert.ok(results.some(r=>r.json().status==='ready'));assert.equal(spends,1);
 const before=calls;r=await post('/api/cards/'+token+'/prepare');assert.equal(r.json().status,'ready');assert.equal(calls,before);
});
test('a recipient gets only local metadata and seekable MP3, with no login or provider request',async()=>{
 const before=calls,r=await request('/api/cards/'+token);assert.equal(r.status,200);assert.equal(r.headers['set-cookie'],undefined);const data=r.json();assert.equal(data.creditsRemaining,undefined);for(const secret of ['owner','jobId','clipId','temporary','access_token','suno.com'])assert.ok(!r.text().includes(secret));assert.equal(data.audioUrl,'/api/cards/'+token+'/audio');
 const range=await request(data.audioUrl,{headers:{range:'bytes=0-2'}});assert.equal(range.status,206);assert.equal(range.body.toString(),'ID3');assert.equal(range.headers['content-range'],'bytes 0-2/256');assert.equal(range.headers['content-type'],'audio/mpeg');
 const head=await request(data.audioUrl,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.body.length,0);assert.equal(head.headers['set-cookie'],undefined);
 assert.equal((await request(data.audioUrl,{headers:{range:'bytes=999-'}})).status,416);assert.equal(calls,before);
});
test('share deep links have escaped server-rendered metadata and local audio in their boot data',async()=>{
 const r=await request('/s/'+token);assert.equal(r.status,200);const s=r.text();assert.match(s,/property="og:type" content="music.song"/);assert.match(s,/property="og:title" content="A &lt;script&gt;/);assert.ok(!s.includes('<script>alert'));assert.match(s,/\\u003cscript>/);assert.ok(s.includes('https://suno.popumusic.cn/api/cards/'+token+'/audio'));assert.ok(!s.includes('https://suno.com'));assert.equal((s.match(/name="description"/g)||[]).length,1);assert.equal(r.headers['cache-control'],'no-store');
});
test('foreign origins and recipients cannot edit or revoke a card; the owner can stop it',async()=>{
 const forbidden=await request('/api/cards/'+token+'/revoke',{method:'POST',headers:{cookie:authCookie,origin:'https://foreign.example','Content-Type':'application/json'},body:'{}'});assert.equal(forbidden.status,403);
 assert.equal((await post('/api/cards/'+token+'/revoke',{},'')).status,404);
 assert.equal((await post('/api/cards/'+token+'/revoke')).status,200);assert.equal((await request('/s/'+token)).status,404);assert.equal((await request('/api/cards/'+token+'/audio')).status,404);assert.equal((await request('/api/jobs/'+jobId,{headers:{cookie:ownerCookie}})).status,200);
});
test('an owner can import an official MP3 without a download call, while invalid files stay private',async()=>{
 const creates=await Promise.all([post('/api/cards',{jobId,clipId:'fixture-clip'}),post('/api/cards',{jobId,clipId:'fixture-clip'})]);const t=creates[0].json().token;assert.equal(creates[1].json().token,t);assert.notEqual(t,token);
 async function upload(content){const form=new FormData();form.set('audio',new Blob([content],{type:'audio/mpeg'}),'official.mp3');const encoded=new Request('https://test',{method:'POST',body:form});return request('/api/cards/'+t+'/upload',{method:'POST',headers:{cookie:ownerCookie,'Content-Type':encoded.headers.get('Content-Type')},body:Buffer.from(await encoded.arrayBuffer())});}
 const before=calls;assert.equal((await upload(Buffer.from('<html>not audio</html>'))).status,400);assert.equal((await request('/api/cards/'+t)).status,404);assert.equal((await upload(bytes)).json().status,'ready');assert.equal((await request('/api/cards/'+t+'/audio')).body.length,bytes.length);assert.equal(calls,before);
});
after(async()=>{globalThis.fetch=nativeFetch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));storage.close();await rm(directory,{recursive:true,force:true});});
