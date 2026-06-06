// Vercel serverless 代理：藏住 sk_live_ 密钥 + 解决浏览器 CORS。
// 放到项目根目录 /api/suno.js，在 Vercel 环境变量里设 SUNO_KEY=sk_live_xxx。
// 前端把「请求地址」填成你的部署域名(例如 https://你的应用.vercel.app/api/suno)，
// 然后用 ?path=/v0/audio 这样的查询参数指定要转发到的 Suno 路径。
//
// 例：
//   POST  https://你的应用.vercel.app/api/suno?path=/v0/audio        (body 原样转发)
//   GET   https://你的应用.vercel.app/api/suno?path=/v0/audio/<id>
//
// 注意：前端此时【不要】再发 Authorization 头，密钥只在服务端拼。

export default async function handler(req, res) {
  // CORS（浏览器直接访问本代理是允许的）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const key = process.env.SUNO_KEY;
  if (!key) return res.status(500).json({ error: "SUNO_KEY 环境变量未设置" });

  const path = req.query.path;
  if (!path || !path.startsWith("/v0/")) {
    return res.status(400).json({ error: "缺少合法的 ?path=/v0/... 参数" });
  }

  try {
    const upstream = await fetch("https://api.suno.com" + path, {
      method: req.method,
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: req.method === "POST" ? JSON.stringify(req.body || {}) : undefined,
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: "代理转发失败: " + e.message });
  }
}
