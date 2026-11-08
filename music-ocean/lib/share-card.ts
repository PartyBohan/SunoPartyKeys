import QRCode from 'qrcode';
import type {Note} from './piano';
export type CardInput={title:string;scene:number;notes:Note[];songUrl?:string|null;lang:'zh'|'en'};
const scenes=['/images/tidal-prelude.webp','/images/moon-current.webp','/images/amber-reef.webp'];
const load=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});
export async function createShareCard(input:CardInput):Promise<Blob>{
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;const c=canvas.getContext('2d')!;
 const [scene,logo]=await Promise.all([load(scenes[input.scene]||scenes[0]),load('/images/logo.png')]);
 c.fillStyle='#111316';c.fillRect(0,0,1080,1440);
 const sw=scene.width,sh=scene.height,scale=Math.max(1080/sw,820/sh);c.drawImage(scene,(1080-sw*scale)/2,(820-sh*scale)/2,sw*scale,sh*scale);
 const shade=c.createLinearGradient(0,200,0,850);shade.addColorStop(0,'#11131600');shade.addColorStop(1,'#111316');c.fillStyle=shade;c.fillRect(0,0,1080,850);
 c.drawImage(logo,60,52,46,46);c.fillStyle='#fff';c.font='600 25px -apple-system, sans-serif';c.fillText(input.lang==='zh'?'音乐密码  /  MUSIC OCEAN':'PartyKeys  /  MUSIC OCEAN',124,85);
 c.fillStyle='#c9e6f2';c.font='500 24px -apple-system, sans-serif';c.fillText(input.lang==='zh'?'我弹了几个音，做了这首歌。':'A few notes I played. A song of my own.',64,804);
 c.fillStyle='#fff';c.font='700 64px -apple-system, sans-serif';let title=input.title.slice(0,46),line='',y=894,lines=0;for(const ch of title){if(c.measureText(line+ch).width>940){if(lines===1){while(c.measureText(line+'…').width>940)line=line.slice(0,-1);line+='…';break;}c.fillText(line,64,y);line='';y+=78;lines++;}line+=ch;}c.fillText(line,64,y);
 const rollY=Math.max(995,y+55),rollH=142;c.fillStyle='#1b1f24';c.beginPath();c.roundRect(60,rollY,960,rollH,16);c.fill();
 c.fillStyle='#9aa6af';c.font='500 19px monospace';c.fillText(input.lang==='zh'?'这段旋律，来自我的手指':'THE MELODY I PLAYED',84,rollY+35);
 const notes=input.notes,maxT=Math.max(1,...notes.map(n=>n.start+n.duration)),low=Math.min(60,...notes.map(n=>n.note)),high=Math.max(low+12,...notes.map(n=>n.note));
 for(const n of notes){c.fillStyle=['#5ac2fe','#bc5bf5','#fda565'][n.note%3];c.beginPath();c.roundRect(84+n.start/maxT*906,rollY+68+(1-(n.note-low)/(high-low))*44,Math.max(7,n.duration/maxT*880),7,3);c.fill();}
 const url=input.songUrl?.startsWith('https:')?input.songUrl:null;
 if(url){const qr=document.createElement('canvas');await QRCode.toCanvas(qr,url,{width:142,margin:1,color:{dark:'#111316',light:'#ffffff'},errorCorrectionLevel:'M'});c.fillStyle='#fff';c.beginPath();c.roundRect(64,1238,152,152,12);c.fill();c.drawImage(qr,69,1243,142,142);}
 c.fillStyle='#fff';c.font='600 27px -apple-system,sans-serif';c.fillText(url?(input.lang==='zh'?'扫码听我的作品':'SCAN TO LISTEN'):(input.lang==='zh'?'我的第一份音乐灵感':'A LITTLE MELODY. MY OWN.'),url?244:64,1285);
 c.fillStyle='#a2a9b0';c.font='22px -apple-system,sans-serif';c.fillText(input.lang==='zh'?`${notes.length} 个音符 · 小视感陪我创作`:`${notes.length} notes · Created with Xiaoshigan`,url?244:64,1330);
 c.fillStyle='#606973';c.font='18px monospace';c.fillText('PLAY A LITTLE. MAKE IT YOURS.',url?244:64,1375);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Card export failed')),'image/png'));
}
