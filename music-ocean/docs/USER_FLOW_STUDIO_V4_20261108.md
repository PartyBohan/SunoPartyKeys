# Studio layout review — 2026-11-08

Baseline `c7ba22cb17faaf5f03dc6af96e9c7af58d5bf696`. Only UI structure, style-card artwork, English descriptions and focus management changed. MIDI, provider operations, saved source audio, job polling and card downloads retain their implementations.

## Browser observations

Chrome / macOS. Browser device emulation is not physical phone/tablet or MIDI hardware evidence.

| Flow | Observed result |
| --- | --- |
| Fresh local storage on port 5194 | Chinese default, zero notes, emphasized Record, disabled Next. Separate from returning test storage on 5193 and production origins. |
| Record on port 5193 | Record -> computer A/S/D -> three notes. Next is enabled at the right of the same transport row, beneath the keyboard. |
| Next during recording | Recording ends; step two opens; keyboard focus moves to the style heading; original three notes remain available. |
| Back / refresh / language | Draft remains; English brand is PartyKeys; step state restores after refresh. |
| Five original skin cards | Existing official large perspective-keyboard artwork appears; no generated keyboard or diagonal product-photo overlay remains. |
| 667×375 landscape | Instrument, transport and Next fully visible; five cards and Generate fit; compact editor's connection row stays inside the panel. |
| 375×667 portrait | Vertical layout; recording controls follow keys, then a full-width Next. All controls reachable. |
| 1024×768 landscape | Centered instrument and next action fit. Both refinement regions fit at default website zoom. |
| Native desktop window | One centered instrument surface. The main action belongs to the recorder. No detached right-hand Next column. |

Evidence is in task output folder `outputs/music-ocean-v4/`. Used actual clicks and visible accessibility state; no user interviews, completion-rate figures or latency measurements are claimed.

## Validation / review

TypeScript noEmit, Vite build and portable-server build passed. Node regression suite: 41 passed, zero failed. Existing HTTP artwork check also covers the newly reused official PNG/JPEG card files. Keyboard geometry still has 36 consecutive pitches with exact 2+3 groups. New UI handlers preserve paid-generation idempotency and do not initiate calls merely by changing steps.

Removed obsolete direction labels, the detached Next column and photo-composite card markup. Reused the keyboard renderer, audio controls, scene motion settings, keyboard shortcuts, dialogs and original share/download paths. The two refinement regions use a bounded flex split; the gallery retains a grid. Step headings are the only new focus targets.

Follow-up considerations: physical keyboard/BLE and iOS audio require real hardware testing; narrow portrait keys are dense by design. Enlarged browser text or non-default page zoom is not a guarantee of single-screen fit. No paid generation or Suno download credit was consumed for this UI review. New-user testing is a walkthrough, not a real-user study.
