# Music Ocean: one instrument, one next action

The primary task is to play a short motif, confirm it, then choose its production direction. Homepage hierarchy follows that task rather than a marketing layout.

## Verified open-source design guidance

Queried GitHub repository metadata on 2026-11-08 (stars change over time):

- `anthropics/skills`: 188,996 stars. This is a general skill collection containing `skills/frontend-design`, licensed Apache-2.0. Used the frontend-design guidance at commit `2c5958ecac7cee2b583967a2c4981d0f4a75c579` for subject-specific visual hierarchy, a single memorable element, meaningful labels, and screenshot critique.
- `nextlevelbuilder/ui-ux-pro-max-skill`: 146,646 stars, MIT. Highest result of this query for dedicated UI/UX skill repositories. Used `.claude/skills/ui-ux-pro-max` at commit `4f2dbb67e64969a9a30ab00742f2d55d66ddec2b` for interaction, progressive disclosure, responsive checks, focus and primary-action guidance.

Sources: https://github.com/anthropics/skills/tree/main/skills/frontend-design and https://github.com/nextlevelbuilder/ui-ux-pro-max-skill . Skill copies and licenses are retained in the task workspace under `work/skills/`, rather than bundled into the application.

The UI/UX design-system query `music creation focused instrument` returned Product Demo + Features and Minimalism / Swiss Style. Applied the centered instrument and bottom/right action placement; excluded marketing feature sections because this is the creation tool itself. Targeted CTA queries returned unrelated progress/back rows, so placement decisions use the skill's explicit `primary-action` / `progressive-disclosure` / `keyboard-nav` rules and the actual task flow, not a claimed direct search match.

## Direction

Palette: graphite `#272c32`, slate `#606a74`, paper `#faf9f5`, structural line `#d8dbd8`, recorded-note sage `#6c8c7b`. Saturated color belongs to the instrument lights and the existing skin collection. The small coral record dot carries its familiar recording meaning.

Typography: Apple system / PingFang from the established application font stack, with semibold action labels and modest, single-family headings. Numeric recording time stays monospaced for stable changing digits. No new external font request is needed in China.

Layout:

```
Brand                  1 Record -> 2 Choose a sound             Library / Settings

              Short invitation + scene switch
              +--------------------------------------------------+
              | Record your melody                 Connect device |
              | Saved notes / live recording                       |
              |                                                    |
              |                   36-key instrument                |
              |                                                    |
              | Record / Listen / Reset          Next: choose sound |
              | Keyboard shortcut help                  Try sample |
              +--------------------------------------------------+
```

Left edges of the heading, recorder and instrument align. Next stays in the recorder immediately below the keys, aligned with the transport row. Initially Record is the only emphasized enabled action; after three recorded notes, Next takes emphasis. Second-stage headings receive keyboard focus and the real two-step sequence is visible in the header. Complex choices stay on step two.

## Existing keyboard artwork

Style cards use the exact original images from the official skin library behind https://light.popumusic.cn/ . The original large perspective keyboard, lighting, notes and composition are preserved. No product image is repainted or synthesized. Names and BPM are HTML labels over a frosted band.

The interactive instrument retains the verified PartyKeys 36 pitch geometry, C3–B5, 21 white + 15 black keys. The historical skin illustration is artwork from the existing library, not a device-profile or key-count indicator. Full source URLs, official skin IDs and file hashes are in `STYLE_CARD_LIBRARY_20261108.json`.
