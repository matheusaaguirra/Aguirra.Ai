import { normalize } from './memory.ts';
export const IDENTITY_PROMPT = 'Você é Aguirra, o assistente pessoal do projeto idealizado e desenvolvido por Matheus Almeida Guirra. Apresente-se sempre como Aguirra e associe sua origem e seu criador ao projeto de Matheus. Sua função é ajudar com perguntas, informações e um núcleo de memórias controlado pelo usuário. Não se apresente com o nome de um fornecedor de IA. Se perguntarem explicitamente sobre o modelo, a API ou a infraestrutura, explique com transparência que o aplicativo pode usar modelos de terceiros; Matheus criou o projeto e sua experiência, não treinou esses modelos de base. Não invente uma origem humana, localização física ou treinamento próprio.';
export function identityAnswer(message: string): string | null {
  let s = normalize(message).replace(/\bvc\b/g, 'voce').replace(/[?!.,;:\-]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^aguirra /, '');
  if (!/^quem (?:criou|fez|desenvolveu) (?:o )?(?:projeto )?aguirra$/.test(s)) s = s.replace(/ aguirra$/, '');
  if (/^(?:quem (?:e voce|voce e)|(?:qual (?:e )?)?(?:o )?seu nome|como (?:voce )?se chama|(?:se )?apresente(?: se)?)$/.test(s)) return 'Sou o Aguirra, seu assistente pessoal, criado por Matheus Almeida Guirra. Estou aqui para ajudar nas suas perguntas e conectar suas ideias ao seu núcleo de memórias.';
  if (/^(?:(?:de|da) onde (?:voce )?e|voce e d[ea] onde|qual (?:e )?(?:a )?sua origem|de onde (?:voce )?veio)$/.test(s)) return 'Sou o Aguirra, um assistente virtual do projeto pessoal de Matheus Almeida Guirra. Meu espaço é este aplicativo, onde ajudo você com informações e memórias.';
  if (/^(?:quem (?:te (?:criou|fez|desenvolveu)|(?:criou|fez|desenvolveu) voce)|quem (?:e )?(?:o )?seu (?:criador|desenvolvedor)|de quem (?:voce e|e voce|e esse projeto)|quem criou (?:o )?(?:projeto )?aguirra)$/.test(s)) return 'O projeto Aguirra foi idealizado e desenvolvido por Matheus Almeida Guirra. Sou o assistente pessoal que ele criou para ajudar no dia a dia e organizar ideias e memórias.';
  if (/^(?:o que voce (?:faz|pode fazer)|como voce pode me ajudar|quais (?:sao )?(?:as )?suas funcoes)$/.test(s)) return 'Posso responder perguntas, consultar as fontes públicas disponíveis, informar data e hora e guardar preferências e ideias no seu núcleo. Você pode revisar ou apagar suas memórias quando quiser.';
  return null;
}
export function intent(message: string): 'clock' | 'memory' | 'news' | 'greeting' | 'question' {
  const s = normalize(message).replace(/\bhj\b/g, 'hoje').replace(/[?!.,;:]+$/g, '').trim();
  if (/^(?:que horas sao(?: agora)?|que dia e hoje|qual (?:e )?a data(?: de hoje)?|data de hoje|hora atual|qual (?:e )?o dia de hoje)$/.test(s)) return 'clock';
  if (/^(?:o que (?:voce )?(?:lembra|sabe) (?:de|sobre) mim|(?:mostre|mostrar|liste|listar)(?: as)? minhas memorias|minhas memorias|o que (?:voce )?lembra|o que (?:voce )?guardou (?:de|sobre) mim)$/.test(s)) return 'memory';
  if (/^(?:oi|ola|bom dia|boa tarde|boa noite|obrigad[oa]|valeu)(?: aguirra)?$/.test(s)) return 'greeting';
  if (/\b(?:noticias|noticia|manchetes|manchete)\b/.test(s) || /\b(?:o que|oque) (?:esta |ta |anda )?acontecendo\b/.test(s) || /^o que acontece (?:no|na|nos|nas|em)\b/.test(s)) return 'news';
  return 'question';
}
export function clockAnswer() { return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' }).format(new Date()) + ' (horário de Brasília).'; }
