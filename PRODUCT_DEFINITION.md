# Shine Up, Notes On · 光音成曲

### Product Definition Document · 产品定义书

**Suno × PartyKeys** — Play one motif, get a full song, and let the lights teach you to play it.
**用 Suno 解开创造音乐的密码** —— 弹一个动机,AI 给它配一支完整乐队,灯光带你把它弹熟。

> Single-file web app · Berklee Hackathon · 2026-06
> 单文件网页应用 · 伯克利黑客松 · 2026 年 6 月

---

## 1. One-liner · 一句话定义

**EN:** A web app for absolute beginners that turns a short played motif into a complete, original song via Suno — then uses PartyKeys LED lights to teach the player to perform it back in real time.

**中文:** 面向零基础初学者的网页应用:在键盘上弹一小段动机,经 Suno 生成一首完整的原创歌曲,再用 PartyKeys 灯光实时教用户把它弹回来。

---

## 2. Vision & Positioning · 愿景与定位

**EN:**
- The magic moment is *"I made this!"* — the surprise of turning a 3-second fragment into a full band arrangement.
- Light-guided teaching is the bonus that makes the magic *repeatable and learnable*, not the headline.
- Positioned for the Berklee Hackathon: a delightful, demoable, zero-friction proof that AI lowers the barrier to *creating* music, not just consuming it.

**中文:**
- 核心魔法时刻是「这居然是我做的!」——把 3 秒的片段变成一支完整乐队的惊喜。
- 灯光教学是让这份惊喜「可重复、可学会」的附赠,不是主打卖点。
- 定位伯克利黑客松:一个好玩、好演示、零门槛的证明——AI 让普通人能「创造」音乐,而不只是消费音乐。

---

## 3. Problem & Target Users · 问题与目标用户

**EN:**
- **Who:** complete beginners who feel music creation is out of reach; people who can *hum* an idea but can't *produce* one.
- **Pain:** the blank-page problem — a DAW, music theory, and an instrument all stand between an idea and a song.
- **Promise:** "Hum a fragment, get a whole song — and learn to play it." Time-to-delight target: under ~100 seconds.

**中文:**
- **谁:** 觉得「创作音乐」遥不可及的纯初学者;能哼出旋律、却做不出成品的人。
- **痛点:** 空白页问题——一个想法和一首歌之间,横着 DAW、乐理和乐器三道墙。
- **承诺:** 「哼一段,得到一整首歌,还顺手学会弹它。」目标惊喜时长:约 100 秒以内。

---

## 4. Core Value Proposition · 核心价值主张

| Pillar · 支柱 | EN | 中文 |
|---|---|---|
| Create · 创造 | Turn a tiny motif into a full arrangement | 把小动机变成完整编曲 |
| Own · 拥有 | The melody taught back is *your own* MIDI — zero transcription error | 教你弹的旋律是你自己弹的 MIDI——零转录误差 |
| Learn · 学会 | Hardware LEDs + on-screen lights guide the performance, scored live | 硬件 LED + 屏幕灯光引导演奏,实时打分 |
| Frictionless · 无门槛 | No install, no theory, no blank text box | 免安装、免乐理、没有空白输入框 |

---

## 5. Core User Flow · 核心用户流程

**EN:** A full-screen 4-step card wizard.
**中文:** 全屏四步卡片向导。

```
   Record motif  →  Tune the prompt  →  Separate stems  →  Play along
   弹动机           调提示词            人声/伴奏分轨        灯光跟弹
   (your MIDI)      (style + mood)      (vocal / backing)   (light-guided)
```

1. **Record · 弹动机** — On a PartyKeys 36 keyboard (or computer keys / on-screen piano), play a short motif. App auto-detects **key** (Krumhansl–Schmuckler lite) and **tempo** (median IOI). 在 PartyKeys 36(或电脑键盘/屏幕钢琴)弹一小段,自动识别调性与速度。
2. **Tune · 调提示词** — Tap-to-pick chips (genre, mood, instruments, tempo feel) compose a clean Suno prompt; beginners never face a blank box. 点选标签生成提示词,初学者不用面对空白框。
3. **Separate · 分轨** — Suno returns one mixed track; split it into **Melody (vocal) + Backing** so the "ahh" vocal doesn't fight the melody being learned. Suno 返回单条混音,拆成「主旋律 + 伴奏」,避免人声和要学的旋律打架。
4. **Play along · 跟弹** — Notes fall toward a judgment line; LEDs pre-light ~0.3 s ahead; combo, progress and an end-of-song accuracy score. 音符下落到判定线,LED 提前约 0.3 秒亮起,有连击、进度和终曲准确率评分。

---

## 6. Feature Scope · 功能范围

**In scope · 范围内**

**EN:**
- MIDI input + LED output for PartyKeys 36 (Web MIDI + SysEx); computer-keyboard and on-screen piano fallbacks.
- Key/tempo detection from the played motif.
- Chip-based prompt builder; Suno generation via serverless proxy.
- Stem separation with three swappable backends (see §8).
- GPU-composited waterfall play-along with **Follow** (waits for you) and **Flow** (continuous) modes.
- Full EN / 中文 bilingual UI.
- Graceful degradation everywhere (demo mode, full-mix fallback).

**中文:**
- PartyKeys 36 的 MIDI 输入 + LED 输出(Web MIDI + SysEx);电脑键盘与屏幕钢琴兜底。
- 从动机识别调性/速度。
- 标签式提示词构建器;经 serverless 代理调 Suno 生成。
- 三个可切换后端的人声/伴奏分轨(见 §8)。
- GPU 合成的瀑布流跟弹,含「跟弹」(等你)和「连弹」(连续)两种模式。
- 全中英双语界面。
- 处处优雅降级(演示模式、整首混音兜底)。

**Out of scope · 范围外**

**EN:** Custom voice cloning, audio upload to Suno, exact-melody round-trip from Suno, multi-user/cloud accounts, DAW-grade editing.
**中文:** 自定义嗓音克隆、向 Suno 上传音频、Suno 精确还原所弹旋律、多用户/云账号、DAW 级编辑。

---

## 7. Key Differentiators · 关键差异点

**EN:**
- **Teach from ground truth, not re-transcription.** The lesson uses the player's own MIDI, so there is zero transcription error — unlike apps that re-detect notes from audio.
- **Hardware light teaching loop.** Real LED keys (not just screen) guide the hands, with ~200 ms latency compensation and ~0.3 s anticipatory pre-light.
- **Generation decoupled from post-processing.** Keep generating on the official Suno API, then hand the audio URL to a separate stem provider — vendors stay swappable.
- **Single-file + serverless.** Zero build step, keys hidden in proxies, trivial to ship.

**中文:**
- **用真值教学,而非重新转录。** 教学用的是用户自己弹的 MIDI,零转录误差——不像从音频里重新识别音符的应用。
- **硬件灯光教学闭环。** 真实 LED 琴键(不只是屏幕)引导双手,补偿约 200ms 延迟、约 0.3 秒提前预亮。
- **生成与后处理解耦。** 继续用官方 Suno API 生成,再把音频 URL 交给独立分轨厂商——供应商可随时替换。
- **单文件 + serverless。** 零构建步骤,密钥藏在代理里,部署极简。

---

## 8. Technical Architecture · 技术架构

**EN:**
- **Single-file `index.html`**, no external dependencies, no build step.
- **Vercel serverless proxies** hide API keys and solve CORS: `api/suno.js` (generation), `api/stems.js` (Music.ai), `api/stems-replicate.js` (Replicate/Demucs).
- **Web MIDI + SysEx** for keyboard input and LED output; **Web Audio API** synth for the on-screen piano.
- **Waterfall** = DOM elements animated by a CSS `transform` keyframe on the GPU compositor; a light 30 ms timer only does bookkeeping (no per-frame canvas redraw).
- **Stem job protocol** (shared by all backends): `POST /job {params:{inputUrl}}` → poll `GET /job/{id}` → `result.vocals` / `result.accompaniments`.

**Stem backends · 分轨后端 (three, one protocol):**

| Backend | EN | 中文 |
|---|---|---|
| **Replicate** (online default) | Cloud Demucs (htdemucs), pay-per-second, key via `REPLICATE_API_TOKEN`; auto-resolves model version | 云端 Demucs,按秒计费,密钥走 `REPLICATE_API_TOKEN`,自动解析版本 |
| **Music.ai** (cloud) | Accepts audio URL, pollable; key via `MUSICAI_KEY`, needs a workflow slug | 接受音频 URL、可轮询;密钥 `MUSICAI_KEY`,需 workflow slug |
| **Demucs** (local default) | Bundled `demucs-server.py`, free, no key, CPU ~1 min; local machine only | 随附 `demucs-server.py`,免费无密钥,CPU 约 1 分钟,仅本机 |

**中文:**
- **单文件 `index.html`**,零外部依赖、零构建。
- **Vercel serverless 代理**藏密钥、解决 CORS:`api/suno.js`(生成)、`api/stems.js`(Music.ai)、`api/stems-replicate.js`(Replicate/Demucs)。
- **Web MIDI + SysEx** 做键盘输入与 LED 输出;**Web Audio API** 合成屏幕钢琴音色。
- **瀑布流** = 用 CSS `transform` 关键帧在 GPU 合成层上动画的 DOM 元素;只用一个 30ms 轻量定时器做记账(不做逐帧 canvas 重绘)。
- **分轨 job 协议**(所有后端共用):`POST /job` → 轮询 `GET /job/{id}` → `result.vocals` / `result.accompaniments`。

---

## 9. Constraints & Boundaries · 约束与边界

**EN:**
- Suno's API has **no stem separation, no audio upload, no custom voice cloning** → teach from the user's own melody + preset voices; do stems via a separate provider.
- Suno doesn't preserve the played melody — it scores key/mood only; the **lights** replay the melody faithfully.
- Generation is async (~tens of seconds); optional stems add ~30–60 s. Online stems need Replicate or Music.ai (local Demucs is too heavy for the browser/Vercel).
- API keys live **only** in environment variables / proxies — never in client code.

**中文:**
- Suno 官方 API **无分轨、无音频上传、无自定义嗓音克隆** → 用用户自己的旋律 + 预设嗓音教学;分轨交给独立厂商。
- Suno 不保留所弹旋律,只按调性/情绪配伴奏;旋律由**灯光**忠实回放。
- 生成异步约几十秒;可选分轨再加约 30–60 秒。线上分轨需 Replicate 或 Music.ai(本地 Demucs 太重,跑不动浏览器/Vercel)。
- API 密钥**只**存在环境变量/代理里——绝不进客户端代码。

---

## 10. Success Metrics · 成功指标

**EN (hackathon-scoped):**
- A spectator with no music background completes the full loop (motif → song → play-along) in a single sitting.
- Time-to-first-song under ~100 seconds on the demo machine.
- The play-along is visibly smooth (GPU waterfall) and the LEDs track the on-screen notes.
- Zero hard failures on stage — every step degrades gracefully if a service is down.

**中文(黑客松范围):**
- 一个没有音乐背景的观众能一次性走完整个闭环(动机→歌→跟弹)。
- 演示机上首曲生成约 100 秒内。
- 跟弹肉眼流畅(GPU 瀑布流),LED 与屏幕音符同步。
- 台上零硬失败——任一服务挂掉都能优雅降级。

---

## 11. Roadmap · 路线图

**EN:**
- End-to-end validation of the Replicate stem path with a real token.
- Pedagogy layer: difficulty tiers, slow-down practice, section looping.
- One-tap **Cover / restyle** of a generated song.
- Save / share a finished song + score.

**中文:**
- 用真 token 端到端验证 Replicate 分轨链路。
- 教学法层:难度分级、减速练习、段落循环。
- 一键**翻唱/变风格**已生成的歌。
- 保存/分享成品歌曲与分数。

---

## 12. Context · 背景

**EN:** An independent product by Bohan (Harvard GSE / PartyKeys 视感科技), built on the proven PartyKeys Arcade stack. Deployed at `suno.partykeys.org` via GitHub → Vercel.

**中文:** Bohan(哈佛 GSE / PartyKeys 视感科技)的独立产品,基于成熟的 PartyKeys Arcade 技术栈。经 GitHub → Vercel 部署在 `suno.partykeys.org`。

---

**Shine Up, Notes On · 光音成曲**
*Play a motif. Get a song. Learn to play it.*
*弹一个动机。得到一首歌。学会弹它。*
