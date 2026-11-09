import React from 'react';
import {createRoot} from 'react-dom/client';
import Ocean from './app/ocean';
import {languageForHost} from './lib/locale';
import './app/globals.css';
import SharePlayer from './app/share-player';
import './app/studio.css';
import './app/wizard.css';
import './app/practice.css';

const lang=languageForHost(location.host);document.documentElement.lang=lang==='en'?'en':'zh-CN';
document.title=lang==='en'?'Music Ocean · PartyKeys × Xiaoshigan':'小视感 · 音乐海洋';
createRoot(document.getElementById('root')!).render(location.pathname.startsWith('/s/')?<SharePlayer/>:<Ocean defaultLang={lang} domesticShare={location.hostname!=='suno.partykeys.ai'}/>);
