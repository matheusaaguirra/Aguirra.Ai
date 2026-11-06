# Aguirra: voz ElevenLabs e microfone

Aguirra usa um registro contínuo de perguntas e respostas, com memória revisável. Não há tela de chat, botão de nova conversa ou lista de conversas. O histórico antigo é preservado. O banco mantém um único contêiner técnico por proprietário na tabela já existente; novas perguntas reutilizam esse contêiner.

## Configuração aplicada e manutenção

A chave já está configurada em produção. Os passos abaixo documentam a configuração e servem para uma futura rotação.

1. Na conta ElevenLabs, mantenha o plano **Free** e a cobrança por excedente desativada. O uso gratuito tem uma cota, não é ilimitado.
2. Crie uma chave no painel do ElevenLabs. Ela precisa de acesso a **Text to Speech**, **Speech to Text** e leitura de **User/Subscription**, usada para verificar o plano antes de gerar áudio.
3. Em Vercel → projeto **aguirra-ai** → Settings → Environment Variables, crie `ELEVENLABS_API_KEY` como **Secret/Sensitive**, para **Production**, e cole o valor da chave. Não coloque a chave em código público ou no chat.
4. Opcional: crie `ELEVENLABS_VOICE_ID` como Config com o ID de uma voz da sua conta. O padrão é George, usado no exemplo oficial, com Flash v2.5 para a conversa em português e Multilingual v2 quando há números, datas ou valores, preservando a leitura desses trechos no plano Free. Escolha uma voz brasileira da biblioteca se quiser outro timbre ou sotaque.
5. Faça **Redeploy**. Em Configurações do Aguirra, selecione **ElevenLabs · voz natural** e toque em **Testar voz**.

O servidor consulta `/v1/user/subscription` antes de cada geração. Só aceita `tier=free`, excedentes desativados e créditos disponíveis. Plano pago, cota esgotada ou falha na verificação bloqueiam a geração. O Aguirra não muda de plano nem tenta um provedor pago. Repetir um dos dois últimos trechos no mesmo carregamento usa o áudio em memória, sem gerar novamente.

ElevenLabs foi ativado em produção em 05/11/2026. A chave exclusiva do Aguirra foi salva como Secret somente em Production, com acesso a Text to Speech, Speech to Text e consulta do plano, limite de 10.000 créditos por período e desativação automática em caso de vazamento. A conta permaneceu no plano Free; nenhum plano pago ou excedente foi contratado. A transferência foi realizada diretamente entre os painéis, sem arquivo intermediário de credencial.

## Microfone

- Abra o domínio **HTTPS**, permita o microfone e toque para começar. Toque novamente para concluir; a pergunta reconhecida é enviada uma vez.
- O texto aparece no campo enquanto você fala. **Cancelar escuta** interrompe sem enviar a pergunta. Ao ocultar a página, a captura é encerrada.
- Permissão negada, microfone ausente/ocupado, silêncio, falha de rede e navegador sem reconhecimento têm mensagens diferentes.
- Quando o navegador não tem reconhecimento ou o serviço dele falha por rede, a alternativa captura WAV mono de até **20 segundos** e transcreve com Scribe v2. Essa alternativa depende da chave ElevenLabs e do suporte a captura de áudio do navegador.
- No Android 4.4, APIs de voz, permissões, certificados e reprodução MP3 dependem do navegador instalado. A sintaxe ES5 foi validada; isso não equivale a teste físico no tablet.

## Animação e legendas

As órbitas foram substituídas por barras de áudio com transição gradual, brilho discreto e movimento simétrico. No áudio ElevenLabs, um analisador Web Audio lê o sinal reproduzido. Na captura alternativa, lê o microfone. Se a API não fornecer o sinal, a animação usa uma variação visual suave ligada ao estado de fala, sem afirmar que mede o volume real. Modo econômico e movimento reduzido são respeitados.

As legendas ElevenLabs usam o alinhamento temporal retornado pelo serviço. Na Central, aparecem discretamente junto ao campo de entrada apenas durante a fala e somem ao terminar ou interromper o áudio. A pergunta repetida, o status visual de repouso e os controles de resposta foram retirados do centro. O Histórico permite expandir cada pergunta para ler a resposta completa, consultar fontes e ouvir novamente sem mudar de tela. A reprodução usa MP3 por Blob, permitido explicitamente pela política de mídia da página. A chave fica somente no servidor.

## Validação

38 testes automatizados passaram: plano gratuito e cotas, gravações inválidas/longas, cancelamento, texto parcial/final, encerramento dos tracks, cache e alinhamento de legendas, histórico contínuo, memória e isolamento existentes. TypeScript, ES5 e build passaram. Na prévia foram verificados envio, legenda, histórico por pergunta, ausência de nova conversa e diagnóstico HTTPS do microfone. Os testes automatizados do serviço ElevenLabs usam respostas simuladas. Após ativar a chave, também foi feito um teste real de geração e transcrição, consumindo apenas a cota gratuita. Captura física e qualidade de áudio no tablet não foram verificadas neste ambiente.

Referências oficiais:
- https://elevenlabs.io/docs/eleven-api/quickstart
- https://elevenlabs.io/docs/api-reference/user/subscription/get
- https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps/
- https://elevenlabs.io/docs/api-reference/speech-to-text/convert
- https://elevenlabs.io/pricing/api

Produção: o deploy `dpl_6cwUokBKTSxmTuDNFAkaT8ZhcD3g` ficou READY em https://aguirra-ai.vercel.app/, carregando o Secret de produção. A interface reconheceu ElevenLabs disponível e concluiu a reprodução em Testar voz. Um teste pela API gerou MP3 de 75.275 bytes, com 4,64 segundos e alinhamento temporal; o arquivo foi convertido para WAV mono de 16 kHz e transcrito pelo Scribe v2. A frase foi reconhecida, com variações ortográficas nos nomes próprios. Esse teste valida geração, decodificação e transcrição, sem equivaler a avaliação auditiva ou captura física no tablet. A consulta do plano gratuito passou antes das chamadas reais. Registro visual: `aguirra-elevenlabs-ativo-2026-11-05.jpg`.


## Identidade e espera pela resposta — 06/11/2026

Perguntas diretas como “quem é você?”, “quem te criou?” e “de onde você é?” apresentam Aguirra e Matheus Almeida Guirra, sem pesquisa nem geração pelo modelo. Visitantes recebem essas respostas no próprio navegador; usuários conectados mantêm o registro no histórico contínuo, com leitura de contexto dispensada nesse caso. Os prompts de geração e as instruções do agente usam a mesma identidade. Perguntas explícitas sobre a tecnologia continuam recebendo informação transparente sobre o modelo usado pelo projeto.

A voz começa assim que a resposta chega, enquanto o histórico sincroniza em paralelo. As respostas geradas seguem duas a quatro frases por padrão, com mais detalhes quando solicitados. A consulta opcional à Wikipédia tem prazo de 2,5 segundos; falhas são reutilizadas por 30 segundos para evitar repetir a mesma espera. Fontes só são exibidas se realmente retornadas pela consulta. O Flash v2.5 usa português explícito; datas e números permanecem no Multilingual v2 porque a normalização do Flash exigiria Enterprise. Não foi ativado plano pago, normalização Enterprise, pesquisa paga ou cobrança por excedentes.

Antes da mudança, uma medição pública em produção levou 12,15 s para “Quem é você?”, 8,27 s para “De onde você é?” e 7,77 s para gerar o áudio de “Olá. Eu sou o Aguirra, seu assistente pessoal.”. São amostras isoladas, sujeitas a rede, inicialização do servidor e disponibilidade dos serviços. Os testes de identidade verificam que histórico e memórias não sobrescrevem a marca, e que perguntas sobre fornecedores e assuntos diferentes não são capturadas como apresentações.
