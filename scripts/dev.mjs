import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, appendFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const portArg = process.argv.indexOf('--port');
const port = Number(process.env.PORT || (portArg >= 0 ? process.argv[portArg + 1] : 3000));
const agent = spawn(process.execPath, ['node_modules/eve/bin/eve.js', 'dev', '--no-ui', '--port', '2000'], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
mkdirSync('.aguirra', { recursive: true });
for (const stream of [agent.stdout, agent.stderr]) stream.on('data', chunk => { process.stderr.write(chunk); appendFileSync('.aguirra/dev-server.log', chunk); });
const files = { '/': ['index.html', 'text/html'], '/styles.css': ['styles.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'], '/voice.js': ['voice.js', 'text/javascript'], '/microphone.js': ['microphone.js', 'text/javascript'], '/memory-core.js': ['memory-core.js', 'text/javascript'], '/icon.svg': ['icon.svg', 'image/svg+xml'] };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/eve/')) {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const headers = new Headers(); for (const [k, v] of Object.entries(request.headers)) if (v && !['host', 'connection', 'content-length'].includes(k)) headers.set(k, Array.isArray(v) ? v.join(',') : v);
      // The local proxy preserves same-origin validation while forwarding to eve.
      if (headers.has('origin')) {
        if (headers.get('origin') !== url.origin) { response.writeHead(403); response.end('Origem não autorizada'); return; }
        headers.set('origin', 'http://localhost:2000');
      }
      const upstream = await fetch('http://localhost:2000' + url.pathname + url.search, { method: request.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined, signal: AbortSignal.timeout(180000) });
      response.statusCode = upstream.status; upstream.headers.forEach((v, k) => { if (!['set-cookie', 'content-encoding', 'content-length', 'transfer-encoding'].includes(k)) response.setHeader(k, v); });
      if (upstream.headers.getSetCookie().length) response.setHeader('set-cookie', upstream.headers.getSetCookie());
      response.end(Buffer.from(await upstream.arrayBuffer())); return;
    }
    const file = files[url.pathname]; if (!file) { response.writeHead(404); response.end('Não encontrado'); return; }
    response.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(await readFile(new URL('../public/' + file[0], import.meta.url)));
  } catch { response.writeHead(503, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: 'O servidor do Aguirra está iniciando. Tente em alguns segundos.' })); }
});
server.listen(port, '0.0.0.0', () => console.log(`Aguirra frontend listening on port ${port}`));
function stop() { agent.kill(); server.close(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
