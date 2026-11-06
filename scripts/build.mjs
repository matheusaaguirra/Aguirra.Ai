import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
cpSync('shared/answer-cache.cjs', 'public/answer-cache.js');
const result = spawnSync(process.execPath, ['node_modules/eve/bin/eve.js', 'build'], { stdio: 'inherit', env: process.env });
if (result.status !== 0) process.exit(result.status || 1);
if (process.env.VERCEL) {
  mkdirSync('.vercel/output/static', { recursive: true });
  cpSync('public', '.vercel/output/static', { recursive: true });
  const config = JSON.parse(readFileSync('.vercel/output/config.json', 'utf8'));
  config.routes = [{ src: '^/(?:styles\\.css|app\\.js|answer-cache\\.js|graph\\.js|voice\\.js|microphone\\.js|memory-core\\.js|icon\\.svg)$', headers: { 'Cache-Control': 'public,max-age=0,must-revalidate', 'X-Content-Type-Options': 'nosniff' }, continue: true }, { src: '^/$', headers: { 'Cache-Control': 'no-cache', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; frame-src data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'", 'Permissions-Policy': 'microphone=(self), camera=()', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' }, continue: true }, { handle: 'filesystem' }, ...(config.routes || []).filter(r => r.handle !== 'filesystem')];
  config.routes.splice(2, 0, { src: '^/$', dest: '/index.html' });
  writeFileSync('.vercel/output/config.json', JSON.stringify(config, null, 2));
}
