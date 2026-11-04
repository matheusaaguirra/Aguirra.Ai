export const categories = ["profile", "preferences", "goals", "projects", "notes"] as const;
export type Category = typeof categories[number];
export interface Memory { id?: string; category: Category; key: string; content: string; origin: string; source_message_id?: string | null; updated_at?: string; }
export function normalize(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
export function sensitive(value: string) {
  return /\b(senha|password|token|api.?key|segredo|cpf|rg|cartao|diagnostico|doenca|medicamento|sexual|religiao|orientacao|saude|endereco)\b/.test(normalize(value)) || /\b\d{3}[. ]?\d{3}[. ]?\d{3}[- ]?\d{2}\b/.test(value) || /\b\d{13,19}\b/.test(value) || /\b(?:sk-|sb_secret_)[a-zA-Z0-9_-]{12,}/.test(value);
}
export function redact(value: string) {
  return value.replace(/\b(senha|password|token|api[_ -]?key)\s*(?:e|é|:|=)\s*[^\s,;]+/gi, "$1: [oculto]").replace(/\b\d{3}[. ]?\d{3}[. ]?\d{3}[- ]?\d{2}\b/g, "[documento oculto]").replace(/\b(?:sk-|sb_secret_)[a-zA-Z0-9_-]{12,}/g, "[credencial oculta]");
}
export function extract(text: string): Memory[] {
  if (sensitive(text) || /\?|\b(se eu|imagine|suponha|exemplo|hipotetic|ele disse|ela disse)\b/i.test(text)) return [];
  const rules: { re: RegExp; category: Category; key?: string; prefix: string }[] = [
    { re: /^(?:meu nome (?:é|e)|me chamo)\s+(.{2,90})[.!]?$/i, category: "profile", key: "name", prefix: "Nome: " },
    { re: /^(?:eu )?prefiro\s+(.{3,300})[.!]?$/i, category: "preferences", prefix: "Prefere " },
    { re: /^(?:meu objetivo (?:é|e)|minha meta (?:é|e))\s+(.{3,300})[.!]?$/i, category: "goals", prefix: "Objetivo: " },
    { re: /^(?:estou desenvolvendo|meu projeto (?:é|e))\s+(.{3,300})[.!]?$/i, category: "projects", prefix: "Projeto: " },
    { re: /^(?:lembre(?:-se)? (?:de )?que|guarde(?: que)?|memorize(?: que)?)\s+(.{3,400})[.!]?$/i, category: "notes", prefix: "" },
  ];
  for (const rule of rules) { const m = text.trim().match(rule.re); if (m) { const content = rule.prefix + m[1].replace(/[.!]+$/, "").trim(); return [{ category: rule.category, key: rule.key || normalize(content).slice(0, 100), content, origin: "declared" }]; } }
  return [];
}
export function relevant(memories: Memory[], query: string) {
  const words = normalize(query).split(/\W+/).filter(w => w.length > 3);
  return memories.map(m => ({ m, score: (m.category === "preferences" || m.category === "profile" ? 2 : 0) + words.reduce((score, w) => score + (normalize(m.content).includes(w) ? 3 : 0), 0) })).filter(m => m.score > 0).sort((a, b) => b.score - a.score).slice(0, 10).map(x => x.m);
}
export function topics(text: string) {
  const s = normalize(text), rules: [string, RegExp][] = [["Tecnologia", /\b(ia|inteligencia artificial|tecnologia|computador|android|tablet)\b/], ["Desenvolvimento", /\b(codigo|programacao|angular|typescript|javascript|python|software|github|api)\b/], ["Notícias", /\b(noticia|noticias|acontecendo|acontecimentos|brasil|estados unidos|mundo)\b/], ["Projetos", /\b(projeto|wealthos|zyntracare|aguirra|saas)\b/], ["Estudos", /\b(estudar|estudo|aula|faculdade|aprender|ingles|italiano)\b/], ["Finanças", /\b(financas|dinheiro|investimento|investir|gastos|salario)\b/], ["Automóveis", /\b(carro|carros|formula 1|drift|automovel)\b/]];
  return rules.filter(([, re]) => re.test(s)).map(([name]) => name);
}
