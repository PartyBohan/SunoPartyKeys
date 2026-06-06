# 动机即歌 · Motif Song

> Suno × PartyKeys — 弹一个动机，AI 给它配一支完整乐队，灯光带你把它弹熟。

面向零基础初学者的网页 App：在 PartyKeys 36（或电脑键盘/屏幕钢琴）上弹一小段动机 → 自动识别调性/速度 → 调 Suno 生成一首带「啊啊啊」人声的歌 → PartyKeys 灯光带你跟弹，实时打分。教学旋律用的是你自己弹的 MIDI（零转录、零误差），Suno 只负责配伴奏。

---

## 目录结构

```
motif-song/
├── index.html        # 整个 App（单文件，零外部依赖）
├── api/
│   └── suno.js       # Vercel serverless 代理（藏密钥 + 解决 CORS）
├── local-proxy.mjs   # 本地开发用代理（同样作用，Node 18+）
├── package.json
├── .env.example
└── .gitignore
```

---

## 部署到 Vercel（推荐）

1. 把这个文件夹推到一个新的 GitHub 仓库。
2. 在 Vercel 新建项目，导入该仓库，**Root Directory 留空**（项目就在根目录）。零配置即可：`index.html` 作为静态页，`api/suno.js` 自动成为函数。
3. 在 Vercel 项目 **Settings → Environment Variables** 加一条：
   - `SUNO_KEY` = 你的 `sk_live_...` 密钥（从 platform.suno.com 获取）
4. 部署。打开站点后，App 会自动把请求地址设成同源的 `/api/suno`，无需手动改。

> 密钥只存在 Vercel 环境变量里，永远不会进入浏览器。

---

## 本地开发

不联网也能玩（内置伴奏演示）：直接双击 `index.html` 即可，连接方式会自动设为「内置伴奏演示」。

要本地真打通 Suno：

```bash
# Node 18+（自带 fetch）
node local-proxy.mjs sk_live_你的key
# 代理跑在 http://localhost:8787
```

然后用本地服务器打开页面（避免 file:// 的限制），例如：

```bash
npx serve .        # 或任何静态服务器，访问 http://localhost:3000
```

页面在 localhost 下会自动把请求地址设为 `http://localhost:8787`、连接方式设为「通过代理」。

---

## PartyKeys 灯光

App 内置两套灯光协议，设置区有「💡 测试灯光」按钮：

- **Classic CMD 0x71**（默认）— 颜色 ID + 真实 MIDI 音符号，与现役游戏一致，最稳。
- **RGB CMD 0x15** — 24-bit RGB + 键索引（protocol.partykeys.org 新协议）。

连上 PartyKeys 点「测试灯光」，没亮就切到另一套再点，即可锁定你固件支持的协议。
浏览器需 Chrome / Edge（Web MIDI + SysEx）。注意硬件 LED 延迟约 200ms。

---

## Suno API 速查（Berklee Hackathon）

- Base：`https://api.suno.com/`，鉴权 `Authorization: Bearer sk_live_...`
- 生成 `POST /v0/audio`：Simple(`description`) / Custom(`lyrics`+`style`，`instrumental:true` 出纯伴奏)
- 翻唱 `POST /v0/audio/{id}/covers`、混搭 `POST /v0/audio/{id}/mashups`
- 轮询 `GET /v0/audio/{id}` 直到 `status:"complete"`，取 `audio_url`
- 用量 `GET /v0/account/usage`；限速 10 req/s
- ❌ 无音频上传、无分轨、无自定义嗓音克隆（用 3 个预设 voice_id）

---

## 已知边界

- Suno 不保留你弹的旋律，只按调性/情绪配伴奏；旋律由灯光忠实回放。
- 无分轨接口 → 不教「AI 编的整首键盘部分」，只教你自己的动机。
- 生成异步，约几十秒~1 分钟。
