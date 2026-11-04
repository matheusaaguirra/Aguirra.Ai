import { defineTool } from "eve/tools";
import { z } from "zod";
import { readNews } from "../lib/news.ts";
export default defineTool({
  description: "Consulta manchetes e descrições de feeds RSS gratuitos da BBC sobre Brasil, EUA, mundo ou tecnologia. Não é busca geral da web. Não invente informações ausentes dos feeds.",
  inputSchema: z.object({ query: z.string().min(2).max(300) }),
  async execute({ query }) { return readNews(query); },
});
