import {build} from 'esbuild';
await build({entryPoints:['portable/server.ts'],bundle:true,platform:'node',format:'esm',target:'node22',outfile:'dist-node/server.mjs',alias:{'cloudflare:workers':'./portable/cloudflare-node.ts'},external:['node:*']});
