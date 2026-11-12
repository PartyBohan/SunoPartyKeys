import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {midiFixture} from './practice-fixture.mjs';

const directory=await mkdtemp(join(tmpdir(),'music-ocean-practice-tests-'));
Object.assign(process.env,{OCEAN_DATA_DIR:directory,OCEAN_NO_LISTEN:'1',OCEAN_COOKIE_SECRET:'practice-test-only-secret-000000000000000000000000',PUBLIC_ORIGIN:'https://suno.popumusic.cn',OCEAN_ALLOWED_ORIGINS:'https://suno.popumusic.cn,https://suno.partykeys.ai'});
const {practiceApi,seal,storage,parsePracticeMidi,buildLessons,phrasesFor,acceptPracticeNote,lessonShift}=await import('../dist-node/test-entry.mjs');
const id='fixture-job',clipId='fixture-clip';
const owner='suno:practice-owner',session='ocean_suno='+await seal({access_token:'test-only',expires_at:Date.now()+900000});
const base=`https://suno.popumusic.cn/api/jobs/${id}/practice?clip=${clipId}`;
const job={id,provider:'suno',clips:[{id:clipId,status:'complete'},{id:'native-clip',status:'complete',midi_url:'https://cdn1.suno.ai/score.mid'},{id:'pending-clip',status:'streaming'}]};
await storage.DB.prepare('INSERT INTO ocean_creations(id,owner,request_key,document,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,owner,id,JSON.stringify(job),Date.now(),Date.now()).run();
let calls=0, downloads=0;
const svc={
  async transcribe(token,tool,args) {
    assert.equal(token,'test-only');assert.equal(tool,'audio-midi');assert.deepEqual(args,{id:clipId});
    const call=++calls;
    await new Promise(r=>setTimeout(r,20));
    return call===1?{status:'processing'}:{status:'ok',url:'https://cdn1.suno.ai/score.mid'};
  },
  async download(url,suno) {
    assert.equal(url,'https://cdn1.suno.ai/score.mid');assert.equal(suno,true);
    downloads++;return new Uint8Array(midiFixture);
  },
};
const run=(tail='',method='GET',headers={},body,as=owner,url=base)=>practiceApi(new Request(url+tail,{method,headers:{cookie:session,origin:'https://suno.partykeys.ai','oai-authenticated-user-id':as,...headers},body}),svc);

after(async()=>{storage.close();await rm(directory,{recursive:true,force:true});});

test('MIDI retains multiple instruments, running status, pedal data, percussion and tempo changes',()=>{
  const {parts,duration}=parsePracticeMidi(midiFixture);
  assert.equal(duration,1.5);
  assert.deepEqual(parts.map(p=>[p.name,p.channel,p.program,p.notes.length,p.drums]),[['Lead',0,80,2,false],['Chords',1,0,3,false],['Drums',9,0,2,true]]);
  assert.deepEqual(parts[0].notes.map(n=>[n.note,n.velocity,n.start,n.duration]),[[60,91,0,.5],[67,97,.5,1]]);
  assert.deepEqual(parts[1].pedals.map(p=>[p.start,p.value]),[[.25,100],[1.5,0]]);
  assert.throws(()=>parsePracticeMidi(midiFixture.subarray(0,midiFixture.length-2)));
});

test('derived melody and chord targets preserve source tracks and exact notes; partial hits wait',()=>{
  const score=parsePracticeMidi(midiFixture),lessons=buildLessons(score);
  assert.deepEqual(lessons.map(x=>x.id),['melody','chords',...score.parts.map(x=>x.id)]);
  assert.equal(lessons[0].notes[1].note,67);
  const phrase=phrasesFor(lessons[1].notes,score.duration)[0],target=phrase.targets[0],hit=new Set();
  assert.deepEqual(target.pitches,[48,52,55]);
  assert.equal(acceptPracticeNote(target,0,48,hit),'partial');
  assert.equal(acceptPracticeNote(target,0,48,hit),'partial');
  assert.equal(acceptPracticeNote(target,0,49,hit),'wrong');
  assert.equal(acceptPracticeNote(target,0,55,hit),'partial');
  assert.equal(acceptPracticeNote(target,0,52,hit),'complete');
  assert.equal(lessonShift([{time:0,pitches:[36,40,43]}]),12);
  assert.ok(!buildLessons({duration:1.5,parts:[score.parts[0]]}).some(x=>x.role==='chords'));
});

test('owned paid transcription requires consent, locks concurrent calls, polls the same clip and caches the result',async()=>{
  assert.equal((await run('&action=poll','POST')).status,200);
  assert.equal((await run('&action=start','POST')).status,400);
  assert.equal((await run('&action=start','POST',{origin:'https://example.com','x-confirm-midi-credits':'10'})).status,403);
  assert.equal((await run('&action=start','POST',{'x-confirm-midi-credits':'10'},undefined,'suno:foreign')).status,404);
  assert.equal((await run('&action=start','POST',{'x-confirm-midi-credits':'10'},undefined,owner,base.replace(clipId,'pending-clip'))).status,404);
  assert.equal(calls,0);
  const start=()=>run('&action=start','POST',{'x-confirm-midi-credits':'10'});
  const result=await Promise.all([start(),start()]);
  assert.equal(calls,1);
  assert.deepEqual(await Promise.all(result.map(r=>r.json())),[{state:'pending'},{state:'pending'}]);
  const polled=await run('&action=poll','POST');
  assert.deepEqual(await polled.json(),{state:'ready'});
  assert.equal(calls,2);assert.equal(downloads,1);
  assert.deepEqual(await (await start()).json(),{state:'ready'});
  assert.equal(calls,2);
  const file=await run('&file=1');
  assert.equal(file.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(Buffer.from(await file.arrayBuffer()),midiFixture);
  assert.equal((await run('&file=1','GET',{},undefined,'suno:foreign')).status,404);
});

test('native MIDI loads for free; import is private, validated and separate from the native score',async()=>{
  const native=base.replace(clipId,'native-clip');
  assert.deepEqual(await (await run('&action=start','POST',{},undefined,owner,native)).json(),{state:'ready'});
  assert.equal(calls,2);assert.equal(downloads,2);
  const type={'Content-Type':'audio/midi'};
  assert.equal((await run('&source=import','POST',type,'broken')).status,422);
  assert.equal((await run('&source=import&file=1')).status,404);
  assert.equal((await run('&source=import','POST',type,midiFixture)).status,200);
  assert.deepEqual(Buffer.from(await (await run('&source=import&file=1')).arrayBuffer()),midiFixture);
  assert.equal((await run('&source=import&file=1','GET',{},undefined,'suno:foreign')).status,404);
  assert.equal(calls,2);
});

test('C fingering preserves the original D-major pitch and supports explicit key signatures',async()=>{
  const {transposedFixture}=await import('./practice-fixture.mjs');
  const {practiceSourceKey,practiceSemitones,keyFromSignature}=await import('../dist-node/test-entry.mjs');
  const score=parsePracticeMidi(transposedFixture);
  assert.deepEqual(practiceSourceKey(score),{tonic:2,minor:false});
  assert.deepEqual(keyFromSignature(0,1),{tonic:9,minor:true});
  const phrase=phrasesFor(score.parts[0].notes,score.duration)[0];
  const shift=lessonShift(phrase.targets,practiceSemitones(2,0));
  assert.equal(shift,-2);
  assert.deepEqual(phrase.targets.map(t=>t.pitches[0]+shift),[60,64,67]);
  assert.deepEqual([60,64,67].map(key=>key-shift),[62,66,69]);
  assert.ok(phrase.start<phrase.targets[0].time);
});

test('charge follows physical hold duration, respects speed and can retry after release',async()=>{
  const {holdProgress,holdSeconds,newHold}=await import('../dist-node/test-entry.mjs');
  const target={time:2,pitches:[60,64],lengths:{60:.5,64:2}};
  const next={time:3,pitches:[67],lengths:{67:.5}};
  const hold=newHold();
  assert.equal(holdSeconds(target,next,64,.5),2);
  hold.down.set(60,10);hold.down.set(64,10);
  assert.deepEqual(holdProgress(hold,target,next,.5,10.5),{60:.5,64:.25});
  hold.down.delete(60);
  assert.deepEqual(holdProgress(hold,target,next,.5,11),{60:0,64:.5});
  hold.down.set(60,11);
  assert.deepEqual(holdProgress(hold,target,next,.5,12),{60:1,64:1});
  assert.deepEqual([...hold.completed],[60,64]);
});
