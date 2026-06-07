---
marp: true
title: "Motif Song — Product Iteration Log"
paginate: true
theme: default
---

<!--
This file is slide-paginated for PowerPoint.
Each "---" starts a new slide. Render with Marp (VS Code "Marp for VS Code"
or `marp PRODUCT_ITERATION.md --pptx`) to export a .pptx directly.
-->

# Motif Song · 动机即歌

### Suno × PartyKeys — Product Iteration Log

**Play one motif → AI gives it a full band → lights teach you to play it.**

Single-file web app · Berklee Hackathon · 2026-06

---

# The Concept

- A web app for **absolute beginners**.
- On a **PartyKeys 36** keyboard (or computer keys / on-screen piano), play a short **motif**.
- The app detects **key & tempo**, asks **Suno** to generate a full song with wordless "ahh" vocals.
- **PartyKeys LEDs** then guide you to play the melody back, scored in real time.
- The teaching melody is **your own MIDI** — zero transcription error. Suno only writes the accompaniment.

---

# Problem & Audience

- **Who:** complete beginners who feel music creation is out of reach.
- **Insight:** people can *hum* an idea but can't *produce* one.
- **Promise:** "Hum a fragment, get a whole song — and learn to play it."
- The surprise ("I made this!") is the hook; the light-guided lesson is the bonus.
- **Constraint that shaped everything:** Suno's API has no stem separation, no audio upload, no custom voice cloning → teach from the user's own melody + 3 preset voices.

---

# Technical Foundation (inherited)

- Built on the **PartyKeys Arcade** stack — proven and zero-friction.
- **Single-file HTML**, no external dependencies, no build step.
- **Vercel serverless proxies** hide API keys and solve CORS.
- **Web MIDI + SysEx** for keyboard input and LED output.
- **Web Audio API** synth for the on-screen piano.
- Graceful degradation everywhere: if a service is missing, fall back, never block.

---

# The Core Loop

```
   Record motif  →  Tune the prompt  →  Separate stems  →  Play along
   (your MIDI)       (style + mood)      (vocal/backing)    (light-guided)
```

- Generation is async (~tens of seconds); UI keeps the user engaged while waiting.
- LED hardware latency (~200 ms) is compensated for in timing.
- Every step degrades gracefully to a built-in demo if APIs are unavailable.

---

# Phase 0 — MVP: 3-Step Wizard

- First shippable shape: **Record → Tune → Play-along**.
- Full-screen **card wizard** with a step indicator and a gear-icon settings modal.
- Page 1: centered 36-key piano with a particle "orb" cursor following played notes.
- Goal: prove the end-to-end loop for a hackathon demo.

---

# Phase 1 — Visual & UX Identity

- **Vibrant blue → purple → orange** gradient theme.
- Glassmorphism cards, animated particle background.
- Full **EN / 中文 bilingual** i18n system (`data-i18n` driven).
- Smart MIDI detection: shows PartyKeys when connected, hides competitor device names.

---

# Phase 2 — Prompt Builder

- Page 2 turns prompt-writing into **tap-to-pick chips** (genre, mood, instruments, tempo feel).
- Beginners never face a blank text box.
- Chips compose into a clean Suno prompt under the hood.
- Detected key & tempo from the motif are folded into the request automatically.

---

# Phase 3 — Stem Separation: The Decision

- Problem: Suno returns **one mixed track**; the "ahh" vocal fights the melody the user is learning.
- Earlier we **rejected** stems (believed it required migrating the whole generation pipeline).
- **Reversed the decision (Path B):** keep generating on the official Suno API, then hand the returned `audio_url` to a **separate** stem provider.
- Result: a new **Step 3** that splits the song into **Melody + Background Music**.

---

# Phase 3b — Two Stem Backends

- **A) Demucs (local, open-source, free)** — hackathon default.
  - Bundled `demucs-server.py` runs Facebook's Demucs locally; no key, fully offline.
  - Heavy PyTorch model → can't run in the browser/serverless; local machine only.
- **B) Music.ai (cloud)** — works online.
  - Accepts an audio URL, pollable; key hidden via `api/stems.js` proxy.
- Both speak **the same job protocol**, so the frontend needs only one extra branch.
- No backend configured → degrade to using the full mix as backing.

---

# Phase 4 — Restructure to 4 Steps

- Inserted the stem page and re-indexed the wizard to **4 pages**.
- New flow: **Record → Tune → Separate → Play along**.
- Added a **stem mixer UI** with independent tracks and mute toggles.
- Settings let the user choose the stem backend and enter a Music.ai workflow slug.

---

# Phase 5 — Vocal → MIDI Melody

- Convert the **separated vocal** into a clean **monophonic** note sequence (with durations).
- Pipeline: decode → downsample to ~8 kHz → **autocorrelation** pitch detection → octave-down protection → parabolic interpolation → adaptive RMS gate → median filter → run-length encode → merge.
- The waterfall play-along is built from *this* melody; the background music plays in sync.
- User plays the extracted notes as the lead — no "ahh" vocal competing.

---

# Phase 5b — Fixing the Detection

- **Symptom:** dozens of spurious notes; a real melody should be **< ~20**, slow, no overlap.
- **Root causes found & fixed:**
  - Over-segmentation → median filter + run-length encoding + minimum-duration culling + same-pitch merging.
  - A **+1 semitone bias** → the octave guard was grabbing a rising slope; required a true **local maximum**.
- **Verified:** synthetic test input detected **8/8 notes exactly**.

---

# Phase 6 — Light-Guided Waterfall

- Notes fall toward a judgment line above the on-screen keyboard.
- Self-paced: clock and hit-window tuned for beginners.
- Combo, progress, and an end-of-song accuracy score.
- Misses, hits, and timing all feed back through both the screen and the hardware LEDs.

---

# Phase 6b — Performance Rewrite (the big one)

- **Symptom:** waterfall was choppy / frame-by-frame.
- **First pass:** pre-rendered sprites + cached layout (helped, not enough).
- **Final rewrite:** dropped per-frame canvas drawing entirely.
  - Each falling note is a **DOM element animated by a CSS `transform` keyframe** → runs on the **GPU compositor**, smooth even under main-thread load.
  - Only a lightweight **30 ms timer** does bookkeeping (lights, miss, finish) — zero drawing.
- Hit detection and visuals share one wall clock → always aligned.

---

# Phase 7 — Anticipation & Feedback

- **Pre-light lookahead:** keys light up **~0.3 s before** the note reaches the line, so beginners can prepare.
- **On-screen keyboard lights too:** the corresponding white/black key glows the instant the note lands — in sync with the hardware LED.
- Two-tier glow: dim pre-light → bright at the judgment line.
- Hit feedback via GPU-animated burst particles (no per-frame cost).

---

# Phase 8 — Layout Polish

- Cards widened to fill the screen — removed the large left/right gutters.
- Final-page keyboard now **fills the full width** — no black bars on the sides.
- Waterfall enlarged: taller field, bigger glowing notes and labels.
- Keyboard key sizing is responsive; black keys reposition on resize / page entry.

---

# Key Technical Learnings

- **GPU-composited CSS animation beats canvas redraw** for many moving objects.
- **Teach from ground truth** (the user's own MIDI), not from re-transcribing AI output.
- **Decouple generation from post-processing** — the Path B reversal unlocked stems without changing vendors.
- **Always degrade gracefully** — demo mode, full-mix fallback, perf-clock fallback.
- A **single-file app + serverless proxy** keeps keys safe and shipping trivial.

---

# Known Boundaries

- Suno doesn't preserve the played melody — it scores key/mood only; the **lights** replay the melody faithfully.
- Online stem separation needs Music.ai (Demucs is local-only, too heavy for the browser/Vercel).
- Generation is async (~tens of seconds); optional stems add ~30–60 s.
- API keys live **only** in environment variables / proxies — never in client code.

---

# Roadmap

- End-to-end validation with a real Demucs vocal stem (so far synthetic + logic-verified).
- Pedagogy layer: difficulty tiers, slow-down practice, section looping.
- One-tap **Cover / restyle** of a generated song.
- Hosted stem option (e.g., Replicate) so separation works online without local setup.

---

# Thank You

**Motif Song · 动机即歌**

*Play a motif. Get a song. Learn to play it.*

Suno × PartyKeys
