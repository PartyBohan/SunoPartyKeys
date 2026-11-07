import {env} from 'cloudflare:workers';
export function runtimeValue(key:string):string{const value=(env as unknown as Record<string,unknown>)[key];return typeof value==='string'?value:(process.env[key]||'');}
