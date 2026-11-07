import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute} from 'node:path';

const [filename,dataDirectory]=process.argv.slice(2);
if(!filename||!dataDirectory||!isAbsolute(filename)||!isAbsolute(dataDirectory))throw new Error('Usage: node portable/configure.mjs /absolute/private/env /absolute/private/data');
await mkdir(dirname(filename),{recursive:true,mode:0o700});
await mkdir(dataDirectory,{recursive:true,mode:0o700});
const values={OCEAN_COOKIE_SECRET:randomBytes(48).toString('base64url'),OCEAN_AUTH_MODE:'suno',PUBLIC_ORIGIN:'https://suno.popumusic.cn',OCEAN_ALLOWED_ORIGINS:'https://suno.popumusic.cn,https://suno.partykeys.ai',SUNO_CLIENT_ID:'dcr-XaBOQ2-iypLzQ6NOXFeSRQ',SUNO_PARTYKEYS_CLIENT_ID:'dcr-XaBOQ2-iypLzQ6NOXFeSRQ',OCEAN_DATA_DIR:dataDirectory,HOST:'127.0.0.1',PORT:'8787',NODE_ENV:'production'};
await writeFile(filename,Object.entries(values).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{flag:'wx',mode:0o600});
console.log(`Created private runtime configuration: ${filename}. No secret values printed.`);
