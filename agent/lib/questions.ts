import { normalize } from './memory.ts';
export function intent(message: string): 'clock' | 'memory' | 'news' | 'greeting' | 'question' {
  const s = normalize(message).replace(/[?!.,;:]+$/g, '').trim();
  if (/^(?:que horas sao(?: agora)?|que dia e hoje|qual (?:e )?a data(?: de hoje)?|data de hoje|hora atual|qual (?:e )?o dia de hoje)$/.test(s)) return 'clock';
  if (/^(?:o que (?:voce )?(?:lembra|sabe) (?:de|sobre) mim|(?:mostre|mostrar|liste|listar)(?: as)? minhas memorias|minhas memorias|o que (?:voce )?lembra|o que (?:voce )?guardou (?:de|sobre) mim)$/.test(s)) return 'memory';
  if (/^(?:oi|ola|bom dia|boa tarde|boa noite|obrigad[oa]|valeu)(?: aguirra)?$/.test(s)) return 'greeting';
  if (/\b(?:noticias|noticia|manchetes|manchete)\b/.test(s) || /\b(?:o que|oque) (?:esta |ta |anda )?acontecendo\b/.test(s) || /^o que acontece (?:no|na|nos|nas|em)\b/.test(s)) return 'news';
  return 'question';
}
export function clockAnswer() { return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' }).format(new Date()) + ' (horário de Brasília).'; }
