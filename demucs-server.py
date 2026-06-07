#!/usr/bin/env python3
# 本地 Demucs 分轨服务 —— 给「动机即歌」第 3 步用。
# Suno 返回的是一条混好的整曲；这个服务把那条 audio_url 下载下来，
# 用 Facebook 的 Demucs (github.com/facebookresearch/demucs) 拆成
# 「人声 vocals + 伴奏 no_vocals」两轨，再用 HTTP 把两个文件发回浏览器。
#
# 协议刻意和前端原本调 music.ai 的那套一致，所以前端只需把分轨后端切到「Demucs 本地」：
#   POST /job            { params: { inputUrl } }            -> { id }
#   GET  /job/<id>       -> { status, result: { vocals, accompaniments } }
#   GET  /files/<id>/<f> -> 音频文件本身
#
# 准备：
#   pip install -U demucs        # 会带上 torch
#   brew install ffmpeg          # demucs 读写 mp3 需要 ffmpeg
# 启动：
#   python3 demucs-server.py            # 默认 http://localhost:8788
#   PORT=9000 python3 demucs-server.py  # 换端口
# 然后在 App 设置里：分轨后端 = Demucs 本地，地址保持 http://localhost:8788
#
# 说明：纯本地、不联外部 API、无密钥。CPU 上一首歌约 30–90 秒（视长度/机器）。

import http.server
import socketserver
import json
import os
import sys
import re
import ssl
import uuid
import glob
import threading
import subprocess
import tempfile
import urllib.request

# macOS 上 Homebrew/python.org 的 Python 常缺 CA 根证书，会导致下载 https 音频时
# CERTIFICATE_VERIFY_FAILED。优先用 certifi 的证书包，没有再退回系统默认。
# 关键：同时把 SSL_CERT_FILE 设进环境变量——这样 demucs 子进程下载模型权重
# （从 fbaipublicfiles CDN）时，它内部的 urllib/torch 也用这套证书，不然会同样报错。
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
except Exception:
    SSL_CTX = ssl.create_default_context()

PORT = int(os.environ.get("PORT", "8788"))
MODEL = os.environ.get("DEMUCS_MODEL", "htdemucs")  # 默认模型，可换 htdemucs_ft 等
WORK = os.path.join(tempfile.gettempdir(), "motif-demucs")
os.makedirs(WORK, exist_ok=True)

# jobId -> { "status": QUEUED|RUNNING|SUCCEEDED|FAILED, "dir":..., "vocals":fname, "accompaniment":fname, "error":... }
JOBS = {}
LOCK = threading.Lock()

AUDIO_TYPES = {".mp3": "audio/mpeg", ".wav": "audio/wav", ".flac": "audio/flac",
               ".m4a": "audio/mp4", ".ogg": "audio/ogg"}


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "motif-demucs/1.0"})
    with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as r, open(dest, "wb") as f:
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            f.write(chunk)


def run_job(job_id, url):
    job_dir = os.path.join(WORK, job_id)
    os.makedirs(job_dir, exist_ok=True)
    infile = os.path.join(job_dir, "song.mp3")
    try:
        with LOCK:
            JOBS[job_id]["status"] = "RUNNING"
        print(f"[{job_id}] downloading {url[:80]}…")
        download(url, infile)

        outdir = os.path.join(job_dir, "out")
        cmd = [sys.executable, "-m", "demucs", "-n", MODEL,
               "--two-stems=vocals", "--mp3", "-o", outdir, infile]
        print(f"[{job_id}] running: {' '.join(cmd)}")
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError("demucs failed: " + (proc.stderr or proc.stdout)[-400:])

        vocals = glob.glob(os.path.join(outdir, "**", "vocals.*"), recursive=True)
        backing = glob.glob(os.path.join(outdir, "**", "no_vocals.*"), recursive=True)
        if not vocals or not backing:
            raise RuntimeError("stems not found in demucs output")

        with LOCK:
            JOBS[job_id].update(status="SUCCEEDED",
                                vocals=vocals[0], accompaniment=backing[0])
        print(f"[{job_id}] done -> {os.path.basename(vocals[0])} / {os.path.basename(backing[0])}")
    except Exception as e:
        with LOCK:
            JOBS[job_id].update(status="FAILED", error=str(e))
        print(f"[{job_id}] FAILED: {e}")


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):  # 静音默认逐行日志
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,Authorization")

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _base(self):
        host = self.headers.get("Host") or f"localhost:{PORT}"
        return f"http://{host}"

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path.rstrip("/") != "/job":
            return self._json(404, {"error": "POST only /job"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            data = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return self._json(400, {"error": "bad json"})
        url = (data.get("params") or {}).get("inputUrl") or data.get("inputUrl")
        if not url or not re.match(r"^https?://", url):
            return self._json(400, {"error": "missing params.inputUrl (http url)"})
        job_id = uuid.uuid4().hex[:12]
        with LOCK:
            JOBS[job_id] = {"status": "QUEUED"}
        threading.Thread(target=run_job, args=(job_id, url), daemon=True).start()
        self._json(200, {"id": job_id, "status": "QUEUED"})

    def do_GET(self):
        if self.path.rstrip("/") in ("/health", ""):
            return self._json(200, {"ok": True, "model": MODEL})

        m = re.match(r"^/job/([0-9a-f]+)$", self.path)
        if m:
            with LOCK:
                job = JOBS.get(m.group(1))
            if not job:
                return self._json(404, {"error": "no such job"})
            out = {"status": job["status"]}
            if job["status"] == "SUCCEEDED":
                b = self._base()
                out["result"] = {
                    "vocals": f"{b}/files/{m.group(1)}/{os.path.basename(job['vocals'])}",
                    "accompaniments": f"{b}/files/{m.group(1)}/{os.path.basename(job['accompaniment'])}",
                }
            elif job["status"] == "FAILED":
                out["error"] = job.get("error", "failed")
            return self._json(200, out)

        m = re.match(r"^/files/([0-9a-f]+)/([\w.\-]+)$", self.path)
        if m:
            with LOCK:
                job = JOBS.get(m.group(1))
            if not job or job.get("status") != "SUCCEEDED":
                return self._json(404, {"error": "not ready"})
            name = m.group(2)
            path = None
            for key in ("vocals", "accompaniment"):
                if job.get(key) and os.path.basename(job[key]) == name:
                    path = job[key]
            if not path or not os.path.isfile(path):
                return self._json(404, {"error": "file gone"})
            ctype = AUDIO_TYPES.get(os.path.splitext(path)[1].lower(), "application/octet-stream")
            size = os.path.getsize(path)
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(size))
            self.send_header("Accept-Ranges", "none")
            self.end_headers()
            with open(path, "rb") as f:
                while True:
                    chunk = f.read(1 << 16)
                    if not chunk:
                        break
                    try:
                        self.wfile.write(chunk)
                    except (BrokenPipeError, ConnectionResetError):
                        break
            return

        self._json(404, {"error": "not found"})


class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def main():
    # 启动前快速自检 demucs 是否可用
    try:
        subprocess.run([sys.executable, "-m", "demucs", "-h"],
                       capture_output=True, timeout=30)
    except Exception:
        print("⚠️  没找到 demucs。先装：pip install -U demucs（并确保 ffmpeg 已安装）")
    srv = ThreadingServer(("0.0.0.0", PORT), Handler)
    print(f"✅ Demucs 分轨服务已启动: http://localhost:{PORT}  (模型 {MODEL})")
    print(f"   工作目录: {WORK}")
    print("   App 设置里：分轨后端 = Demucs 本地")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n再见。")


if __name__ == "__main__":
    main()
