# Two-step music studio review — 2026-11-08

Baseline: `5859a94629bb0cb02a436ce0e027950185babd91`. Scope: homepage hierarchy, five music directions, collectible skin cards, exact PartyKeys 36 keyboard geometry, bilingual branding, read-only Suno usage display. Existing provider jobs, MIDI capture, original WAV, account isolation and public-card MP3 storage remain the existing implementations.

## Actual browser checks

Google Chrome on macOS, local production build. `localhost:5193` supplies a separate fresh storage origin; `127.0.0.1:5193` preserves the returning draft. Neither uses a production database. Existing song fixtures are labeled local UI review and do not generate or purchase music.

| Scenario | Observed result |
| --- | --- |
| Fresh visit, no keyboard | 0 notes; Record visible; Next disabled; on-screen keyboard available. |
| Record with computer A/S/D | 3 captured notes; Next becomes available; Next stops recording and opens step 2. |
| Choose Velvet Offbeat + custom text | Selected check, heading and musical description change; text retained. |
| Back to keys / refresh | Three notes preserved; English preference preserved; returning to step 2 retains style and description. |
| Unconnected service | Generate opens connection settings; saved melody remains; no generation call. |
| Existing completed job from My tracks | Result, versions, A/B and Share appear. Gallery replay uses this job's 18-note original rather than an unrelated 3-note draft. |
| A/B / share modal | Changing to A pauses B; modal opens; generated share image and Save/Share buttons become available. |
| English | PartyKeys header, device connect, keyboard deck, five presets and controls localized. |
| 852×393 and 667×375 landscape | Both steps, keyboard, Next and generation button fit the viewport; page scrolling disabled. |
| 1024×768 tablet landscape | Both steps and complete five-card collection fit; original product image is fully visible above caption. |
| 375×667 portrait | Stacked layout scrolls; Next reachable; no horizontal overflow observed. |
| Desktop native Chrome window | Both steps fit; no empty result section on homepage. |

Evidence outside the source repository: `outputs/music-ocean-style-v3/home-se-landscape.png`, `home-se-portrait.png`, `home-desktop.png`, `styles-ipad-clean.png` and `styles-ipad-landscape.png` in the task workspace. These are browser simulations/native desktop screenshots, not physical iPad or phone tests.

## Fixes and design decisions

- Homepage asks only for a melody and Next. Style, description and vocal format are on step 2. Completed results remain accessible through My tracks.
- Replaced the dark empty panels with the existing little-traveler scene and 8-second motion assets, light surfaces and one clear next action.
- Five rhythmic, immediate-hook presets describe the requested musical traits without requesting an artist's voice. Full 500-character custom directions fit the server's 1000-character prompt boundary.
- Card backgrounds are generated without keyboards. The exact supplied black product PNG is overlaid using CSS; no generated keys are used. Product SHA checks match the supplied files. CSS bounds keep the entire keyboard above the caption at all inspected sizes.
- Interactive key geometry has 36 consecutive pitches C3–B5: 21 white, 15 black, standard repeating 2+3 groups. No device protocol or SysEx output was changed.
- Suno balance requests run only while connected settings are open. Unknown counts remain unknown, rather than showing zero. Subscription and download credits are shown as distinct quantities.

## Validation and code review

TypeScript `--noEmit`, Vite production build and portable server build pass. Node suite: **40 passed, 0 failed** (35 existing + 5 focused studio cases). New cases cover prompt bounds and user text preservation, exact pitch coverage/black-key boundaries, and account envelope/unknown-value handling. Existing cases cover paid-call idempotency, OAuth, durable original input, private libraries, local full MP3/Range/download and card revocation.

Removed the old direction modal and its state/ref. Preserved the verified MIDI parser, velocity, pedal, audio renderer, background motion lifecycle and job polling. Modal opening pauses local audio; full Suno modal removes the inline iframe to avoid duplicate playback. No new tracking or user research data was collected.

Remaining considerations: a 36-key layout is necessarily dense on narrow portrait screens; landscape is the intended playing orientation. No physical keyboard, BLE, iOS Web MIDI or in-WeChat/Xiaohongshu native share was tested in this iteration. No new paid generation/download credit was consumed for UI verification. A complete newly generated song remains a provider integration check, not a visual smoke test.
