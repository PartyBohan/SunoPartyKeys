# Shine Up, Notes On

> Suno × PartyKeys — play one motif, let AI give it a full band, and let the lights teach you to play it back.

A browser app for absolute beginners: play a short motif on a PartyKeys 36 (or your computer keyboard / on-screen piano) → it auto-detects key and tempo → it calls Suno to generate a song with wordless "ah" vocals → the PartyKeys lights guide you to play along and score you in real time. The teaching melody is the MIDI you played yourself (zero transcription, zero error); Suno only fills in the backing band.

---

## Project structure

```
shine-up-notes-on/
├── index.html        # The whole app (single file, zero external dependencies)
├── api/
│   ├── suno.js       # Vercel proxy: Suno generation (hides SUNO_KEY + fixes CORS)
│   └── stems.js      # Vercel proxy: music.ai vocal/accompaniment separation (hides MUSICAI_KEY)
├── local-proxy.mjs   # Local dev proxy (one process proxies both Suno + music.ai, Node 18+)
├── demucs-server.py  # Local separation service (open-source Demucs, free, no key, optional step-3 backend)
├── package.json
├── .env.example
└── .gitignore
```

---

## Deploy to Vercel (recommended)

1. Push this folder to a new GitHub repo.
2. Create a project on Vercel, import the repo, and **leave Root Directory empty** (the project lives at the root). Zero config: `index.html` is served as a static page and `api/suno.js` automatically becomes a function.
3. In the Vercel project, go to **Settings → Environment Variables** and add:
   - `SUNO_KEY` = your `sk_live_...` key (from platform.suno.com) — required for generation
   - `MUSICAI_KEY` = your music.ai key (optional) — needed for the step-3 vocal/accompaniment separation; if omitted, separation is skipped
4. Deploy. Once the site is open, the app automatically points requests to the same-origin `/api/suno` (and separation to `/api/stems`) — no manual changes needed.

> Keys live only in Vercel environment variables and never reach the browser.

---

## Local development

You can play offline (with the built-in backing demo): just double-click `index.html` and the connection mode is automatically set to "built-in backing demo".

To actually wire up Suno locally:

```bash
# Node 18+ (built-in fetch)
node local-proxy.mjs sk_live_your_key
# Proxy runs at http://localhost:8787
```

Then open the page through a local server (to avoid `file://` restrictions), e.g.:

```bash
npx serve .        # or any static server, visit http://localhost:3000
```

On localhost the page automatically sets the request URL to `http://localhost:8787` and the connection mode to "via proxy".

---

## PartyKeys lights

The app ships with two lighting protocols; there's a "💡 Test lights" button in the settings area:

- **Classic CMD 0x71** (default) — color ID + real MIDI note number, matches the current games, most reliable.
- **RGB CMD 0x15** — 24-bit RGB + key index (the newer protocol.partykeys.org protocol).

Connect a PartyKeys, hit "Test lights"; if nothing lights up, switch to the other protocol and try again to lock in the one your firmware supports.
Requires Chrome / Edge (Web MIDI + SysEx). Note the hardware LED latency is about 200ms.

---

## Suno API cheat sheet (Berklee Hackathon)

- Base: `https://api.suno.com/`, auth `Authorization: Bearer sk_live_...`
- Generate `POST /v0/audio`: Simple (`description`) / Custom (`lyrics` + `style`, `instrumental:true` for a pure backing track)
- Cover `POST /v0/audio/{id}/covers`, mashup `POST /v0/audio/{id}/mashups`
- Poll `GET /v0/audio/{id}` until `status:"complete"`, then read `audio_url`
- Usage `GET /v0/account/usage`; rate limit 10 req/s
- ❌ The official API has no audio upload, no stem separation, and no custom voice cloning (use the 3 preset `voice_id`s)

---

## Vocal / accompaniment separation (step 3)

The official Suno response is a single mixed audio track with no stems of its own. Step 3 splits that `audio_url` into an aligned vocal + accompaniment pair, shown as two independent track strips (each with a mute button). In settings you can pick one of two "separation backends"; both use the same job protocol (`POST /job` → poll `GET /job/{id}` → `result.vocals` / `result.accompaniments`):

### A) Demucs local (open-source · free · hackathon pick)

The bundled `demucs-server.py` runs Facebook's [Demucs](https://github.com/facebookresearch/demucs) on your own machine, splitting the full track into vocals + accompaniment. Fully local, no external API, no key.

**Install in a Python 3.11 virtual environment** (demucs depends on PyTorch; Python 3.13/3.14 are too new and have no torch wheels yet, so install will fail):

```bash
brew install ffmpeg python@3.11        # demucs needs ffmpeg to read/write mp3
python3.11 -m venv .venv               # create an isolated env in the project
.venv/bin/python -m pip install -U demucs "numpy<2" certifi
.venv/bin/python demucs-server.py      # defaults to http://localhost:8788
```

Watch out for three local gotchas (already handled by the script / commands above):
- `numpy<2`: torch 2.2.x is incompatible with numpy 2.x, otherwise demucs throws `Numpy is not available`.
- `certifi`: macOS Homebrew Python lacks CA root certs, otherwise downloading Suno audio / demucs models throws `CERTIFICATE_VERIFY_FAILED` (`demucs-server.py` uses certifi's cert bundle and sets `SSL_CERT_FILE`).
- Use the venv's `python` (not a bare `python3`) to start the service, so demucs runs from where it was installed.

In app settings, set **Separation backend = Demucs local** (already selected by default when opened on localhost), and keep the address `http://localhost:8788`. The first run downloads the htdemucs model (~84MB, cached to `~/.cache/torch`, no download afterward); about 1 minute per song on CPU. **Local machine only** (won't work on the hosted site — the model is too heavy for the browser / Vercel). If the service isn't running, it gracefully falls back to the full backing track.

### B) music.ai (cloud · works on the hosted site)

Hand the `audio_url` to **music.ai** (it accepts an audio URL and can be polled):

- Base: `https://api.music.ai/v1`, auth `Authorization: <raw key>` (**not** `Bearer`)
- Create a job `POST /job`: `{ name, workflow:"<slug>", params:{ inputUrl } }` — get the `workflow` slug by creating a vocal/accompaniment separation workflow in the music.ai dashboard
- Poll `GET /job/{id}` until `status:"SUCCEEDED"`, then read `vocals` / `accompaniments` from `result` (the frontend tolerates common field-name variants)
- Async, about 30–60 seconds; the returned audio URLs are valid for 14 days
- Config: set the `MUSICAI_KEY` environment variable on Vercel (deploys `api/stems.js`), and enter the workflow slug in app settings. **If unset / in demo mode, separation is skipped and play-along uses the full backing track automatically.**

---

## Known boundaries

- Suno doesn't keep the melody you played; it only arranges a backing track to match the key/mood — the melody is faithfully replayed by the lights.
- The teaching melody is always the motif you played yourself (zero transcription error); separation is only used to pull the accompaniment out so it doesn't clash with your play-along.
- Generation is async, roughly tens of seconds to ~1 minute; separation (optional) adds about 30–60 seconds, and is skipped automatically when not configured.
