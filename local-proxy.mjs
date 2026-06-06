// 本地代理 — 解决浏览器 CORS + 不把密钥放前端，供原型联网测试。
// 需要 Node 18+（自带 fetch）。一个进程同时代理 Suno（生成）和 music.ai（分轨）。
//
// 启动：   node local-proxy.mjs sk_live_你的SunoKey
//   分轨： MUSICAI_KEY=你的musicaiKey node local-proxy.mjs sk_live_你的SunoKey
//   或全用环境变量： SUNO_KEY=sk_live_... MUSICAI_KEY=... node local-proxy.mjs
//
// 然后在 App 设置里：连接方式 = 通过代理，请求地址 = http://localhost:8787
// 前端用 ?path=/v0/...（转发到 Suno）或 ?path=/job...（转发到 music.ai）。密钥只在这里拼，绝不进浏览器。

import http from "node:http";

const SUNO_KEY = process.env.SUNO_KEY || process.argv[2];
const MUSICAI_KEY = process.env.MUSICAI_KEY || process.argv[3];
if (!SUNO_KEY) { console.error("缺少 Suno 密钥：node local-proxy.mjs sk_live_xxx"); process.exit(1); }
const PORT = process.env.PORT || 8787;

// 按 path 前缀决定上游：/v0/ → Suno；/job → music.ai
function route(path) {
  if (path.startsWith("/v0/")) return { base: "https://api.suno.com", auth: "Bearer " + SUNO_KEY, ok: true };
  if (path.startsWith("/job")) {
    if (!MUSICAI_KEY) return { err: "MUSICAI_KEY 未设置（分轨需要）" };
    return { base: "https://api.music.ai/v1", auth: MUSICAI_KEY, ok: true }; // music.ai 用裸 key
  }
  return { err: "需要 ?path=/v0/... 或 ?path=/job..." };
}

http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, "http://localhost");
  const path = url.searchParams.get("path") || "";
  const r = route(path);
  if (!r.ok) { res.writeHead(400, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: r.err })); }

  let body = "";
  for await (const chunk of req) body += chunk;

  try {
    const upstream = await fetch(r.base + path, {
      method: req.method,
      headers: { "Authorization": r.auth, "Content-Type": "application/json" },
      body: req.method === "POST" ? (body || "{}") : undefined,
    });
    const text = await upstream.text();
    console.log(req.method, path, "->", upstream.status);
    res.writeHead(upstream.status, { "Content-Type": "application/json" });
    res.end(text);
  } catch (e) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "转发失败: " + String(e) }));
  }
}).listen(PORT, () => {
  console.log("✅ 代理已启动: http://localhost:" + PORT);
  console.log("   Suno 生成: ?path=/v0/...   " + (MUSICAI_KEY ? "music.ai 分轨: ?path=/job..." : "（未设 MUSICAI_KEY，分轨不可用）"));
});
