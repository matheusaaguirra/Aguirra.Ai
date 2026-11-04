import { defineAgent } from "eve";
import { defineDynamic } from "eve/models";
import { localModel } from "./lib/local-model.ts";

export default defineAgent({
  model: defineDynamic(() => {
    return { model: localModel(), modelContextWindowTokens: 8192 };
  }),
  defaultTools: false,
  limits: {
    sessionUsage: ({ window }) => window.inputTokens >= 20_000 || window.outputTokens >= 4_000 || (window.costUsd ?? 0) >= 0.05,
    sessionTimeoutMs: 5 * 60 * 1000,
  },
  experimental: { workflow: { retention: 0 } },
});
