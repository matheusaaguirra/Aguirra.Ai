# Mapa cerebral

Cada pergunta do histórico tem um ponto. Uma resposta bem-sucedida forma uma memória de resposta. Perguntas equivalentes com o mesmo texto de resposta podem apontar para a mesma memória. As notas pessoais aparecem separadamente. A miniatura da Central usa os dados do próprio núcleo.

O mapa agrupa os pontos por assunto. Toque no assunto para filtrar, arraste o fundo para navegar e use os controles de zoom. Abra uma pergunta ou memória para ler a resposta, ver as fontes, ouvir ou consultar de novo. A visualização mostra até 60 perguntas por página do histórico carregado.

A recuperação considera a pergunta, a validade da resposta e o contexto atual do núcleo. Uma reformulação reconhecida pode reutilizar uma resposta válida. Uma pergunta com outra intenção pode receber até três pontos relacionados como contexto para uma nova geração. Os registros antigos aparecem no grafo mesmo quando precisam de nova consulta para habilitar o reaproveitamento. Notícias e dados mutáveis exigem informação atual.

## Persistência na web

Contas Google usam o histórico privado no Supabase e podem acessar o mesmo núcleo em vários aparelhos. Visitantes usam um núcleo privado no Supabase identificado por um cookie de sessão. Apagar o cookie encerra o acesso daquele navegador ao núcleo de visitante. Preferências de interface continuam no aparelho. Perguntas, respostas, notas e áudios têm persistência na nuvem.

O histórico local de versões anteriores pode ser importado pelo navegador onde foi criado. O visitante inicia a importação ao abrir a aplicação. Com login, a opção fica em Configurações. Após confirmação do servidor, a aplicação remove a cópia antiga do histórico do navegador. Uma importação interrompida pode ser repetida.

Os trechos de voz reutilizáveis ficam no Supabase, separados por núcleo, com limite de vinte trechos, cerca de 8 MB e validade de sete dias. A geração de novos trechos segue a verificação do plano ElevenLabs Free. Para uma instalação nova, aplique também as migrações do diretório supabase/migrations.
