import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {readFile,writeFile,rename,stat,mkdir} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';

export function createStorage(directory:string){
 const root=resolve(directory);mkdirSync(root,{recursive:true,mode:0o700});
 const sqlite=new DatabaseSync(resolve(root,'ocean.sqlite'));
 sqlite.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS ocean_creations(id TEXT PRIMARY KEY NOT NULL,owner TEXT NOT NULL,request_key TEXT NOT NULL,document TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS ocean_owner_created ON ocean_creations(owner,created_at);`);
 const DB={prepare(sql:string){const prepared=sqlite.prepare(sql);return {bind(...values:any[]){return {
  async first(){return prepared.get(...values)||null;},
  async all(){return {results:prepared.all(...values)};},
  async run(){return {meta:{changes:Number(prepared.run(...values).changes)}};},
 };}};}};
 const objects=resolve(root,'originals');mkdirSync(objects,{recursive:true,mode:0o700});
 function objectPath(key:string){if(!key.startsWith('originals/')||key.includes('\\')||key.split('/').includes('..'))throw new Error('Invalid object key');const path=resolve(root,key);if(!path.startsWith(objects+sep))throw new Error('Invalid object key');return path;}
 const BUCKET={
  async put(key:string,value:ArrayBuffer|Uint8Array){const path=objectPath(key);await mkdir(dirname(path),{recursive:true,mode:0o700});const temp=path+'.'+crypto.randomUUID()+'.tmp';await writeFile(temp,new Uint8Array(value),{mode:0o600});await rename(temp,path);},
  async get(key:string,options?:{range?:Headers}){const path=objectPath(key);let size:number;try{size=(await stat(path)).size;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
   const bytes=await readFile(path);let offset=0,length=size,range:undefined|{offset:number;length:number};const requested=options?.range?.get('range');
   if(requested){const m=requested.match(/^bytes=(\d*)-(\d*)$/);if(!m||(!m[1]&&!m[2]))throw Object.assign(new Error('Invalid byte range'),{status:416});if(m[1]){offset=Number(m[1]);length=(m[2]?Math.min(Number(m[2]),size-1):size-1)-offset+1;}else{length=Math.min(Number(m[2]),size);offset=size-length;}if(offset>=size||length<=0)throw Object.assign(new Error('Byte range is outside this recording'),{status:416});range={offset,length};}
   const body=new Uint8Array(bytes.buffer.slice(bytes.byteOffset+offset,bytes.byteOffset+offset+length));return {size,range,body,async arrayBuffer(){return body.buffer as ArrayBuffer;}};
  },
 };
 return {DB,BUCKET,close(){sqlite.close();}};
}
