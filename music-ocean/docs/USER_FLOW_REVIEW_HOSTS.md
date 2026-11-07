# 双域名默认语言核验 · 2026-11-07

基线：音乐海洋 V2；本轮保留 MIDI、音源、任务状态机与分享卡逻辑，服务端按 Host 确定首次访问语言，客户端保留手动语言偏好。

- 本地真实 HTTP 请求 Host=suno.partykeys.ai：200，HTML lang=en，首屏 A few notes.，没有中文主标题。
- 中文默认入口：200，HTML lang=zh-CN，首屏“几个音”。
- TypeScript 与生产构建通过。
- suno.partykeys.ai 的 Namecheap CNAME 和两条验证 TXT 已保存，Google DNS-over-HTTPS 已核对；Sites 绑定及证书 active，新入口可到达登录页。
- suno.popumusic.cn 在 Chrome 中仍显示 Cloudflare 拦截，Ray ID a56ceae51897354e。具体命中规则未开放查询。

用户随后指定迁移路线：完整源码先到 GitHub，中文入口由阿里云承载，英文入口使用海外平台。当前目录保存完整可构建的 Sites 版源代码，跨平台后端适配与新主机上线将继续提交。不能将当前 Cloudflare D1/R2 和 Sites 身份依赖当作已迁移完成。
