import {generateKeyPairSync,createPrivateKey,createPublicKey} from 'node:crypto';
import {readFile,appendFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
const filename=process.argv[2];
if(!filename||!isAbsolute(filename))throw new Error('Provide the absolute private runtime environment file.');
const existing=await readFile(filename,'utf8');
let privateDer=existing.match(/^OCEAN_SUNO_BRIDGE_PRIVATE_KEY="([A-Za-z0-9+/=]+)"$/m)?.[1];
if(!privateDer){
 const pair=generateKeyPairSync('ed25519');privateDer=pair.privateKey.export({format:'der',type:'pkcs8'}).toString('base64');
 await appendFile(filename,`\nOCEAN_SUNO_BRIDGE_URL="https://suno.partykeys.ai/api/suno-bridge"\nOCEAN_SUNO_BRIDGE_PRIVATE_KEY=${JSON.stringify(privateDer)}\n`,{mode:0o600});
}
const publicKey=createPublicKey(createPrivateKey({key:Buffer.from(privateDer,'base64'),format:'der',type:'pkcs8'}));
console.log('OCEAN_BRIDGE_PUBLIC_KEY='+publicKey.export({format:'der',type:'spki'}).toString('base64'));
