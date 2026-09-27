import http from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';

const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' };

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404); response.end('Not found'); return;
  }
  const size = statSync(file).size;
  const type = types[extname(file)] || 'application/octet-stream';
  const range = request.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) { response.writeHead(416, { 'Content-Range': `bytes */${size}` }); response.end(); return; }
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2] || 0));
    const end = match[2] && match[1] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start >= size || end < start) { response.writeHead(416, { 'Content-Range': `bytes */${size}` }); response.end(); return; }
    response.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1, 'Cache-Control': 'no-cache' });
    if (request.method === 'HEAD') response.end(); else createReadStream(file, { start, end }).pipe(response);
    return;
  }
  response.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size, 'Cache-Control': 'no-cache' });
  if (request.method === 'HEAD') response.end(); else createReadStream(file).pipe(response);
}).listen(5179, '127.0.0.1', () => console.log('Site ready at http://localhost:5179/'));
