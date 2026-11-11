import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

if (Number(process.versions.node.split('.')[0]) !== 24) { console.error('Use Node.js 24.x para iniciar o Aguirra.'); process.exit(1); }
const dir = resolve(process.env.AGUIRRA_DATA_DIR || '.aguirra'); mkdirSync(dir, { recursive: true, mode: 0o700 });
const accessFile = join(dir, 'access.json');
if (!existsSync(accessFile) || process.argv.includes('--reset-access')) {
  const code = randomBytes(8).toString('hex'), salt = randomBytes(16).toString('hex');
  writeFileSync(accessFile, JSON.stringify({ salt, hash: scryptSync(code, salt, 64).toString('hex') }), { mode: 0o600 });
  console.log('\nCódigo de acesso ao seu Aguirra: ' + code + '\nGuarde o código e digite-o no tablet. Ele não será enviado a nenhum serviço.\n');
  if (process.argv.includes('--reset-access')) { const local = await import('../agent/lib/local-store.ts'); local.clearLocalSessions(); local.closeLocalStore(); }
} else { JSON.parse(readFileSync(accessFile, 'utf8')); console.log('\nUse o código criado na primeira inicialização. Para trocar: npm run local -- --reset-access\n'); }
const port = Number(process.env.PORT || 3000);
console.log('Aguirra no computador: http://localhost:' + port);
for (const entries of Object.values(networkInterfaces())) for (const item of entries || []) if (item.family === 'IPv4' && !item.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address)) console.log('Aguirra no tablet, na mesma rede: http://' + item.address + ':' + port);
console.log('IA: Ollama local. Banco: SQLite neste computador. Nenhuma API paga.\n');
const child = spawn(process.execPath, ['scripts/dev.mjs'], { stdio: 'inherit', env: { ...process.env, AGUIRRA_LOCAL: 'true', AGUIRRA_AI_ENABLED: 'true', AGUIRRA_DATA_DIR: dir, OLLAMA_BASE_URL: 'http://127.0.0.1:11434/v1', OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'aguirra-local' } });
// Preload the local model so the first question does not wait for it to load from disk.
fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'aguirra-local', keep_alive: '-1' }), signal: AbortSignal.timeout(120000) }).catch(() => {});
child.on('exit', code => process.exit(code || 0)); process.on('SIGINT', () => child.kill('SIGINT')); process.on('SIGTERM', () => child.kill('SIGTERM'));
