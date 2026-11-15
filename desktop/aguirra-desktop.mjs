import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DESKTOP_PORT = Number(process.env.AGUIRRA_DESKTOP_PORT || 3847);

export const ALLOWED_ACTIONS = {
  whatsapp: {
    label: 'WhatsApp',
    win32: ['whatsapp:', 'https://web.whatsapp.com'],
    darwin: ['WhatsApp'],
    linux: ['whatsapp-desktop', 'https://web.whatsapp.com']
  },
  calculator: {
    label: 'Calculadora',
    win32: ['calc.exe'],
    darwin: ['Calculator'],
    linux: ['gnome-calculator', 'kcalc']
  },
  notepad: {
    label: 'Bloco de Notas',
    win32: ['notepad.exe'],
    darwin: ['TextEdit'],
    linux: ['gedit', 'mousepad']
  },
  explorer: {
    label: 'Explorador de Arquivos',
    win32: ['explorer.exe'],
    darwin: ['Finder'],
    linux: ['xdg-open', homedir()]
  },
  browser: {
    label: 'Navegador',
    win32: ['https://www.google.com'],
    darwin: ['Safari'],
    linux: ['https://www.google.com']
  },
  youtube: {
    label: 'YouTube',
    win32: ['https://www.youtube.com'],
    darwin: ['https://www.youtube.com'],
    linux: ['https://www.youtube.com']
  },
  spotify: {
    label: 'Spotify',
    win32: ['spotify:', 'https://open.spotify.com'],
    darwin: ['Spotify'],
    linux: ['spotify', 'https://open.spotify.com']
  },
  discord: {
    label: 'Discord',
    win32: ['discord:', 'https://discord.com/app'],
    darwin: ['Discord'],
    linux: ['discord', 'https://discord.com/app']
  },
  vscode: {
    label: 'VS Code',
    win32: ['code'],
    darwin: ['Visual Studio Code'],
    linux: ['code']
  },
  settings: {
    label: 'Configurações do Windows',
    win32: ['ms-settings:'],
    darwin: ['System Settings'],
    linux: ['gnome-control-center']
  }
};

const ALLOWED_ORIGINS = new Set([
  'https://aguirra-ai.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /^https:\/\/[a-z0-9-]+-aguirra[a-z0-9-]*\.vercel\.app$/i.test(origin) ||
    /^http:\/\/(?:localhost|127\.0\.0\.1):\d{2,5}$/.test(origin);
}

export function loadOrCreateToken(tokenFile = join(homedir(), '.aguirra', 'desktop-token')) {
  if (process.env.AGUIRRA_DESKTOP_TOKEN) return process.env.AGUIRRA_DESKTOP_TOKEN.trim();
  try {
    if (existsSync(tokenFile)) {
      const existing = readFileSync(tokenFile, 'utf8').trim();
      if (existing.length >= 16) return existing;
    }
  } catch { /* fall through and create */ }
  const token = randomBytes(12).toString('hex');
  try {
    mkdirSync(join(tokenFile, '..'), { recursive: true });
    writeFileSync(tokenFile, token, { mode: 0o600 });
  } catch { /* in-memory fallback */ }
  return token;
}

export function launchTarget(actionKey, platform = process.platform, runner = spawn) {
  const entry = ALLOWED_ACTIONS[actionKey];
  if (!entry) return { ok: false, error: 'Ação não permitida.' };
  const targets = entry[platform] || entry.win32;
  const primary = targets[0];

  if (platform === 'win32') {
    const child = runner('cmd.exe', ['/c', 'start', '', primary], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    if (child && typeof child.unref === 'function') child.unref();
    return { ok: true, label: entry.label, target: primary };
  }
  if (platform === 'darwin') {
    const isUrl = /^https?:\/\//i.test(primary);
    const args = isUrl ? [primary] : ['-a', primary];
    const child = runner('open', args, { detached: true, stdio: 'ignore' });
    if (child && typeof child.unref === 'function') child.unref();
    return { ok: true, label: entry.label, target: primary };
  }
  const cmd = /^https?:\/\//i.test(primary) ? 'xdg-open' : primary;
  const args = /^https?:\/\//i.test(primary) ? [primary] : [];
  const child = runner(cmd, args, { detached: true, stdio: 'ignore' });
  if (child && typeof child.unref === 'function') child.unref();
  return { ok: true, label: entry.label, target: primary };
}

function readJsonBody(req, maxBytes = 16_384) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) { resolve({}); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('INVALID_JSON')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Aguirra-Token';
  headers['Access-Control-Allow-Private-Network'] = 'true';
  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

export function createDesktopServer({ token, launcher = launchTarget } = {}) {
  const secret = token || loadOrCreateToken();
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin || '';
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {}, origin);
      return;
    }
    const url = new URL(req.url || '/', `http://127.0.0.1:${DESKTOP_PORT}`);
    if (url.pathname === '/health' && req.method === 'GET') {
      const provided = String(req.headers['x-aguirra-token'] || '');
      const authenticated = provided === secret;
      sendJson(res, 200, {
        ok: true,
        authenticated,
        platform: process.platform,
        actions: Object.keys(ALLOWED_ACTIONS)
      }, origin);
      return;
    }
    if (url.pathname === '/execute' && req.method === 'POST') {
      const provided = String(req.headers['x-aguirra-token'] || '');
      if (!provided || provided !== secret) {
        sendJson(res, 401, { error: 'Código do desktop inválido ou ausente.' }, origin);
        return;
      }
      if (origin && !isAllowedOrigin(origin)) {
        sendJson(res, 403, { error: 'Origem não autorizada.' }, origin);
        return;
      }
      try {
        const payload = await readJsonBody(req);
        const action = typeof payload.action === 'string' ? payload.action.trim().toLowerCase() : '';
        if (!Object.prototype.hasOwnProperty.call(ALLOWED_ACTIONS, action)) {
          sendJson(res, 400, { error: 'Ação não reconhecida na lista segura do desktop.' }, origin);
          return;
        }
        const result = launcher(action);
        sendJson(res, 200, {
          ok: true,
          action,
          label: result.label,
          reply: `Abrindo ${result.label} no seu computador.`
        }, origin);
      } catch (err) {
        const msg = err && err.message === 'PAYLOAD_TOO_LARGE' ? 'Pedido muito grande.' : 'JSON inválido.';
        sendJson(res, 400, { error: msg }, origin);
      }
      return;
    }
    sendJson(res, 404, { error: 'Rota não encontrada.' }, origin);
  });
}

if (import.meta.url === `file://${process.argv[1]}` || (process.argv[1] && process.argv[1].endsWith('aguirra-desktop.mjs'))) {
  const token = loadOrCreateToken();
  const server = createDesktopServer({ token });
  server.listen(DESKTOP_PORT, '127.0.0.1', () => {
    console.log('');
    console.log('===============================================');
    console.log('  Aguirra Desktop Bridge ativo!');
    console.log(`  Endereco local : http://127.0.0.1:${DESKTOP_PORT}`);
    console.log(`  Codigo do PC   : ${token}`);
    console.log('===============================================');
    console.log('');
    console.log('1. Abra https://aguirra-ai.vercel.app no Google Chrome.');
    console.log('2. Va em Configuracoes -> Conectar ao PC (Desktop).');
    console.log('3. Cole o Codigo do PC acima e salve.');
    console.log('4. Fale ou digite: "abrir o WhatsApp".');
    console.log('');
  });
}
