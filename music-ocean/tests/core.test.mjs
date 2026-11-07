import test from 'node:test';
import assert from 'node:assert/strict';
import {MidiParser,toMidi,validateNotes,DEMO,normalizeTime} from '../lib/midi.mjs';
import {api,seal,normalizeClip,publicHttps,sunoCall} from './server-under-test.mjs';
process.env.OCEAN_COOKIE_SECRET='development-only-test-secret-with-more-than-32-characters';
const req=(path,init={})=>new Request('https://ocean.example/api/'+path,init);
const auth=async()=>`ocean_suno=${await seal({access_token:'test-token',expires_at:Date.now()+600000})}`;
test('MIDI packets preserve running status, channel, velocity, pedal, realtime and split messages',()=>{
 const events=[],parser=new MidiParser(e=>events.push(e));
 parser.feed([0x92,60,1,0xf8,64],100,'keyboard');parser.feed([127,60,0,0xb2,64,126,0xf0,1,2,0xf7,0x82,64,0],110,'keyboard');
 assert.deepEqual(events.map(({type,note,velocity,value,channel})=>({type,note,velocity,value,channel})),[
 {type:'on',note:60,velocity:1,value:undefined,channel:2},{type:'on',note:64,velocity:127,value:undefined,channel:2},
 {type:'off',note:60,velocity:0,value:undefined,channel:2},{type:'pedal',note:undefined,velocity:undefined,value:126,channel:2},{type:'off',note:64,velocity:0,value:undefined,channel:2}]);
});
test('MIDI time normalization accepts browser and epoch clocks, rejects alien clock',()=>{assert.equal(normalizeTime(1700000000123,123,1700000000000),123);assert.equal(normalizeTime(120,123,0),120);assert.equal(normalizeTime(-100000,123,0),123);});
test('MIDI export roundtrip keeps timing, channels, touches and pedal',()=>{
 const notes=[{note:60,start:0,duration:.5,velocity:1,channel:2},{note:64,start:.25,duration:.7,velocity:127,channel:2},{note:67,start:1,duration:1,velocity:80,channel:0}],b=toMidi(notes,[{start:.2,value:127,channel:2},{start:1.6,value:0,channel:2}],96);
 assert.equal(new TextDecoder().decode(b.slice(0,4)),'MThd');assert.equal(new DataView(b.buffer).getUint32(18),b.length-22);
 let i=22,tick=0;const found=[];while(i<b.length){let n=0,x;do{x=b[i++];n=(n<<7)|(x&127);}while(x&128);tick+=n;const s=b[i++];if(s===255){i++;let len=b[i++];i+=len;}else if((s&240)===192)i++;else{const a=b[i++],v=b[i++];found.push({tick,s,a,v});}}
 assert.deepEqual(found.filter(x=>(x.s&240)===144).map(x=>[x.tick,x.s&15,x.a,x.v]),[[0,2,60,1],[192,2,64,127],[768,0,67,80]]);
 assert.ok(found.some(x=>x.s===178&&x.a===64&&x.v===127));assert.ok(found.some(x=>x.s===130&&x.a===64&&x.tick===730));assert.equal(validateNotes(notes),true);assert.equal(validateNotes([{...notes[0],velocity:0},...notes.slice(1)]),false);assert.equal(validateNotes(DEMO),true);
});
test('provider credentials stay encrypted and return only connection status',async()=>{
 const token=await seal({access_token:'hidden-token',expires_at:Date.now()+60000});assert.ok(!token.includes('hidden-token'));
 const r=await api(req('providers',{headers:{cookie:`ocean_suno=${token}`}}));assert.equal(r.status,200);const d=await r.json();assert.equal(d.suno.connected,true);assert.ok(!JSON.stringify(d).includes('hidden-token'));
 const bad=await api(req('account',{headers:{cookie:`ocean_suno=${token}broken`}}));assert.equal(bad.status,401);
});
test('unsafe provider endpoints and foreign origins are refused',async()=>{
 for(const url of ['http://music.example.com','https://127.0.0.1/generate','https://192.168.1.1/generate','https://host.local/generate','https://user:password@music.example.com'])assert.throws(()=>publicHttps(url));
 const r=await api(req('providers/custom',{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},body:'{}'}));assert.equal(r.status,403);
});
test('Suno MCP handshake and generation propagate the official tool result',async()=>{
 const old=globalThis.fetch,calls=[];globalThis.fetch=async(url,init)=>{const b=JSON.parse(init.body);calls.push(b);if(b.method==='initialize')return Response.json({jsonrpc:'2.0',id:1,result:{protocolVersion:'2024-11-05',capabilities:{}}});if(b.method==='notifications/initialized')return new Response(null,{status:202});return Response.json({jsonrpc:'2.0',id:2,result:{content:[{type:'text',text:JSON.stringify({id:'test-fixture-only',status:'queued'})}]}});};
 try{const r=await api(req('generate?provider=suno',{method:'POST',headers:{cookie:await auth(),'Content-Type':'application/json'},body:JSON.stringify({sourceId:'uploaded-source',idempotencyKey:'unique-test-key',prompt:'soft piano',instrumental:true})}));assert.equal(r.status,200);assert.equal((await r.json()).id,'test-fixture-only');const tool=calls.find(x=>x.method==='tools/call').params;assert.equal(tool.name,'audio-create');assert.deepEqual(tool.arguments.reference_audio_ids,['uploaded-source']);assert.equal(tool.arguments.idempotency_key,'unique-test-key');assert.equal(tool.arguments.instrumental,true);assert.equal(tool.arguments.max_mode,undefined);}finally{globalThis.fetch=old;}
});
test('an API error never becomes a completed creation',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async(url,init)=>{const b=JSON.parse(init.body);return b.method==='initialize'?Response.json({result:{protocolVersion:'2024-11-05'}}):b.method==='notifications/initialized'?new Response(null,{status:202}):Response.json({result:{isError:true,structuredContent:{error:'Out of credits',code:'insufficient_credits'}}});};
 try{await assert.rejects(sunoCall('test-token','audio-create'),e=>e.status===402&&e.message==='Out of credits');}finally{globalThis.fetch=old;}
});
test('clip normalization accepts creation IDs and preserves returned URLs',()=>{assert.equal(normalizeClip({clip_ids:['a','b']}).id,'a');assert.deepEqual(normalizeClip({id:'a',status:'complete',audio_url:'https://cdn.example/a.mp3'}).audio_url,'https://cdn.example/a.mp3');});
test('a submitted work stays pending and waiting only reads the existing clip',async()=>{
 const old=globalThis.fetch,tools=[];globalThis.fetch=async(url,init)=>{const b=JSON.parse(init.body);if(b.method==='initialize')return Response.json({result:{protocolVersion:'2024-11-05'}});if(b.method==='notifications/initialized')return new Response(null,{status:202});tools.push(b.params);return Response.json({result:{structuredContent:{id:'existing-work',status:'submitted',title:'Ocean Echo',audio_url:null,song_url:null}}});};
 try{for(const wait of ['', '&wait=1']){const response=await api(req('work?id=existing-work'+wait,{headers:{cookie:await auth()}}));const work=await response.json();assert.equal(work.id,'existing-work');assert.equal(work.status,'submitted');assert.equal(work.audio_url,null);assert.equal(work.song_url,null);}assert.deepEqual(tools.map(t=>t.name),['audio-retrieve','audio-wait']);assert.ok(tools.every(t=>t.arguments.id==='existing-work'));}finally{globalThis.fetch=old;}
});
test('refresh rotation survives a provider failure, while invalid authorization clears the stale connection',async()=>{
 const old=globalThis.fetch;let refreshes=0,fail=true,used='';globalThis.fetch=async(url,init)=>{if(String(url).includes('/token/')){refreshes++;return Response.json({access_token:'rotated-access',refresh_token:'rotated-refresh',expires_in:900});}const b=JSON.parse(init.body);if(b.method==='initialize')return Response.json({result:{protocolVersion:'2024-11-05'}});if(b.method==='notifications/initialized')return new Response(null,{status:202});used=init.headers.Authorization;return fail?Response.json({result:{isError:true,structuredContent:{error:'Busy',status:503}}}):Response.json({result:{structuredContent:{id:'existing-work',status:'submitted'}}});};
 try{const expired=await seal({access_token:'old-access',refresh_token:'old-refresh',expires_at:Date.now()-1000});const first=await api(req('work?id=existing-work',{headers:{cookie:`ocean_suno=${expired}`}}));assert.equal(first.status,503);const renewed=first.headers.get('set-cookie');assert.ok(renewed?.startsWith('ocean_suno='));fail=false;const retry=await api(req('work?id=existing-work',{headers:{cookie:renewed.split(';')[0]}}));assert.equal(retry.status,200);assert.equal(refreshes,1);assert.equal(used,'Bearer rotated-access');const invalid=await api(req('work?id=existing-work',{headers:{cookie:'ocean_suno=invalid'}}));assert.equal(invalid.status,401);assert.ok(invalid.headers.get('set-cookie').includes('Max-Age=0'));}finally{globalThis.fetch=old;}
});
