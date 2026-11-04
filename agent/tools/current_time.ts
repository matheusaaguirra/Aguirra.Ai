import { defineTool } from "eve/tools";
import { z } from "zod";
export default defineTool({
  description: "Consulta data e hora atuais em um fuso IANA, sem pesquisa web.",
  inputSchema: z.object({ time_zone: z.string().max(80).default("America/Sao_Paulo") }),
  execute({ time_zone }) {
    try { return { iso: new Date().toISOString(), local: new Intl.DateTimeFormat("pt-BR", { timeZone: time_zone, dateStyle: "full", timeStyle: "short" }).format(new Date()), time_zone }; }
    catch { return { iso: new Date().toISOString(), error: "Fuso inválido; informe um fuso IANA." }; }
  },
});
