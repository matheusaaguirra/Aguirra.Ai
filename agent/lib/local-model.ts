import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { localMode } from "./local-store.ts";
export function localModel() {
  if (!localMode() || process.env.AGUIRRA_AI_ENABLED === "false") throw new Error("A IA está restrita ao computador local. Nenhuma API paga será chamada.");
  const baseURL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1";
  const url = new URL(baseURL);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("O modelo deve rodar no Ollama local; endpoints externos estão bloqueados.");
  const model = process.env.OLLAMA_MODEL || "aguirra-local";
  if (/cloud/i.test(model)) throw new Error("Modelos cloud estão bloqueados. Instale um modelo local no Ollama.");
  return createOpenAICompatible({ name: "ollama", baseURL })(model);
}
