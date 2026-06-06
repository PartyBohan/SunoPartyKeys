// Vercel serverless 代理：藏住 music.ai 密钥 + 解决浏览器 CORS（用于第 3 步「人声/伴奏分轨」）。
// 放到项目根目录 /api/stems.js，在 Vercel 环境变量里设 MUSICAI_KEY=你的 music.ai key。
// 前端「请求地址」填 https://你的应用.vercel.app/api/suno；分轨会自动改用同源的 /api/stems。
//
// 例：
//   POST  /api/stems?path=/job          (创建分轨任务，body 原样转发)
//   GET   /api/stems?path=/job/<id>     (轮询任务状态)
//
// 注意：music.ai 的鉴权头是裸 key（不是 "Bearer xxx"）。前端【不要】再发 Authorization 头。

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const key = process.env.MUSICAI_KEY;
  if (!key) return res.status(500).json({ error: "MUSICAI_KEY 环境变量未设置" });

  const path = req.query.path;
  if (!path || !path.startsWith("/job")) {
    return res.status(400).json({ error: "缺少合法的 ?path=/job... 参数" });
  }

  try {
    const upstream = await fetch("https://api.music.ai/v1" + path, {
      method: req.method,
      headers: { "Authorization": key, "Content-Type": "application/json" },
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
