// 本地 Suno 代理 — 解决浏览器 CORS + 不把密钥放前端，供原型联网测试。
// 需要 Node 18+（自带 fetch）。
//
// 启动：   node local-proxy.mjs sk_live_你的key
//   或：   SUNO_KEY=sk_live_你的key node local-proxy.mjs
//
// 然后在 motif_to_song.html 里：
//   连接方式 = 通过代理
//   请求地址 = http://localhost:8787
//
// 前端用 ?path=/v0/... 指定要转发到的 Suno 路径，密钥只在这里拼，绝不进浏览器。

import http from "node:http";

const KEY = process.env.SUNO_KEY || process.argv[2];
if (!KEY) { console.error("缺少密钥：node local-proxy.mjs sk_live_xxx"); process.exit(1); }
const PORT = process.env.PORT || 8787;

http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, "http://localhost");
  const path = url.searchParams.get("path");
  if (!path || !path.startsWith("/v0/")) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "需要 ?path=/v0/... 参数" }));
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  try {
    const upstream = await fetch("https://api.suno.com" + path, {
      method: req.method,
      headers: { "Authorization": "Bearer " + KEY, "Content-Type": "application/json" },
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
  console.log("✅ Suno 代理已启动: http://localhost:" + PORT);
  console.log("   原型「请求地址」填上面这个，连接方式选「通过代理」。");
});
