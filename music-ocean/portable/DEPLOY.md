# Music Ocean on Aliyun + Vercel

The two domains serve the same client. `suno.partykeys.ai` starts in English and `suno.popumusic.cn` starts in Chinese. Browser preferences override the initial language.

## Runtime layout

- Aliyun: the Node 24 server serves the Chinese website and the shared API. Its SQLite database and original WAV files live outside the application release directory.
- Vercel: the overseas static client is built using `npm run build:web`. `vercel.json` forwards `/api/*` to the Aliyun API. API responses are private and never cached.
- Suno: each creator connects their own account. Verified `account-me` identity scopes that account's private library. Custom API work uses a signed device identity; it moves to that browser's verified Suno account on connection.
- The Node entry strips incoming platform identity headers. It does not trust a browser-supplied user ID. Credentials remain in encrypted HttpOnly cookies. Custom provider traffic pins a public DNS result and does not follow redirects to other addresses.

## Build

```sh
npm ci
npm run build:portable
```

Deploy only `dist-web/`, `dist-node/server.mjs` and the configuration helper. Do not copy `.env*`, `.dev.vars*`, test bundles, SQLite files, local cloud state or credentials.

## Aliyun installation

Reuse a verified, authorized ECS or equivalent persistent Node host. Do not create paid resources or overwrite another application's directory as part of this procedure.

1. Choose a dedicated release path, for example `/opt/music-ocean/releases/<commit>/`, and a persistent data path such as `/var/lib/music-ocean/`.
2. Place the release files in that directory. Keep the previous release available for rollback.
3. Once only, run `node portable/configure.mjs /etc/music-ocean/runtime.env /var/lib/music-ocean`. It generates an encryption secret on the server with mode 0600 and refuses to overwrite existing configuration. Ensure the selected service account can use its own data directory.
4. Run `node --env-file=/etc/music-ocean/runtime.env dist-node/server.mjs` under the host's service manager. It listens on loopback port 8787. Persist the data directory across restarts and releases.
5. Add only the `suno.popumusic.cn` HTTPS virtual host to the existing gateway, preserving unrelated virtual hosts. Proxy to `http://127.0.0.1:8787`, forward the original Host, allow at least a 13 MB request body and a 120-second upstream timeout. Validate configuration before reloading. Use a valid certificate for this hostname.
6. Check `/api/health`, original WAV Range responses, Suno connection and the private library before switching DNS. Retain the previous DNS value and release for rollback.

Do not claim a deployment based only on uploaded files: this backend requires a persistent disk and an actual Node process. Vercel functions must not run its SQLite storage.

## Vercel

Use the GitHub `music-ocean-v2` branch and `music-ocean` root directory. The framework preset is Other; build `npm run build:web`; output `dist-web`. Create a preview before moving `suno.partykeys.ai` from its previous project. Attach the domain and update its DNS only after the Aliyun API is healthy.

## OAuth

Public client ID: `dcr-XaBOQ2-iypLzQ6NOXFeSRQ`. Registered callbacks are exactly:

- `https://suno.popumusic.cn/api/auth/callback`
- `https://suno.partykeys.ai/api/auth/callback`

Every authorization request explicitly asks for `api:v0 credits:spend library:read offline_access profile:read`. Suno's registration response reports a wider default capability set; it is not treated as permission to request extra scopes. This app does not request download, library write or search scopes.

The existing Sites publication remains a separate rollback copy. Existing Sites D1/R2 records have not yet been exported to the new persistent store. Do not claim historical library migration until that export/import is verified.

## Verification

TypeScript, the static build and Node bundle pass. The 23 tests include real SQLite statements, original WAV bytes, range reads, HTTP owner isolation, signed device-to-account migration, matching OAuth redirects, safe idempotency and rejection of internal provider addresses. Tests mock Suno and do not spend credits. Real account consent, production host verification and old-library migration are separate deployment checks.
