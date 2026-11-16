import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  const inline = process.argv.find(value => value.startsWith(name + "="));
  return inline ? inline.slice(name.length + 1) : fallback;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] || 0;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function rounded(value, digits = 2) {
  return Number(value.toFixed(digits));
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log("Uso: npm run bench:local -- [--model aguirra-local] [--samples 5] [--json] [--output arquivo.json]");
    return;
  }

  const jsonOutput = process.argv.includes("--json");
  const progress = jsonOutput ? process.stderr : process.stdout;

  const samples = Number(argument("--samples", "5"));
  if (!Number.isInteger(samples) || samples < 1 || samples > 50) {
    throw new Error("--samples precisa ser um número inteiro entre 1 e 50.");
  }

  const model = String(argument("--model", process.env.OLLAMA_MODEL || "aguirra-local")).trim();
  if (!model || /cloud/i.test(model)) throw new Error("Informe um modelo local do Ollama; modelos cloud não são aceitos.");

  const configuredUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const base = new URL(configuredUrl);
  if (base.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) ||
      base.username || base.password || base.search || base.hash) {
    throw new Error("Por segurança, o benchmark só aceita Ollama HTTP em localhost (127.0.0.1, localhost ou ::1).");
  }
  const endpoint = new URL("/api/generate", base.origin);

  async function generate(prompt, maxTokens) {
    const started = performance.now();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        model,
        prompt: prompt + "\n/no_think",
        stream: false,
        keep_alive: "5m",
        options: { temperature: 0, num_predict: maxTokens }
      }),
      signal: AbortSignal.timeout(120000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Ollama respondeu com HTTP " + response.status + ".");
    }
    if (typeof data.response !== "string") {
      throw new Error("Ollama não retornou o campo response esperado.");
    }

    const wallSeconds = (performance.now() - started) / 1000;
    const evalSeconds = Number(data.eval_duration || 0) / 1e9;
    const promptSeconds = Number(data.prompt_eval_duration || 0) / 1e9;
    const outputTokens = Number(data.eval_count || 0);
    return {
      wallSeconds,
      evalSeconds,
      promptSeconds,
      outputTokens,
      inputTokens: Number(data.prompt_eval_count || 0),
      tokensPerSecond: evalSeconds > 0 ? outputTokens / evalSeconds : 0,
      promptTokensPerSecond: promptSeconds > 0 ? Number(data.prompt_eval_count || 0) / promptSeconds : 0
    };
  }

  progress.write("Aquecendo o modelo local...\n");
  await generate("Responda apenas: pronto.", 8);

  const latencyRuns = [];
  const latencyPrompt = "Responda em uma frase: por que um assistente pessoal deve proteger a memória do usuário?";
  for (let i = 0; i < samples; i++) {
    latencyRuns.push(await generate(latencyPrompt, 48));
    progress.write("\rLatência: " + (i + 1) + "/" + samples);
  }

  const throughputRuns = [];
  const throughputPrompt = "Explique em até cinco frases como um assistente pessoal pode combinar memória local, privacidade e respostas úteis. Use linguagem simples e objetiva.";
  for (let i = 0; i < samples; i++) {
    throughputRuns.push(await generate(throughputPrompt, 128));
    progress.write("\rVazão:   " + (i + 1) + "/" + samples);
  }

  const latencies = latencyRuns.map(run => run.wallSeconds);
  const summary = {
    benchmark: "aguirra-local",
    engine: "ollama",
    model,
    generatedAt: new Date().toISOString(),
    samples,
    warmupCalls: 1,
    latency: {
      meanSeconds: rounded(average(latencies), 3),
      p50Seconds: rounded(percentile(latencies, 0.50), 3),
      p95Seconds: rounded(percentile(latencies, 0.95), 3),
      minSeconds: rounded(Math.min(...latencies), 3),
      maxSeconds: rounded(Math.max(...latencies), 3)
    },
    throughput: {
      meanOutputTokensPerSecond: rounded(average(throughputRuns.map(run => run.tokensPerSecond)), 2),
      meanPromptTokensPerSecond: rounded(average(throughputRuns.map(run => run.promptTokensPerSecond)), 2),
      meanOutputTokens: rounded(average(throughputRuns.map(run => run.outputTokens)), 1),
      totalOutputTokens: throughputRuns.reduce((sum, run) => sum + run.outputTokens, 0),
      meanWallSeconds: rounded(average(throughputRuns.map(run => run.wallSeconds)), 3)
    },
    privacy: "Prompts and generated responses are not written to disk or sent outside localhost."
  };

  const outputPath = argument("--output", null);
  if (outputPath) {
    const absolutePath = resolve(outputPath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, JSON.stringify(summary, null, 2) + "\n", "utf8");
  }

  if (!jsonOutput) process.stdout.write("\n");
  if (jsonOutput) {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  } else {
    console.log("\nAguirra · benchmark local");
    console.log("Modelo: " + model + " · Amostras por teste: " + samples);
    console.log("\nLatência (segundos)");
    console.log("  Média: " + summary.latency.meanSeconds);
    console.log("  p50:   " + summary.latency.p50Seconds);
    console.log("  p95:   " + summary.latency.p95Seconds);
    console.log("  Min / máx: " + summary.latency.minSeconds + " / " + summary.latency.maxSeconds);
    console.log("\nVazão");
    console.log("  Tokens de saída/segundo: " + summary.throughput.meanOutputTokensPerSecond);
    console.log("  Tokens de entrada/segundo: " + summary.throughput.meanPromptTokensPerSecond);
    console.log("  Média de tokens gerados: " + summary.throughput.meanOutputTokens);
    if (outputPath) console.log("\nResultado salvo em: " + resolve(outputPath));
    console.log("\nNenhuma conversa, memória ou resposta foi salva.");
  }
}

main().catch(error => {
  console.error("\nFalha no benchmark: " + error.message);
  console.error("Confira se o Ollama está aberto e se o modelo local já foi baixado.");
  process.exitCode = 1;
});
