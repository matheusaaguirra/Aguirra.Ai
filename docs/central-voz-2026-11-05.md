# Central com esfera, voz e legendas

- As respostas permanecem na Central. O menu Conversas foi removido e o histórico reabre a resposta junto da esfera.
- O texto não recebe mais o cabeçalho “Resposta da IA, sem pesquisa verificada na web” ou “Consulta a fontes públicas”. As fontes efetivamente consultadas continuam disponíveis em “Resposta completa e fontes”. Isso não adiciona pesquisa Google nem transforma uma resposta sem fontes em informação verificada.
- A esfera muda de movimento e brilho durante processamento, escuta e fala. O estado de fala acompanha os eventos do sintetizador; a animação não é uma análise da amplitude do áudio.
- O texto aparece abaixo da esfera, por frase durante a leitura. Ao terminar ou parar, a resposta completa volta a ficar visível. Há controles para ouvir novamente, parar e iniciar outra conversa.
- A seleção automática prioriza vozes em português brasileiro e opções identificadas como Natural, Neural ou Google, quando disponíveis. Tom e velocidade voltaram ao padrão da voz; as frases são enfileiradas separadamente para evitar leitura longa contínua. Uma escolha manual prevalece.
- Sem serviço de TTS pago ou novas credenciais. A qualidade depende das vozes disponíveis no aparelho e navegador. Navegadores sem voz compatível mantêm o texto e mostram orientação. O fallback Windows continua restrito ao modo local.
- Compatibilidade sintática ES5 preservada. Modo econômico mantém a esfera parada em repouso e reduz a frequência de desenho quando ativa; preferência por movimento reduzido é respeitada.

Validação: 26 testes automatizados, checagem ES5, TypeScript e build de produção passaram. No navegador de prévia foram verificados envio sem navegação para chat, legenda, resposta completa e abertura pelo histórico. Seleção de voz, eventos de fala/legenda, cancelamento, bloqueio de autoplay e fallback foram testados com simuladores. Este ambiente de navegador não tem voz portuguesa instalada; a qualidade audível no tablet Android 4.4 e no Windows precisa ser conferida nesses aparelhos.
