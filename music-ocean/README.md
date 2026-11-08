# 小视感 · 音乐海洋 / Music Ocean

A PartyKeys-style music creation workbench with immutable source recordings, recoverable creation jobs, original/finished comparison, downloadable share cards and three 8-second motion backgrounds.

## Experience

1. Connect a PartyKeys/standard MIDI keyboard, use the on-screen piano or load the original demo.
2. Start recording, play at least three notes and finish. Pitch, timing, velocity and CC64 are preserved. Listen or export a Standard MIDI File.
3. Choose the musical direction and instrumental/vocal mode, then generate. The app first saves an immutable source WAV and note snapshot to the owner-scoped R2/D1 library, uploads the piano rendering to Suno, then creates an instrumental Cover or a vocal reference-based song and polls every returned clip ID. The result contains the provider's playable URL and/or song link. It never substitutes demo audio for a failed generation.
4. Settings switch Chinese/English and Suno/custom API. Completed work metadata, jobs and original recordings are kept in the private account library; local preferences and unsent drafts stay in this browser. Provider credentials do not use localStorage.

## Development

Node 24 is verified. Install using the bundled Sites `install-dependencies.mjs`, then `npm run dev -- --port 5188`.

Server configuration, supplied only through runtime secret settings:

- `OCEAN_COOKIE_SECRET`: at least 32 random characters, secret. Encrypts HttpOnly connection cookies.
- `PUBLIC_ORIGIN`: the actual website origin.
- `SUNO_CLIENT_ID`: public OAuth client ID registered with Suno. The web client registration and exact callback URLs require owner approval. Desktop Codex credentials are not copied into this website.

Suno web OAuth uses authorization code + PKCE S256, a ten-minute encrypted state/verifier cookie and refresh-token rotation. The only callback is `/api/auth/callback` on an approved origin. Normal scopes: `api:v0 credits:spend library:read offline_access profile:read`. Saving an official MP3 to a domestic music card separately asks the creator for the `download` scope.

## Playable domestic music cards

On the portable Chinese site, Share creates a compact `/s/<unpredictable-token>` music card. It contains Xiaoshigan cover art, the original note motif, a native audio player, seeking and a share button. The creator exports the selected completed song with Suno's official `audio-download` tool. A `requires_credit` answer is shown before the creator can confirm the one-download-credit export. Reusing a prepared card never calls Suno or spends another credit. An already officially downloaded MP3 can also be imported.

The MP3 and PNG cover stay on the Aliyun persistent volume. Card recipients need no account and make no Suno request. Only the selected song and card details are accessible through the unlisted link; original jobs, provider credentials and temporary download URLs remain private. The owner can stop the card's sharing. QR posters point to the domestic card instead of suno.com.

Card deep links include server-rendered title, description, PNG cover and audio metadata. This prepares link previews, but does not claim WeChat's native in-chat music bubble: that requires a separate verified WeChat application integration and real WeChat validation. The H5 card page does not record or extract Suno's protected player stream.

## Other API contract

Settings can store a public HTTPS generation URL, optional key, model and status URL. The key remains in an encrypted HttpOnly cookie. The server sends multipart form fields:

- `audio`: the rendered 44.1kHz mono PCM WAV, with at least eight seconds including silence/tail.
- `midi`: JSON `{format:"notes", bpm:96, notes:[{note,velocity,start,duration,channel}], pedals:[{start,value,channel}]}`. Times are seconds.
- `prompt`, `instrumental`, `model`, `duration`.

Expected JSON response: `{id, status, title, audio_url, song_url?, image_url?, duration?}`. A synchronous `complete` result can include only a playable URL. An asynchronous result needs an `id` and a same-origin status endpoint containing `{id}`, e.g. `https://music.example.com/works/{id}`. Status values include `queued`, `processing`, `streaming`, `complete`, `error`. Adapters are needed for providers with another schema; selecting Other API does not imply every music API is compatible.

## Verification

- `node node_modules/typescript/bin/tsc --noEmit`
- Bundle `tests/server-entry.ts` to `tests/server-under-test.mjs` with the test Cloudflare alias using esbuild, then `node --test tests/core.test.mjs tests/jobs.test.mjs`.
- Build via the bundled Sites `build-site.mjs`.
- Browser QA records are in `docs/USER_FLOW_REVIEW_V2.md`.

The V2 Cover test returned two real complete songs and their Suno links. Songs without a public audio URL use Suno’s standard embed player; source/creation switching is source comparison, not synchronized A/B. Physical keyboard input remains unverified. The custom domain has independently verified DNS and an active SSL certificate; browser routing status is recorded separately.

## Visual and sound credits

Character: the user's Xiaoshigan original full-body and updated turnaround references.
Visual direction: the existing `陪你去流浪：月潮引航` project; new images were generated with the built-in image-generation tool, each with both fixed character references. Prompts and visual review are in `docs/IMAGE_PROMPTS.md`.

Piano samples: Salamander Grand Piano V3 (Yamaha C5), Alexander Holm, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), [source](https://github.com/sfzinstruments/SalamanderGrandPiano). The same 52-sample/four-velocity-layer subset as the frozen Wander V40 foundation. No original song recording or song lyrics are distributed.

## Persistent storage and loops

Sites provisions `DB` (D1) and `BUCKET` (R2) from `.openai/hosting.json`. Migrations live in `drizzle/`; source files are owner-scoped and content-addressed. Creation advances use compare-and-swap leases, stable Suno idempotency keys and preservation of every expected child clip. A custom endpoint with an ambiguous POST result is never automatically resubmitted.

The three background MP4s in `public/video` are deterministic loops from the approved scene illustrations: 8 seconds, 1280×720, 24fps, silent H.264, identical first/last decoded frames. They are not AI-generated video. Reduced-motion preference, user motion setting and background visibility are respected.

## Aliyun and overseas deployment

The portable client and Node 24 backend build with `npm run build:portable`. See [portable/DEPLOY.md](portable/DEPLOY.md) for the shared persistent API, Vercel frontend, exact OAuth callbacks, private data handling, rollback and checks that are still pending. These files do not by themselves mean either production domain has been migrated.
