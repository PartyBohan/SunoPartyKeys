// Vercel serverless 代理：用 Replicate 上的 Demucs 做「人声/伴奏分轨」，藏住 REPLICATE_API_TOKEN + 解决 CORS。
// 放在项目根目录 /api/stems-replicate.js，在 Vercel 环境变量里设 REPLICATE_API_TOKEN=r8_...。
// 前端「分轨后端」选 Replicate 时，会同源调用本代理，沿用和 music.ai/Demucs 一样的 job 协议：
//   POST  /api/stems-replicate?path=/job        body: { params:{ inputUrl } }  -> { id }
//   GET   /api/stems-replicate?path=/job/<id>   -> { status, result:{ vocals, accompaniments } }
//
// 跑的是社区模型 cjwbw/demucs（和本地 demucs-server.py 同一个 htdemucs）。stem="vocals" 时
// 输出 vocals(人声) + other(其余相加=伴奏)，这里把 other 归一化成前端认识的 accompaniments。
// 版本号自动解析（取该模型 latest_version），所以无需手动填 hash；也可用 REPLICATE_DEMUCS_VERSION 覆盖。

const MODEL = process.env.REPLICATE_DEMUCS_MODEL || "cjwbw/demucs";
const RB = "https://api.replicate.com/v1";

async function resolveVersion(headers) {
  if (process.env.REPLICATE_DEMUCS_VERSION) return process.env.REPLICATE_DEMUCS_VERSION;
  const r = await fetch(`${RB}/models/${MODEL}`, { headers });
  if (!r.ok) throw new Error(`无法解析模型版本 (HTTP ${r.status})`);
  const j = await r.json();
  const v = j.latest_version && j.latest_version.id;
  if (!v) throw new Error("模型没有可用版本");
  return v;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return res.status(500).json({ error: "REPLICATE_API_TOKEN 环境变量未设置" });
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const path = req.query.path;
  if (!path || !path.startsWith("/job")) {
    return res.status(400).json({ error: "缺少合法的 ?path=/job... 参数" });
  }

  try {
    // 创建任务：POST /job
    if (req.method === "POST") {
      const url = req.body && req.body.params && req.body.params.inputUrl;
      if (!url) return res.status(400).json({ error: "缺少 params.inputUrl" });
      const version = await resolveVersion(headers);
      const up = await fetch(`${RB}/predictions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          version,
          input: { audio: url, stem: "vocals", output_format: "mp3" },
        }),
      });
      const j = await up.json();
      if (!up.ok) return res.status(up.status).json({ error: (j && (j.detail || j.title)) || `HTTP ${up.status}` });
      return res.status(200).json({ id: j.id });
    }

    // 轮询任务：GET /job/<id>
    const id = path.slice("/job/".length);
    if (!id) return res.status(400).json({ error: "缺少 job id" });
    const up = await fetch(`${RB}/predictions/${encodeURIComponent(id)}`, { headers });
    const j = await up.json();
    if (!up.ok) return res.status(up.status).json({ error: (j && (j.detail || j.title)) || `HTTP ${up.status}` });

    const st = (j.status || "").toLowerCase(); // starting|processing|succeeded|failed|canceled
    if (st === "succeeded") {
      const o = j.output || {};
      const accompaniments = o.other || o.no_vocals || o.accompaniments || "";
      return res.status(200).json({ status: "SUCCEEDED", result: { vocals: o.vocals || "", accompaniments, no_vocals: accompaniments } });
    }
    if (st === "failed" || st === "canceled") {
      return res.status(200).json({ status: "FAILED", error: j.error || st });
    }
    return res.status(200).json({ status: "PROCESSING" });
  } catch (e) {
    return res.status(502).json({ error: "代理转发失败: " + e.message });
  }
}
