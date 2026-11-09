import test from 'node:test';
import assert from 'node:assert/strict';
import {MUSIC_PRESETS,MAX_DIRECTION_CHARS,musicDirection,MAX_PROMPT_CHARS,buildMusicPrompt,musicPromptKey,restoreMusicDirection,accountUsage,KEYBOARD_NOTES,WHITE_KEYS,BLACK_KEYS,keyLane} from '../dist-node/studio-test.mjs';
import {canVisitStep,restoreStudioStep} from '../dist-node/studio-test.mjs';

test('four-step navigation permits returning to melody and requires a real saved work for the result page',()=>{
 assert.equal(canVisitStep(1,false,false),true);assert.equal(canVisitStep(2,false,false),false);assert.equal(canVisitStep(3,true,false),false);
 assert.equal(canVisitStep(2,true,true),true);assert.equal(canVisitStep(3,true,true),true);
 assert.equal(restoreStudioStep(3,true,{phase:'complete'}),3);
 assert.equal(restoreStudioStep(3,true,null),1);
 assert.equal(restoreStudioStep(2,true,{phase:'complete'}),2);
 assert.equal(restoreStudioStep(2,false,null),1);
 assert.equal(restoreStudioStep(1,true,{phase:'generating'}),3);
 assert.equal(canVisitStep(4,true,true),false);
 assert.equal(canVisitStep(4,false,true,true),true);
 assert.equal(restoreStudioStep(4,true,{phase:'complete'},true),4);
 assert.equal(restoreStudioStep(4,true,{phase:'generating'}),3);
});

test('every visible production brief is complete, format-specific, distinct and fits the submitted provider field',()=>{
 const prompts=[];
 for(let i=0;i<5;i++)for(const instrumental of [true,false]){
  const prompt=buildMusicPrompt(i,instrumental);prompts.push(prompt);
  assert.ok(prompt.length<MAX_PROMPT_CHARS);
  for(const section of ['Style','Instruments','Harmony','Arrangement','Production','Melody','Vocals'])assert.match(prompt,new RegExp('(?:^|\\n)'+section+': '));
  assert.match(prompt,new RegExp(String(MUSIC_PRESETS[i].bpm)+' BPM'));
  assert.equal(prompt.includes('instrumental only'),instrumental);
  assert.equal(prompt.includes('rhythmic lead'),!instrumental);
 }
 assert.equal(new Set(prompts).size,10);
});
test('edited briefs survive reload independently for each style and format, including an intentionally empty draft',()=>{
 const edits={[musicPromptKey(0,true)]:'', [musicPromptKey(2,false)]:'My exact\nproduction brief.',unknown:'ignored'};
 const result=restoreMusicDirection({version:3,preset:'chrome-disco',instrumental:false,prompts:edits});
 assert.equal(result.style,2);assert.equal(result.instrumental,false);
 assert.deepEqual(result.edits,{[musicPromptKey(0,true)]:'',[musicPromptKey(2,false)]:'My exact\nproduction brief.'});
 assert.equal(restoreMusicDirection({version:3,prompts:{[musicPromptKey(1,true)]:'x'.repeat(2000)}}).edits[musicPromptKey(1,true)].length,1000);
});
test('Chinese presets contain Chinese only, English presets stay English, and edits never leak across languages',()=>{
 for(let i=0;i<5;i++)for(const format of [true,false]){
  const cn=buildMusicPrompt(i,format,'zh'),en=buildMusicPrompt(i,format,'en');
  assert.doesNotMatch(cn,/[a-z]/i);assert.doesNotMatch(en,/[\u3400-\u9fff]/);
  for(const section of ['风格','配器','和声','段落','制作','旋律','人声'])assert.ok(cn.includes(section+'：'));
  assert.ok(cn.length<MAX_PROMPT_CHARS);assert.equal(cn.includes('中文演唱'),!format);
 }
 const cnKey=musicPromptKey(0,true,'zh'),enKey=musicPromptKey(0,true,'en');
 const restored=restoreMusicDirection({version:3,prompts:{[cnKey]:'我的中文制作说明',[enKey]:'My English brief'}});
 assert.equal(restored.edits[cnKey],'我的中文制作说明');assert.equal(restored.edits[enKey],'My English brief');
 const migrated=restoreMusicDirection({preset:'neon-funk',prompt:'开场就是贝斯钩子'});
 assert.doesNotMatch(migrated.edits[cnKey],/[a-z]/i);assert.match(migrated.edits[cnKey],/开场就是贝斯钩子/);
});
test('legacy descriptions migrate with their user direction intact and malformed storage has safe defaults',()=>{
 const result=restoreMusicDirection({preset:'glitch-hook',prompt:'Keep my brass answer.',instrumental:false},'zh');
 assert.equal(result.style,3);assert.equal(result.instrumental,false);
 assert.match(result.edits[musicPromptKey(3,false)],/Keep my brass answer\./);
 assert.ok(result.edits[musicPromptKey(3,false)].length<=MAX_PROMPT_CHARS);
 assert.deepEqual(restoreMusicDirection(null),{style:0,instrumental:true,edits:{}});
});

test('all five directions preserve the MIDI motif and a full user description within the provider limit',()=>{
 assert.equal(MUSIC_PRESETS.length,5);
 assert.equal(new Set(MUSIC_PRESETS.map(p=>p.id)).size,5);
 for(let i=0;i<5;i++)for(const lang of ['zh','en']){
  const extra=(lang==='zh'?'鼓':'x').repeat(MAX_DIRECTION_CHARS);
  const prompt=musicDirection(i,extra,lang);
  assert.ok(prompt.length<=1000,`${MUSIC_PRESETS[i].id}: ${prompt.length}`);
  assert.ok(prompt.endsWith(extra));
  assert.match(prompt,/Preserve the supplied MIDI melody/);
  assert.ok(MUSIC_PRESETS[i].bpm>=116);
 }
});
test('direction trims overlong text and safely falls back to the first preset',()=>{
 assert.equal(musicDirection(999,'x'.repeat(900),'en'),musicDirection(0,'x'.repeat(500),'en'));
 assert.ok(musicDirection(0,'  a custom hook  ','en').endsWith('a custom hook'));
});
test('hardware keyboard contains exactly 36 unique consecutive pitches and the correct 2+3 black-key groups',()=>{
 assert.deepEqual(KEYBOARD_NOTES,Array.from({length:36},(_,i)=>48+i));
 assert.equal(WHITE_KEYS.length,21);assert.equal(BLACK_KEYS.length,15);
 assert.equal(new Set([...WHITE_KEYS,...BLACK_KEYS.map(k=>k.n)]).size,36);
 assert.deepEqual(BLACK_KEYS.map(k=>k.x),[1,2,4,5,6,8,9,11,12,13,15,16,18,19,20]);
 for(const key of BLACK_KEYS){assert.ok(WHITE_KEYS[key.x-1]<key.n);assert.ok(WHITE_KEYS[key.x]>key.n);}
});
test('waterfall lanes share the keyboard’s exact centers for white and black keys',()=>{
 assert.equal(keyLane(48),.5/21*100);
 assert.equal(keyLane(49),1/21*100);
 assert.equal(keyLane(50),1.5/21*100);
 assert.equal(keyLane(51),2/21*100);
 assert.equal(keyLane(83),20.5/21*100);
 assert.ok(KEYBOARD_NOTES.every((note,i)=>i===0||keyLane(note)>keyLane(KEYBOARD_NOTES[i-1])));
});
test('usage keeps zero separate from unknown and accepts the actual nested account envelope',()=>{
 assert.deepEqual(accountUsage({result:{structuredContent:{suno_account:{plan:{name:'Pro'},credits_remaining:0,download_credits_remaining:7}}}}),{plan:'Pro',generation:0,downloads:7});
 assert.deepEqual(accountUsage({data:[{suno_account:{credits_remaining:-1,download_credits_remaining:'7'}}]}),{plan:null,generation:null,downloads:null});
 assert.equal(accountUsage({data:{unrelated:true}}),null);
});
test('usage rejects non-finite numbers and terminates on cyclic or very deep data',()=>{
 assert.deepEqual(accountUsage({suno_account:{credits_remaining:NaN,download_credits_remaining:Infinity}}),{plan:null,generation:null,downloads:null});
 const cycle={};cycle.data=cycle;assert.equal(accountUsage(cycle),null);
});
