# Music Ocean on Aliyun + Vercel

The two domains serve the same client. `suno.partykeys.ai` starts in English and `suno.popumusic.cn` starts in Chinese. Browser preferences override the initial language.

## Runtime layout

- Aliyun: the Node 24 server serves the Chinese website and the shared API. Its SQLite database and original WAV files live outside the application release directory.
- Vercel: the overseas client is built using `npm run build:web`. Product API routes forward to Aliyun; `/api/suno-bridge` is a separate server function for Suno communication. API responses are private and never cached.
- Suno: each creator connects their own account; generated songs are saved to that Suno library. The live `account-me` tool returns public handle/avatar/profile URL fields without a stable user ID. Web recordings and task history therefore stay private to the signed browser session, as described in the product. Public handles are never used as storage identities. If a future provider response includes a verified stable ID, only that signed browser's records can move to that account. Clearing site cookies or changing domains does not sync this browser-scoped web history.
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
4. Run `node --env-file=/etc/music-ocean/runtime.env dist-node/server.mjs` under the host's service manager. It listens on loopback port 8787. Persist the data directory across restarts and releases. The selected existing host already uses 8787, so the isolated Docker deployment maps `127.0.0.1:18787` to container port 8787. Its verified existing official runtime is Node 22.23.2 and requires `--experimental-sqlite`; Node 24 remains the preferred fresh-install runtime. Give only public release directories/files read access to the non-root runtime (directories 0755, files 0644); keep configuration 0600 and data 0700.
5. Add only the `suno.popumusic.cn` HTTPS virtual host to the existing gateway, preserving unrelated virtual hosts. Proxy to `http://127.0.0.1:8787`, forward the original Host, allow at least a 13 MB request body and a 120-second upstream timeout. Validate configuration before reloading. Use a valid certificate for this hostname.
6. Check `/api/health`, original WAV Range responses, Suno connection and the private library before switching DNS. Retain the previous DNS value and release for rollback.

Do not claim a deployment based only on uploaded files: this backend requires a persistent disk and an actual Node process. Vercel functions must not run its SQLite storage.

## Suno connection across regions

The selected Hangzhou host timed out when connecting directly to Suno. The overseas function accepts only short-lived Ed25519-signed requests from the application's Aliyun server. It allows the fixed Suno MCP/token endpoints, validated HTTPS upload destinations, and GETs to official Suno/S3 download hosts; it never accepts an arbitrary proxy target. Uploads/downloads also use pinned public DNS addresses. Each download redirect is validated again. Request bodies and upstream credentials are covered by the signature. Do not log authorization headers or signed download URLs.

On Aliyun, run `node portable/configure-bridge.mjs /absolute/private/runtime.env`. The private signing key stays on Aliyun. The helper prints only `OCEAN_BRIDGE_PUBLIC_KEY`, which must be set as a server environment variable in the new Vercel project before redeploying. Restart only this application's container to load its private configuration. Verify the actual Aliyun → custom Vercel domain → Suno connection before claiming production readiness. MIDI reference WAVs use 32 kHz mono PCM so a full 60-second performance stays below Vercel's request size limit.

## Vercel

Use the GitHub `music-ocean-v2` branch and `music-ocean` root directory. The framework preset is Other; build `npm run build:web`; output `dist-web`. Create a preview before moving `suno.partykeys.ai` from its previous project. Attach the domain and update its DNS only after the Aliyun API is healthy.

## OAuth

Public client ID: `dcr-XaBOQ2-iypLzQ6NOXFeSRQ`. Registered callbacks are exactly:

- `https://suno.popumusic.cn/api/auth/callback`
- `https://suno.partykeys.ai/api/auth/callback`

Normal authorization explicitly asks for `api:v0 credits:spend library:read offline_access profile:read`. Only the music-card action `/api/auth/suno?download=1` adds `download`, after the creator chooses to authorize saving their own songs. Library write/search are not requested. Suno's wider registration capabilities are not treated as already granted scopes. A charged download also requires a separate, explicit in-product confirmation of a `requires_credit` quote.

The existing Sites publication remains a separate rollback copy. Existing Sites D1/R2 records have not yet been exported to the new persistent store. Do not claim historical library migration until that export/import is verified.

## Domestic share storage

Startup adds the `ocean_cards` table and a partial unique index for one active card per owner/job/clip without modifying creation records. Prepared MP3/PNG objects live in the private `card-audio/` data subdirectory, outside releases. Keep this directory and the database together in backups. Only the unguessable, ready, non-revoked card routes expose those objects, with HTTP Range support for MP3 seeking. Neither directory nor the database belongs in Git or a public release archive.

The current export path limits MP3s to 4.2 MB for the Vercel bridge response limit. It suits the product's 90-second songs. A failed or in-progress export is never presented as a ready card. Public card requests never call a generation or download tool. `/s/:token` and `/api/cards` exact/wildcard routes must forward to Aliyun on Vercel. Deploy the updated bridge before testing an overseas export.

## Verification

TypeScript, the static build and Node bundle pass. The 33 tests include real SQLite statements, original WAV bytes, range reads, HTTP owner isolation, signed device-to-account migration, matching OAuth redirects, account profile envelopes, successful public-profile-only authorization with browser isolation, safe idempotency, rejection of internal provider addresses, and signed bridge requests. Card tests additionally cover opt-in download authorization, the credit quote/confirmation boundary, concurrency, anonymous playback, escaped metadata, invalid imports and revocation. Tests mock Suno and do not spend credits. Real account consent, production host verification, WeChat behavior and old-library migration are separate deployment checks.
