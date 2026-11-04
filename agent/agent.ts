import { defineAgent } from "eve";

export default defineAgent({
  model: "openai/gpt-6-luna-fast",
  reasoning: "low",
  defaultTools: false,
  limits: {
    sessionUsage: ({ window }) => window.inputTokens >= 20_000 || window.outputTokens >= 4_000 || (window.costUsd ?? 0) >= 0.05,
    sessionTimeoutMs: 5 * 60 * 1000,
  },
  experimental: { workflow: { retention: 0 } },
});
