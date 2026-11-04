import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateText } from 'ai';
import { localModel } from '../agent/lib/local-model.ts';

test('Paid and remote model endpoints are rejected even if credentials exist', () => {
  delete process.env.AGUIRRA_LOCAL;
  assert.throws(localModel, /restrita/);
  process.env.AGUIRRA_LOCAL = 'true'; process.env.AGUIRRA_AI_ENABLED = 'true';
  process.env.OLLAMA_BASE_URL = 'https://api.example.com/v1';
  assert.throws(localModel, /externos/);
  process.env.OLLAMA_BASE_URL = 'http://localhost:11434/v1'; process.env.OLLAMA_MODEL = 'anything-cloud';
  assert.throws(localModel, /cloud/);
});
test('Local model adapter speaks the Ollama-compatible HTTP protocol', async () => {
  let requests = 0;
  const server = createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    const input = JSON.parse(body); assert.equal(input.model, 'test-local'); requests++;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'local-test', object: 'chat.completion', created: 0, model: 'test-local', choices: [{ index: 0, message: { role: 'assistant', content: 'AGUIRRA_OK' }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 } }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    process.env.AGUIRRA_LOCAL = 'true'; process.env.AGUIRRA_AI_ENABLED = 'true'; process.env.OLLAMA_MODEL = 'test-local';
    process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:' + (server.address() as any).port + '/v1';
    const result = await generateText({ model: localModel(), prompt: 'Teste de protocolo local', maxRetries: 0 });
    assert.equal(result.text, 'AGUIRRA_OK'); assert.equal(requests, 1);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
