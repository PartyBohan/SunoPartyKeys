# Shine Up, Notes On · 光音成曲 — Iteration Log / 迭代文档

> **EN** — Play one motif → AI gives it a full band → lights teach you to play it back.
> **中文** — 弹一个动机 → AI 给它配一整支乐队 → 灯光带你把它弹熟。
>
> Single‑file web app (`index.html`, zero external deps) · Suno API × PartyKeys · Berklee Hackathon 2026.
> 单文件网页 App（`index.html`，零外部依赖）· Suno API × PartyKeys · 伯克利黑客松 2026。

This document is bilingual — **English first, then 中文** — and records what each version delivered.
本文双语，**英文在前、中文在后**，逐版本记录每次迭代做了什么。

---

## Core loop / 核心闭环

```
Record motif → Tune the prompt → Separate stems → Play along
  弹动机        调歌(选风格)       分轨(人声/伴奏)     灯光跟弹
```

**EN** — The teaching melody is the user's **own MIDI** (zero transcription error); Suno only writes the accompaniment. Everything degrades gracefully: if a service is missing, fall back, never block.
**中文** — 教学旋律 = 用户**自己弹的 MIDI**（零转录误差），Suno 只配伴奏。全程优雅降级：服务缺失就回退，绝不卡死。

---

## v0 — MVP: 3‑step wizard / 三步向导

**EN** — First shippable shape: **Record → Tune → Play‑along**, a full‑screen card wizard with a step indicator and a gear‑icon settings modal. Page 1 is a centered 36‑key piano with a particle "orb" cursor that follows played notes.
**中文** — 第一个可演示形态：**录动机 → 调歌 → 跟弹**。全屏卡片式向导，带步骤指示器和齿轮设置弹窗。第 1 页是居中的 36 键钢琴，弹音时有粒子"光球"光标跟随。

## v1 — Visual & UX identity / 视觉与体验

**EN** — Vibrant blue→purple→orange gradient theme, glassmorphism cards, animated particle background. Full **EN / 中文 bilingual i18n** (`data-i18n` driven). Smart MIDI detection: shows PartyKeys when connected, hides competitor device names.
**中文** — 蓝→紫→橙渐变主题、毛玻璃卡片、动态粒子背景。完整 **中英双语 i18n**（`data-i18n` 驱动）。智能 MIDI 检测：连上 PartyKeys 才显示，隐藏竞品设备名。

## v2 — Prompt builder / 提示词构建器

**EN** — Page 2 turns prompt‑writing into **tap‑to‑pick chips** (genre, mood, instruments, tempo feel) so beginners never face a blank text box. Chips compose into a clean Suno prompt; the motif's detected key & tempo are folded in automatically.
**中文** — 第 2 页把写提示词变成**点选标签**（曲风、情绪、乐器、速度感），初学者不用面对空白输入框。标签在底层拼成干净的 Suno 提示词；动机识别出的调性/速度自动带入。

## v3 — Stem separation, Path B / 分轨（Path B 反转）

**EN** — Problem: Suno returns **one mixed track**; the "ahh" vocal fights the melody the user is learning. We had rejected stems (thought it required migrating the whole generation pipeline). **Reversed the decision (Path B):** keep generating on the official Suno API, then hand the returned `audio_url` to a **separate** stem provider. New **Step 3** splits the song into **Melody + Background Music**.
**中文** — 问题：Suno 只返回**一条混合轨**，"啊啊啊"人声会和用户要学的旋律打架。先前因"必须整体迁移生成管线"而拒绝分轨。**反转决定（Path B）：** 继续用官方 Suno API 生成，再把返回的 `audio_url` 交给**独立**分轨厂商。新增**第 3 步**，把歌拆成**旋律 + 背景音乐**。

## v3b — Two stem backends / 两套分轨后端

**EN** —
- **A) Demucs (local, open‑source, free)** — hackathon default. Bundled `demucs-server.py` runs Facebook's Demucs locally; no key, fully offline. Heavy PyTorch model → local machine only.
- **B) Music.ai (cloud)** — works online. Accepts an audio URL, pollable; key hidden via `api/stems.js` proxy.
- Both speak **the same job protocol** (`POST /job` → poll `GET /job/{id}` → `result.vocals` / `result.accompaniments`), so the frontend needs only one extra branch. No backend → degrade to the full mix as backing.

**中文** —
- **A) Demucs 本地（开源·免费）** — 黑客松首选。随附 `demucs-server.py` 在本机跑 Facebook 的 Demucs；无密钥、纯离线。PyTorch 模型很重 → 只能本机跑。
- **B) Music.ai（云端）** — 线上可用。接受音频 URL、可轮询；密钥经 `api/stems.js` 代理隐藏。
- 两者讲**同一套 job 协议**（`POST /job` → 轮询 `GET /job/{id}` → `result.vocals` / `result.accompaniments`），前端只多一个分支。没后端 → 降级用整首伴奏。

## v4 — 4‑step restructure + stem mixer / 四步重排 + 分轨混音器

**EN** — Inserted the stem page and re‑indexed the wizard to **4 pages**: **Record → Tune → Separate → Play‑along**. Added a **stem mixer UI** with independent Melody / Background tracks and mute toggles. Settings let the user choose the stem backend and enter a Music.ai workflow slug.
**中文** — 插入分轨页，向导重排为**4 页**：**录动机 → 调歌 → 分轨 → 跟弹**。新增**分轨混音器**，旋律/背景两条独立轨道各带静音键。设置里可选分轨后端、填 Music.ai workflow slug。

## v5 — Vocal → MIDI melody / 人声转旋律

**EN** — Convert the **separated vocal** into a clean **monophonic** note sequence (pitch + duration). Pipeline: decode → downsample to ~8 kHz → **autocorrelation** pitch detection → octave‑down protection → parabolic interpolation → adaptive RMS gate → median filter → run‑length encode → merge. The waterfall play‑along is built from *this* melody; the background music plays in sync.
**中文** — 把**分离出的人声**转成干净的**单声部**音符序列（音高 + 时值）。流程：解码 → 降采样到约 8 kHz → **自相关**测音高 → 防降八度 → 抛物线插值 → 自适应 RMS 门限 → 中值滤波 → 游程编码 → 合并。瀑布流跟弹就用*这条*旋律，背景音乐同步播放。

## v5b — Detection fixes / 检测修正

**EN** — Symptom: dozens of spurious notes (a real melody is < ~20, slow, no overlap). Fixes: over‑segmentation → median filter + run‑length encoding + minimum‑duration culling + same‑pitch merging; a **+1 semitone bias** → the octave guard now requires a true **local maximum**. Verified: synthetic input detected **8/8 notes exactly**.
**中文** — 症状：冒出几十个假音符（真旋律应 < 约 20 个、慢、不重叠）。修正：过度切分 → 中值滤波 + 游程编码 + 最短时长剔除 + 同音合并；**+1 半音偏差** → 八度保护改为要求真正的**局部极大值**。验证：合成输入精确检出 **8/8 个音**。

## v6 — Light‑guided waterfall / 灯光瀑布流

**EN** — Notes fall toward a judgment line above the on‑screen keyboard. Self‑paced clock and hit window tuned for beginners. Combo, progress, and an end‑of‑song accuracy score. Misses/hits/timing feed back through both the screen and the hardware LEDs.
**中文** — 音符朝屏幕键盘上方的判定线下落。自定速时钟与命中窗口为初学者调校。连击、进度、收尾准确率打分。漏/中/时机同时反馈到屏幕和硬件 LED。

## v6b — Performance rewrite (GPU) / 性能重写（GPU）

**EN** — Symptom: choppy, frame‑by‑frame waterfall. Final rewrite dropped per‑frame canvas drawing entirely: each falling note is a **DOM element animated by a CSS `transform` keyframe** → runs on the **GPU compositor**, smooth even under main‑thread load. A lightweight **30 ms timer** does only bookkeeping (lights, miss, finish). Hit detection and visuals share one wall clock → always aligned.
**中文** — 症状：瀑布流卡顿、逐帧。最终重写彻底抛弃逐帧 canvas 绘制：每个下落音符是一个**用 CSS `transform` 关键帧动画的 DOM 元素** → 跑在 **GPU 合成层**，主线程繁忙也流畅。只留一个轻量 **30ms 定时器**做记账（灯光/漏弹/收尾）。判定与画面共用同一壁钟 → 永远对齐。

## v7 — Anticipation & feedback / 预亮与反馈

**EN** — Pre‑light lookahead: keys light up **~0.3 s before** the note reaches the line so beginners can prepare. The on‑screen key glows the instant the note lands, in sync with the hardware LED. Two‑tier glow (dim pre‑light → bright at the line). Hit feedback via GPU‑animated burst particles.
**中文** — 预亮提前量：音符到线**前约 0.3 秒**琴键就亮，初学者好准备。音符落到线的瞬间屏幕琴键发光，与硬件 LED 同步。两级辉光（暗预亮 → 到线变亮）。命中反馈用 GPU 动画爆裂粒子。

## v8 — Layout polish / 布局打磨

**EN** — Cards widened to fill the screen (removed big side gutters). Final‑page keyboard fills the full width — no black bars. Waterfall enlarged: taller field, bigger glowing notes and labels. Responsive key sizing; black keys reposition on resize / page entry.
**中文** — 卡片加宽填满屏幕（去掉两侧大留白）。末页键盘占满整宽——没有黑边。瀑布流加大：场地更高、音符与标签更大更亮。键宽响应式；黑键在窗口变化/进页时重新定位。

---

## v9 — Generate button + SUNO racetrack glow / 生成按钮 + SUNO 跑道光

**EN** — Centered the primary action on the Tune page and relabeled it **"SUNO – Generate!"**. On click a **racetrack‑style running light hugs the pill outline** (a masked rotating conic gradient — it sits *on* the button, no flying particles). The glow's lifecycle is tied to playback: it follows the generated song and stops only when playback pauses/ends.
**中文** — 把调歌页的主操作按钮居中，改名 **"SUNO – Generate!"**。点击后一道**跑道式跑马灯紧贴药丸轮廓**（用遮罩的旋转锥形渐变，光*坐在*按钮上、不外冲、无飞出粒子）。辉光生命周期绑定播放：跟着生成的歌走，只在暂停/结束时才停。

## v10 — Play‑along upgrades / 跟弹升级

**EN** —
- **Removed the "hanging circles"** above and below the waterfall (queued/finished notes that used to peek out): notes use `animation-fill-mode: both`, hit notes fade to `opacity:0`.
- **Follow (wait) mode:** if you play the wrong note, the field freezes and the music pauses until you play the correct (current) note, then resumes — timing stays aligned by subtracting accumulated pause time.
- **Celebration:** bigger, multi‑color fireworks across the whole field plus a large **"Congratulations!"** with accuracy & best combo.

**中文** —
- **移除瀑布流上下"挂着的小圆"**（排队/已命中音符露出的半截）：音符用 `animation-fill-mode: both`，命中音符淡出到 `opacity:0`。
- **跟弹（等待）模式：** 弹错时画面冻结、音乐暂停，直到你弹对当前的音再继续——靠扣除累计暂停时间保持时序对齐。
- **庆祝：** 更大、多色、撒满全场的礼花，加一行大字 **"Congratulations!"**，附准确率与最高连击。

## v11 — Follow/Flow toggle + smoother melody / 跟弹·连弹切换 + 旋律更顺

**EN** —
- **Mode toggle** on the final page: **Follow (跟弹)** waits for the correct note; **Flow (连弹)** plays the backing continuously, missed notes fade and cost accuracy, never pausing.
- **Octave smoothing** (`smoothOctaves`): each detected note keeps its pitch‑class but snaps to the octave nearest the previous note, killing sudden octave jumps in the waterfall.
- **Close‑note thinning** (`thinNotes`): if two notes start within ~0.24 s, keep only the first so the player isn't forced into a rushed double‑tap.

**中文** —
- 末页新增**模式切换**：**跟弹**等你弹对才走；**连弹**背景音乐不停、漏弹淡出并扣准确率、绝不暂停。
- **八度平滑**（`smoothOctaves`）：每个音保持音名，但八度移到离上一个音最近的位置，消除瀑布流里突兀的高八度跳变。
- **近音稀释**（`thinNotes`）：相邻两音起始相隔不足约 0.24 秒时只保留前一个，免得逼用户仓促连点两键。

## v12 — Stem‑wait preview playback / 分轨等待试听

**EN** — While stem separation is running (tens of seconds), the just‑generated full song now **loops as a preview** (fades in to ~0.85). When separation finishes (or fails/falls back), it **quickly fades out** and stops. Leaving the page hard‑stops it. Only triggers when real separation runs (demo / no‑song / missing‑config paths stay silent).
**中文** — 分轨进行时（几十秒），刚生成的整曲现在会**循环试听**（淡入到约 0.85）。分轨完成（或失败/降级）时**快速渐弱**收尾。离开页面立即停。只在真分轨运行时触发（演示 / 没歌 / 未配置路径保持静音）。

## v13 — Rebrand & header / 改名与页头

**EN** — Renamed the product. English **"Shine Up, Notes On"** — the initials **S/U/N/O are bold**, spelling SUNO; subtitle *"When PartyKeys meets Suno, play your original songs in 100 seconds."* Chinese **"光音成曲"**; subtitle *"用 Suno 解开创造音乐的密码。"* Enlarged the main title and moved the subtitle onto its own line beneath it. Recentered the "Congratulations!" block into the upper‑middle of the field so it no longer reads as bottom‑heavy.
**中文** — 产品改名。英文 **"Shine Up, Notes On"**——首字母 **S/U/N/O 加粗**，藏头拼出 SUNO；副标题 *"When PartyKeys meets Suno, play your original songs in 100 seconds."* 中文 **"光音成曲"**；副标题 *"用 Suno 解开创造音乐的密码。"* 主标题加大、副标题移到其正下方独立一行。把 "Congratulations!" 上移到场地中上部，不再显得偏下。

---

## Known boundaries / 已知边界

**EN** — Suno doesn't preserve the played melody (it scores key/mood only) — the **lights** replay your melody faithfully. Online stem separation needs Music.ai or a hosted Demucs (the bundled local Demucs is too heavy for the browser/Vercel). Generation is async (~tens of seconds); optional stems add ~30–60 s. API keys live **only** in environment variables / proxies, never in client code.
**中文** — Suno 不保留你弹的旋律（只按调性/情绪配伴奏）——旋律由**灯光**忠实回放。线上分轨需要 Music.ai 或托管版 Demucs（随附的本地 Demucs 太重，跑不动浏览器/Vercel）。生成是异步的（约几十秒）；可选分轨再加约 30–60 秒。API 密钥**只**存在环境变量 / 代理里，绝不进客户端代码。
