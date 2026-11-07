# 双域名独立部署验收 · 2026-11-08

基线：应用源码 562fb9d；Vercel 路由修复 f270380。macOS Chrome 实际访问正式域名，配合本地 HTTP / SQLite / 加密与任务回归测试。此报告替代旧 HOSTS 报告中的迁移进度；旧 Sites 仍保留作备份。

## 实际验证

| 场景 | 操作与结果 | 证据 |
| --- | --- | --- |
| 新英文入口 | 新存储会话访问 suno.partykeys.ai，显示 A few notes.；设置为 English，Suno 正常连接 | Chrome 正式站；匿名 providers 200 / ready=true，jobs 200 / [] |
| 中文入口 | 访问 suno.popumusic.cn，显示中文首页与 Suno 已连接 | Chrome 正式站、有效 HTTPS、health 200 |
| 一次真实创作 | 载入 18 音示例，试听后仅提交一次；上传、处理、生成完成，返回两首 90.44 秒作品 | 任务 dffe16d0-ca10-4457-885c-7ba88c32a62e，phase=complete |
| 原句与成品 | 原始 WAV 播放至 10 秒；两个 Suno 官方 iframe 分别加载正确 clip ID，均实际开始播放并显示 1:30 | Chrome 音频播放标记、推进的进度条 |
| 返回与恢复 | 刷新后“我的作品 01”与完成任务仍在；同浏览器认证 GET /api/jobs/{id} 返回两首 complete | 正式任务 JSON |
| 分享 | 作品卡含小视感场景、18 音符图和真实作品二维码；保存 PNG 成功 | 1080×1440 PNG 下载完成 |
| MIDI | 保存原始 MIDI 成功 | 浏览器下载完成，270 字节 |
| 设置 | 中文 / English、背景开关、Suno / Other API 均可访问；其他 API 的 key 使用密码输入框；最后恢复 Suno | Chrome 设置表单 |
| 背景资源 | 两域名循环 MP4 均返回 Range 206、video/mp4；沿用已验证的三条 8 秒静音循环 | 实际 HTTP 请求与 V2 媒体记录 |

正式成品：

- https://suno.com/song/be8405b6-d914-4956-be9a-6ff9902a8769
- https://suno.com/song/7c8a3258-493c-4324-b996-b7a7bd5d61b2

## 修复与测试

- Suno 当前 account-me 仅返回公开 profile，没有稳定用户 ID。OAuth 不再把缺少该 ID 当作失败；作品历史仍按签名浏览器身份隔离，不以可修改的 handle 合并用户。
- Vercel 的 providers/jobs 精确路由移到通配路由之前，避免根 API 被转发为带斜杠子路径。正式英文 providers、jobs 已恢复 200，连接回调成功。
- 修复 Vercel 原生 ESM 导入路径，固定 Node 24 构建；阿里云现有官方 Node 22.23.2 运行 portable bundle，并显式启用 sqlite。
- 阿里云直连 Suno 超时，改用指定目标、签名及短时效校验的海外请求桥。私钥留在阿里云，Vercel 只保存公开验签 key；没有开放任意代理。
- TypeScript、Web / Node 生产构建通过；26 项自动化测试通过，覆盖真实 HTTP、SQLite、原始 WAV Range、浏览器隔离、伪造身份头、OAuth profile 格式、任务并发领取与幂等、子作品保留、签名校验及私网目的地拒绝。
- 保留媒体/硬件边界和已有状态机，未为托管迁移重写钢琴、MIDI 或布局。路由顺序变更用正式 HTTP 与 Chrome 再验，文档变更不重复付费创作。

## 边界与后续建议

- 本轮不包含实体音乐密码、USB MIDI、BLE MIDI 或实体 iPad 验收。前一轮屏幕琴键、隔离存储和响应式检查属于浏览器模拟证据。
- 两域名的浏览器身份和作品历史分别保存；Suno 账户里的歌曲仍在 Suno 曲库。旧 Sites 的 D1/R2 私人记录未迁移，不宣称跨域历史同步。
- 未配置另一家真实音乐 API，因此只验证其表单、协议与错误/幂等测试，不宣称所有供应商可直接兼容。
- 用户开始连接实琴时应检查设备名、音高、力度、踏板及断线恢复；以实际键盘数据补齐验收。
- 用户跨域后找不到旧任务时会犹豫；下一轮可增加明确的本浏览器历史说明，或设计可验证的账户迁移机制。
- Suno 官方播放器仍依赖访问 Suno 的网络；上线成功不等于所有网络环境下的第三方播放保证。

本轮没有收集真人访谈、用户满意度或转化率，也没有声称同步对齐的 A/B。
