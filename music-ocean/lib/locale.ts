import type {Lang} from './copy';

export function languageForHost(host:string):Lang {
 const hostname=host.toLowerCase().split(':')[0].replace(/\.$/,'');
 return hostname==='suno.partykeys.ai'?'en':'zh';
}
