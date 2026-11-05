# Conversa gratuita do Aguirra — atualização de 05/11/2026

O teste real no projeto retornou 404 para Gemini 2.5 Flash-Lite: o Google não libera mais esse modelo a novos usuários. O aplicativo foi adaptado para `gemini-3.5-flash-lite`, com entrada e saída de texto disponíveis no Free Tier. Em alta demanda (HTTP 503), indisponibilidade do modelo (404) ou timeout, há uma única alternativa explícita: gemini-3.1-flash-lite, também gratuita para texto.

A pesquisa integrada Google Search **não** está disponível no Free Tier desse modelo. O aplicativo não chama essa ferramenta nem ativa recursos pagos. Notícias vêm de RSS BBC e consultas enciclopédicas explícitas usam a API pública da Wikipedia. Isso não é uma busca completa do Google nem de toda a web.

## Configuração

No projeto Google, mantenha o nível gratuito **sem Cloud Billing**. Na Vercel, em Production:

| Variável | Valor |
| --- | --- |
| GOOGLE_GENERATIVE_AI_API_KEY | Sua chave, como Secret/Sensitive |
| AGUIRRA_GOOGLE_FREE_CHAT | confirmed-no-billing |

A variável antiga AGUIRRA_GOOGLE_FREE_TIER não libera a nova integração e pode ficar desativada. A chave nunca é enviada ao navegador nem ao GitHub. Faça Redeploy ao mudar variáveis. Não compartilhe a chave no chat.

## Funcionamento e limites

- Perguntas sem conta; histórico e núcleo ficam no navegador. Conta só para sincronização.
- O contexto inclui até seis mensagens recentes e memórias relevantes. Perguntas não viram preferências.
- Uma resposta sem documento consultado recebe o aviso “Resposta da IA, sem pesquisa verificada na web”. Ela pode errar e não representa checagem factual.
- Fontes só entram na lista se vierem dos documentos realmente consultados. Não se utilizam URLs inventadas pelo modelo.
- Preços, clima e outros fatos atuais sem fonte recebem uma limitação explícita. Notícias podem ser resumidas apenas a partir dos títulos e descrições do RSS, sem alegar leitura integral das matérias.
- Se a IA falhar durante notícias, as manchetes RSS continuam disponíveis.
- São até 100 chamadas de geração por dia para o projeto inteiro e 30 pedidos/hora por rede de visitante. O provedor pode impor limites menores. Não há repetição automática no mesmo modelo nem troca para modelo pago. A alternativa gratuita só é tentada uma vez em falhas temporárias/indisponibilidade; nunca em erro de cota (429), chave (401) ou permissão (403). Cada tentativa consome a cota global.
- O limite do aplicativo não garante gratuidade de uma conta paga: mantenha o projeto Google sem faturamento. O programa não consegue verificar o estado de cobrança usando apenas uma chave.
- O Free Tier pode usar dados para melhorar produtos, conforme termos do Google. Evite conteúdo confidencial.
- Voz usa o navegador; o Windows local oferece áudio sintético alternativo, inclusive para visitantes. O teste no tablet Android 4.4 continua necessário.

## Referências oficiais

- Preços: https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite
- Modelo: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
- Restrições dos modelos antigos: https://ai.google.dev/gemini-api/docs/deprecations
- API pública de conhecimento: https://www.mediawiki.org/wiki/API:Search

Os preços e permissões podem mudar; não ative faturamento para contornar uma falha de cota ou disponibilidade.
