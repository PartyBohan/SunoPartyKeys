import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {generateKeyPairSync,createHash,sign,randomUUID} from 'node:crypto';
import {createBridgeHandler,bridgeFetch} from '../dist-node/bridge-test.mjs';

test('overseas connection verifies the server signature and body before contacting Suno',async()=>{
 const pair=generateKeyPairSync('ed25519'),publicKey=pair.publicKey.export({type:'spki',format:'der'}).toString('base64'),privateKey=pair.privateKey.export({type:'pkcs8',format:'der'}).toString('base64');
 let calls=[];
 const upstream=async(url,init)=>{calls.push({url,method:init.method,headers:new Headers(init.headers),body:Buffer.from(init.body||'').toString()});return new Response('{"ok":true}',{headers:{'Content-Type':'application/json','Mcp-Session-Id':'verified-session'}});};
 const server=http.createServer(createBridgeHandler({publicKey:()=>publicKey,fetch:upstream,uploadFetch:upstream}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const local=`http://127.0.0.1:${server.address().port}`,nativeFetch=globalThis.fetch;
 const previous={url:process.env.OCEAN_SUNO_BRIDGE_URL,key:process.env.OCEAN_SUNO_BRIDGE_PRIVATE_KEY};
 const signed=(changes={},body='{}')=>{
  const now=Math.floor(Date.now()/1000),claim={v:1,iat:now,exp:now+60,nonce:randomUUID(),url:'https://api.suno.com/mcp',method:'POST',headers:{'content-type':'application/json'},hash:createHash('sha256').update(body).digest('base64url'),...changes};
  const payload=Buffer.from(JSON.stringify(claim)).toString('base64url');return `OceanBridge ${payload}.${sign(null,Buffer.from(payload),pair.privateKey).toString('base64url')}`;
 };
 try{
  let response=await nativeFetch(local,{method:'POST',body:'{}'});assert.equal(response.status,401);assert.equal(calls.length,0);
  response=await nativeFetch(local,{method:'POST',headers:{Authorization:signed()},body:'changed'});assert.equal(response.status,403);assert.equal(calls.length,0);
  response=await nativeFetch(local,{method:'POST',headers:{Authorization:signed({url:'https://127.0.0.1/private'})},body:'{}'});assert.equal(response.status,403);assert.equal(calls.length,0);
  response=await nativeFetch(local,{method:'POST',headers:{Authorization:signed({exp:1,iat:0})},body:'{}'});assert.equal(response.status,403);assert.equal(calls.length,0);
  process.env.OCEAN_SUNO_BRIDGE_URL='https://suno.partykeys.ai/api/suno-bridge';process.env.OCEAN_SUNO_BRIDGE_PRIVATE_KEY=privateKey;
  globalThis.fetch=(url,init)=>{assert.equal(url,process.env.OCEAN_SUNO_BRIDGE_URL);assert.equal(new Headers(init.headers).get('content-type'),'application/octet-stream');return nativeFetch(local,init);};
  response=await bridgeFetch('https://api.suno.com/mcp',{method:'POST',headers:{Authorization:'Bearer test-user-token','Content-Type':'application/json','Mcp-Session-Id':'source-session'},body:'{"method":"initialize"}'});
  assert.equal(response.status,200);assert.equal(response.headers.get('mcp-session-id'),'verified-session');assert.deepEqual(await response.json(),{ok:true});
  assert.equal(calls[0].headers.get('authorization'),'Bearer test-user-token');assert.equal(calls[0].headers.get('mcp-session-id'),'source-session');assert.equal(calls[0].body,'{"method":"initialize"}');
  await assert.rejects(()=>bridgeFetch('https://example.com/mcp',{method:'POST',body:'{}'}),/Unsupported Suno/);assert.equal(calls.length,1);
  response=await bridgeFetch('https://suno-uploads.s3.amazonaws.com/melody?signature=test',{method:'PUT',headers:{'Content-Type':'audio/wav'},body:Buffer.from('RIFFtest')});assert.equal(response.status,200);assert.equal(calls[1].method,'PUT');assert.equal(calls[1].body,'RIFFtest');
  await assert.rejects(()=>bridgeFetch('https://api.suno.com/mcp',{method:'POST',body:Buffer.alloc(4_200_001)}),e=>e.status===413);assert.equal(calls.length,2);
  response=await nativeFetch(local,{method:'POST',headers:{Authorization:signed()},body:Buffer.alloc(4_200_001)});assert.equal(response.status,413);assert.equal(calls.length,2);
  response=await bridgeFetch('https://cdn1.suno.ai/official-download.mp3?signature=test',{method:'GET'});assert.equal(response.status,200);assert.equal(calls[2].method,'GET');assert.equal(calls[2].body,'');
  for(const url of ['https://cdn1.suno.ai.evil.example/x','https://169.254.169.254/x','http://cdn1.suno.ai/x'])await assert.rejects(()=>bridgeFetch(url,{method:'GET'}),/Unsupported Suno/);assert.equal(calls.length,3);
 }finally{
  globalThis.fetch=nativeFetch;
  if(previous.url===undefined)delete process.env.OCEAN_SUNO_BRIDGE_URL;else process.env.OCEAN_SUNO_BRIDGE_URL=previous.url;
  if(previous.key===undefined)delete process.env.OCEAN_SUNO_BRIDGE_PRIVATE_KEY;else process.env.OCEAN_SUNO_BRIDGE_PRIVATE_KEY=previous.key;
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 }
});
