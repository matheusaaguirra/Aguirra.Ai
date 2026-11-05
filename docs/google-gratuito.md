# Perguntas sem conta e pesquisa do Google

Acesse https://aguirra-ai.vercel.app/. A conta é opcional: o navegador guarda o histórico e o núcleo do visitante. Apenas o contexto recente e as memórias relevantes são enviados para produzir a resposta. Não há leitura de dados de outras contas. Uma conta permite sincronização, mas não é requisito para perguntar.

## Ativar a pesquisa real

O código está integrado ao Gemini com Google Search grounding. A ativação depende de uma chave do proprietário do projeto. Não é a conta de quem faz a pergunta e não é uma assinatura do ChatGPT.

1. Abra [Google AI Studio — chaves](https://aistudio.google.com/api-keys). Crie uma chave em um projeto dedicado no **Free tier**, sem habilitar Cloud Billing. Não ative uma assinatura paga.
2. No [projeto Aguirra na Vercel](https://vercel.com/dashboard), abra Settings → Environment Variables. Adicione `GOOGLE_GENERATIVE_AI_API_KEY` como variável criptografada ou sensível, no servidor, para Production. Cole a chave apenas nesse campo, nunca no chat ou no código público.
3. Confira no Google que o projeto está no plano gratuito e sem faturamento. Só então configure `AGUIRRA_GOOGLE_FREE_TIER=confirmed-no-billing` na Vercel. Uma chave sozinha não ativa o provedor.
4. Faça Redeploy do último deployment. Para desenvolvimento local, use as mesmas variáveis no `.env.local`, ignorado pelo Git. O modo local não exige banco na nuvem.
5. Em uma janela anônima, pergunte “Qual é a capital da Itália?” e uma pergunta atual específica. Confira a resposta, links e sugestões do Google. Em Configurações, o estado deve indicar pesquisa com Google ativa.

A chave do Google **ainda não está configurada** neste projeto. Os testes do adaptador usam respostas simuladas; não provam uma consulta real ao Google. Sem chave, saudação, relógio e núcleo funcionam; notícias usam feeds BBC limitados, identificados como RSS. Perguntas gerais na hospedagem informam que a pesquisa ainda não está disponível. Não existe um pedido de login para liberar essas respostas.

## Controle do uso gratuito

- Modelo fixado: `gemini-2.5-flash-lite`, sem AI Gateway ou troca automática para modelos pagos.
- Máximo de 100 tentativas de pesquisa por dia para o projeto inteiro, incluindo visitantes e contas. Em produção, a reserva é atômica no banco e ocorre antes de cada chamada ao Google.
- Visitantes: até 30 pedidos ao servidor por hora por identificador de rede protegido com HMAC. O endereço IP não é salvo em texto; o identificador muda diariamente. Pedidos de relógio e núcleo resolvidos no aparelho não usam essa cota.
- Sem repetição automática se o Google falhar. A resposta tem limite de tokens e tempo. A cota do Google pode ser menor; nesse caso, o aplicativo informa a indisponibilidade.
- O token `AGUIRRA_GUEST_SECRET` protege exclusivamente a função de cota. Ele não dá acesso a conversas. Não é a chave do Google. Seu hash SHA-256 fica na tabela privada de configuração; o valor real fica criptografado na Vercel.
- No modo local, os limites públicos são mantidos em memória e reiniciam com o processo. Para impedir cobranças mesmo após reinício ou alteração de cotas, use um projeto Google **sem faturamento**. O aplicativo não consegue verificar o estado de cobrança a partir de uma chave de API.

A documentação de preços consultada em 05/11/2026 informa entrada e saída gratuitas para esse modelo e Google Search gratuito até 500 solicitações diárias, compartilhadas com Flash. As cotas dependem do projeto e podem mudar. Confirme os [preços oficiais](https://ai.google.dev/gemini-api/docs/pricing) antes de ativar. Não use uma chave de projeto com cobrança: um teto de requisições não transforma uma API paga em gratuita.

No plano gratuito, o Google pode usar os dados enviados para melhorar os produtos, conforme seus [termos](https://ai.google.dev/gemini-api/terms). Não envie informações confidenciais. A sincronização continua nos limites do Supabase Free e Vercel Hobby, sem upgrade automático.

## Coerência e fontes

A pergunta original e até seis mensagens recentes permitem resolver referências como “e no Brasil?”. Preferências vêm apenas do núcleo atual. “Memória RAM” não é confundida com memória pessoal; perguntas sobre horários de eventos não viram o relógio atual. Em notícias RSS, o assunto específico é filtrado: não trocamos uma consulta sobre carros por manchetes genéricas da região.

Respostas do Google só são apresentadas como pesquisadas se trouxerem consultas, fontes HTTPS e trechos de suporte. Uma pergunta curta de esclarecimento pode ser devolvida sem fontes. Falhas não geram fatos inventados nem uma pesquisa simulada. Os links e os trechos associados aparecem na resposta. O conteúdo de sugestões fornecido pelo Google é exibido em iframe isolado, sem permissão para scripts, formulários ou acesso à página principal.

## Banco

Para replicar a hospedagem, aplique `database/schema.sql` e depois `database/migrations/20261104_public_questions.sql`. Gere um segredo aleatório de pelo menos 32 caracteres; configure-o na Vercel e cadastre somente seu SHA-256 em `aguirra_private.public_config`. Não conceda acesso anônimo às tabelas de usuários.

## Voz sem conta

A leitura usa a voz disponível no navegador. No modo local Windows, visitantes também podem pedir áudio sem autenticação: a resposta é enviada por POST ao sintetizador local, sem texto na URL. Isso depende das vozes em português instaladas no Windows e da reprodução de áudio do navegador do tablet. Na hospedagem online, essa alternativa Windows não está disponível.
