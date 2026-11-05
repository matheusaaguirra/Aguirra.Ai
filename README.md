<div align="center">

<img src="public/icon.svg" width="84" alt="Aguirra">

# Aguirra

**Uma mente ao seu lado.**

Assistente pessoal web com conversas, pesquisa e um núcleo de memória que você pode entender, editar e esquecer.

`Ollama local` · `TypeScript` · `SQLite` · `Supabase Free` · `JavaScript ES5`

</div>

---

![Central do Aguirra](docs/aguirra-preview.jpg)

## O que já existe

- Central com núcleo visual em Canvas 2D, relógio e contexto da memória.
- Conversas e histórico pesquisável.
- Mapa cerebral interativo, com categorias e memórias reais; sem dados pessoais de exemplo pré-carregados.
- Formação conservadora de memórias por declarações explícitas: `Prefiro respostas curtas`, `Meu nome é…`, `Meu objetivo é…`, `Lembre que…`.
- Criação, edição, exclusão, importação de memórias locais e exportação JSON dos dados carregados.
- Conta e sincronização na nuvem pelo Supabase, com isolamento por usuário.
- IA local no computador com Ollama; nenhum endpoint de modelo pago.
- Perguntas sem conta, contexto por navegador e ferramenta de data/hora.
- Pesquisa opcional com Google e fontes verificáveis; manchetes RSS enquanto a chave não é configurada.
- Interface em tons roxos, ícones vetoriais e marca provisória em quadrado vazio.
- Voz sintética automática em português, seletor de voz e botão Ouvir resposta. O Windows local pode gerar áudio WAV para navegadores antigos, sem API paga.
- Modo econômico e tela cheia quando suportados pelo navegador.

**Sem login**, a memória e o histórico funcionam neste navegador. As respostas locais são limitadas a memória, data/hora e orientações de uso. A conversa completa roda no computador com Ollama, acessada pelo endereço local; não há respostas fictícias de demonstração.

## Memória, de verdade

Todo pedido é histórico. Uma declaração útil pode virar núcleo. Uma pergunta sobre um assunto aumenta sua frequência, mas não vira uma crença ou preferência sua.

O Aguirra recupera contexto para responder melhor. Isso **não retreina os pesos do modelo**. Alguns padrões de credenciais e dados sensíveis são bloqueados na extração; isso não é um detector universal de dados pessoais.

Veja o [mapa da arquitetura, fluxo da memória e decisões técnicas](docs/architecture.md).

## Rodar sem API paga

No Windows, instale **Node.js 24.x** e **Ollama**, baixe este repositório e abra **Iniciar-Aguirra.cmd**.

O terminal mostra o código de acesso e o endereço para abrir no tablet, na mesma rede do computador.

```bash
npm ci
ollama pull qwen3:4b
ollama create aguirra-local -f Modelfile
npm run local
```

**O PC precisa ficar ligado.** O tablet apresenta a interface; o modelo e o SQLite ficam no computador. Nenhuma chave de IA ou cartão é necessário. O download inicial do modelo tem aproximadamente 2,5 GB.

O [guia sem custo](docs/sem-custo.md) explica instalação, rede, código de acesso e limites. O Ollama permanece restrito ao computador. A integração opcional com Gemini usa um projeto gratuito sem faturamento, conforme o [guia de ativação](docs/google-gratuito.md). Não há fallback para uma API paga.

### Hospedagem online opcional

A versão online aceita perguntas sem conta, com histórico e núcleo separados por navegador, além de manchetes RSS. A conversa usa Gemini 3.5 Flash-Lite gratuito; fontes públicas vêm de Wikipedia e RSS. A pesquisa integrada do Google fica desativada para evitar o recurso pago; veja [como ativar](docs/google-gratuito.md). A sincronização usa o Supabase Free e a hospedagem Vercel Hobby, respeitando suas cotas. Sem a chave e AGUIRRA_GOOGLE_FREE_CHAT=confirmed-no-billing, a geração de IA fica desativada na hospedagem. O aplicativo não faz upgrade automático de planos.

Para reproduzir a sincronização, use um projeto Supabase dedicado e aplique [database/schema.sql](database/schema.sql). A aplicação usa apenas a chave publicável e o token do usuário, preservando RLS; não utiliza chave administrativa. Configure o Site URL de Auth para a origem publicada.

### Verificar

```bash
npm run typecheck
npm test
npm run build
```

O build produz o servidor local fora da Vercel. Na Vercel, produz o Build Output. Não force VERCEL=1 sem um projeto vinculado e as credenciais de implantação.

## Android 4.4

O frontend usa JavaScript ES5, XMLHttpRequest, SVG e Canvas 2D. O modo econômico é recomendado e ativado inicialmente no Android 4.x. Angular moderno, WebGL e SDKs recentes não são dependências do tablet.

**É necessário testar no tablet real.** Navegador, certificados HTTPS/TLS e desempenho podem impedir recursos mesmo com código compatível. Voz e tela cheia são opcionais; digitação permanece disponível.

## Verificação

- `npm test`: extração, bloqueio de credenciais/hipóteses, recuperação, paridade entre cliente e servidor, cookies e origem de pedidos.
- [tests/rls.sql](tests/rls.sql): isolamento de usuários, escrita cruzada, vínculo da conversa, cota atômica e exclusão. Fixtures transacionais são revertidas.
- Testes de código de acesso, SQLite, RSS e bloqueio de modelos externos.
- Protocolo do adaptador Ollama verificado com servidor local de teste; nenhuma API paga.
- Sintaxe ES5 verificada automaticamente e persistência inspecionada no navegador.

Limitações atuais, incluindo paginação e consolidação de preferências conflitantes: [arquitetura](docs/architecture.md).

---

Feito por **Matheus Aguirra**.

### Verificação pública sem conta

`node scripts/smoke-guest.mjs` verifica o chat anônimo, núcleo enviado pelo navegador, notícias reais com fontes, proteção de dados de contas, validação de origem e limite de tamanho. A verificação em 05/11/2026 passou com fontes RSS reais; Google permanece pendente da chave gratuita do proprietário. Os 21 testes automatizados e a checagem ES5 também passaram.

![Conversa sem conta, com memória neste navegador](docs/aguirra-guest-preview.jpg)

### Atualização de 05/11/2026

Conversa gratuita com Gemini 3.5 Flash-Lite e alternativa explícita Gemini 3.1 Flash-Lite em indisponibilidade temporária. Google Search pago não é chamado. Fontes vêm de Wikipedia e RSS; respostas sem verificação são identificadas. O botão de entrada Google foi implementado, mas a ativação do provedor exige credenciais OAuth próprias no Supabase, conforme o [guia](docs/login-google.md). Veja o [relatório de adaptação](docs/relatorio-adaptacao-2026-11-05.md). São 24 testes automatizados aprovados, além da validação de tipos e ES5.
