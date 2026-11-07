import {headers} from 'next/headers';
import Ocean from './ocean';
import {languageForHost} from '@/lib/locale';

export const dynamic='force-dynamic';

export default async function Page(){
 const requestHeaders=await headers();
 return <Ocean defaultLang={languageForHost(requestHeaders.get('host')||'')}/>;
}

export async function generateMetadata(){
 const requestHeaders=await headers();
 const en=languageForHost(requestHeaders.get('host')||'')==='en';
 return {
  title:en?'Music Ocean · PartyKeys × Xiaoshigan':'小视感 · 音乐海洋 | Music Ocean',
  description:en?'Play a few notes. Create your music. Share your song.':'弹下几个音，让旋律去很远的地方。',
 };
}
