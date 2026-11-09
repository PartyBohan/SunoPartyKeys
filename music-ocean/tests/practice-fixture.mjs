const vlq = (n) => {
  const bytes=[n&127];
  while ((n>>=7)) bytes.unshift(128|(n&127));
  return bytes;
};
const chunk=(type,bytes)=>{
  const size=Buffer.alloc(4);size.writeUInt32BE(bytes.length);
  return Buffer.concat([Buffer.from(type),size,Buffer.from(bytes)]);
};
const event=(dt,...bytes)=>[...vlq(dt),...bytes];
const meta=(type,value)=>event(0,255,type,...vlq(value.length),...value);
const track=(name,bytes)=>chunk('MTrk',[...meta(3,[...Buffer.from(name)]),...bytes,...meta(47,[])]);
export const midiFixture=Buffer.concat([
  chunk('MThd',[0,1,0,4,1,224]),
  track('Tempo',[...event(0,255,81,3,7,161,32),...event(480,255,81,3,15,66,64)]),
  track('Lead',[...event(0,192,80),...event(0,144,60,91),...event(480,60,0),...event(0,144,67,97),...event(480,128,67,64)]),
  track('Chords',[...event(0,193,0),...event(0,145,48,90),...event(0,52,80),...event(0,55,87),...event(240,177,64,100),...event(240,129,48,0),...event(0,52,0),...event(0,55,0),...event(480,177,64,0)]),
  track('Drums',[...event(0,153,36,110),...event(120,137,36,0),...event(120,153,42,92),...event(120,137,42,0)]),
]);
