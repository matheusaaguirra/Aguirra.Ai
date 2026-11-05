# Aguirra: voz ElevenLabs e microfone

Aguirra usa um registro contínuo de perguntas e respostas, com memória revisável. Não há tela de chat, botão de nova conversa ou lista de conversas. O histórico antigo é preservado. O banco mantém um único contêiner técnico por proprietário na tabela já existente; novas perguntas reutilizam esse contêiner.

## Ativar ElevenLabs sem contratar plano

1. Na conta ElevenLabs, mantenha o plano **Free** e a cobrança por excedente desativada. O uso gratuito tem uma cota, não é ilimitado.
2. Crie uma chave no painel do ElevenLabs. Ela precisa de acesso a **Text to Speech**, **Speech to Text** e leitura de **User/Subscription**, usada para verificar o plano antes de gerar áudio.
3. Em Vercel → projeto **aguirra-ai** → Settings → Environment Variables, crie `ELEVENLABS_API_KEY` como **Secret/Sensitive**, para **Production**, e cole o valor da chave. Não coloque a chave em código público ou no chat.
4. Opcional: crie `ELEVENLABS_VOICE_ID` como Config com o ID de uma voz da sua conta. O padrão é George, usado no exemplo oficial, com modelo multilíngue. Escolha uma voz brasileira da biblioteca se quiser outro timbre ou sotaque.
5. Faça **Redeploy**. Em Configurações do Aguirra, selecione **ElevenLabs · voz natural** e toque em **Testar voz**.

O servidor consulta `/v1/user/subscription` antes de cada geração. Só aceita `tier=free`, excedentes desativados e créditos disponíveis. Plano pago, cota esgotada ou falha na verificação bloqueiam a geração. O Aguirra não muda de plano nem tenta um provedor pago. Repetir um dos dois últimos trechos no mesmo carregamento usa o áudio em memória, sem gerar novamente.

A integração já está implementada. A chave ElevenLabs ainda não estava configurada na Vercel nesta revisão; por isso não houve geração real nem avaliação audível desse serviço. Enquanto ela não for cadastrada, o aplicativo informa a pendência e pode usar a voz disponível no aparelho como alternativa.

## Microfone

- Abra o domínio **HTTPS**, permita o microfone e toque para começar. Toque novamente para concluir; a pergunta reconhecida é enviada uma vez.
- O texto aparece no campo enquanto você fala. **Cancelar escuta** interrompe sem enviar a pergunta. Ao ocultar a página, a captura é encerrada.
- Permissão negada, microfone ausente/ocupado, silêncio, falha de rede e navegador sem reconhecimento têm mensagens diferentes.
- Quando o navegador não tem reconhecimento ou o serviço dele falha por rede, a alternativa captura WAV mono de até **20 segundos** e transcreve com Scribe v2. Essa alternativa depende da chave ElevenLabs e do suporte a captura de áudio do navegador.
- No Android 4.4, APIs de voz, permissões, certificados e reprodução MP3 dependem do navegador instalado. A sintaxe ES5 foi validada; isso não equivale a teste físico no tablet.

## Animação e legendas

As órbitas foram substituídas por barras de áudio com transição gradual, brilho discreto e movimento simétrico. No áudio ElevenLabs, um analisador Web Audio lê o sinal reproduzido. Na captura alternativa, lê o microfone. Se a API não fornecer o sinal, a animação usa uma variação visual suave ligada ao estado de fala, sem afirmar que mede o volume real. Modo econômico e movimento reduzido são respeitados.

As legendas ElevenLabs usam o alinhamento temporal retornado pelo serviço. A reprodução usa MP3 por Blob, permitido explicitamente pela política de mídia da página. A chave fica somente no servidor.

## Validação

35 testes automatizados passaram: plano gratuito e cotas, gravações inválidas/longas, cancelamento, texto parcial/final, encerramento dos tracks, cache e alinhamento de legendas, histórico contínuo, memória e isolamento existentes. TypeScript, ES5 e build passaram. Na prévia foram verificados envio, legenda, histórico por pergunta, ausência de nova conversa e diagnóstico HTTPS do microfone. Testes do serviço ElevenLabs usam respostas simuladas, sem consumir créditos. Captura física e qualidade de áudio no tablet não foram verificadas neste ambiente.

Referências oficiais:
- https://elevenlabs.io/docs/eleven-api/quickstart
- https://elevenlabs.io/docs/api-reference/user/subscription/get
- https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps/
- https://elevenlabs.io/docs/api-reference/speech-to-text/convert
- https://elevenlabs.io/pricing/api

Produção: o deploy `dpl_CVWNjUWCD47x7caG3Z54XuGg19g6` ficou READY em https://aguirra-ai.vercel.app/. Uma pergunta real sobre som retornou resposta coerente pela rota `/api/ask`; outra pergunta de horário apareceu separadamente no histórico, e a primeira foi reaberta na Central. A tela confirmou ElevenLabs aguardando configuração. Em HTTPS, o botão do microfone entrou na etapa de solicitar permissão e ofereceu cancelar; não houve captura física validada. A mensagem de erro foi ajustada para permanecer visível após o encerramento do reconhecimento. Políticas de propriedade e restrições das tabelas existentes foram conferidas por consultas de metadados no Supabase; não houve alteração de schema ou RLS.
