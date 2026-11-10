#!/usr/bin/env node
// serve.mjs — static server xem thử tại chỗ. Phục vụ thư mục gốc repo; mở http://localhost:8787/docs/
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // Dev-only: tools/make-icons.html POSTs PNG data URLs here to save docs/icons/icon-*.png
    if (req.method === 'POST' && p === '/__icons') {
      let raw = ''; for await (const ch of req) raw += ch;
      const icons = JSON.parse(raw); const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(join(ROOT, 'docs/icons'), { recursive: true });
      for (const size of ['192', '512']) {
        if (!icons[size]) continue;
        await writeFile(join(ROOT, 'docs/icons', `icon-${size}.png`), Buffer.from(icons[size].split(',')[1], 'base64'));
      }
      res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('saved');
    }
    let file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    let s = await stat(file).catch(() => null);
    if (s && s.isDirectory()) { file = join(file, 'index.html'); s = await stat(file).catch(() => null); }
    if (!s) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(PORT, () => console.log(`http://localhost:${PORT}/docs/`));
