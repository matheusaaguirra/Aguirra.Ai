<div align="center">

<img src="public/icon.svg" width="84" alt="Aguirra">

# Aguirra

**Uma mente ao seu lado.**

Assistente pessoal web com conversas, pesquisa e um núcleo de memória que você pode entender, editar e esquecer.

`TypeScript` · `eve` · `Supabase` · `AI Gateway` · `JavaScript ES5`

</div>

---

## O que já existe

- Central com núcleo visual em Canvas 2D, relógio e contexto da memória.
- Conversas e histórico pesquisável.
- Mapa cerebral interativo, com categorias e memórias reais; sem dados pessoais de exemplo pré-carregados.
- Formação conservadora de memórias por declarações explícitas: `Prefiro respostas curtas`, `Meu nome é…`, `Meu objetivo é…`, `Lembre que…`.
- Criação, edição, exclusão, importação de memórias locais e exportação JSON dos dados carregados.
- Conta e sincronização na nuvem pelo Supabase, com isolamento por usuário.
- Agente no servidor com pesquisa web nativa via AI Gateway e ferramenta de data/hora.
- Interface leve, modo econômico e melhorias opcionais de voz e tela cheia.

**Sem login**, a memória e o histórico funcionam neste navegador. As respostas locais são limitadas a memória, data/hora e orientações de uso. Conversa generativa e pesquisa exigem conta e integração de IA ativa; não há respostas fictícias de demonstração.

## Memória, de verdade

Todo pedido é histórico. Uma declaração útil pode virar núcleo. Uma pergunta sobre um assunto aumenta sua frequência, mas não vira uma crença ou preferência sua.

O Aguirra recupera contexto para responder melhor. Isso **não retreina os pesos do modelo**. Alguns padrões de credenciais e dados sensíveis são bloqueados na extração; isso não é um detector universal de dados pessoais.

Veja o [mapa da arquitetura, fluxo da memória e decisões técnicas](docs/architecture.md).

## Rodar

Requer Node.js **24.x** e npm.

```bash
npm ci
cp .env.example .env.local
# Preencha .env.local com os valores do seu projeto.
npm run dev
```

Frontend: `http://localhost:3000`. O script inicia o agente na porta 2000 e mantém a API na mesma origem.

### Banco

Crie um projeto Supabase dedicado e aplique [database/schema.sql](database/schema.sql). A aplicação usa `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` e o token do usuário autenticado; nenhuma chave administrativa é necessária.

Configure no painel de Auth o Site URL para a origem publicada. A confirmação de e-mail segue a configuração do Supabase. Não use dados do WealthOS ou de outro aplicativo como fixtures deste projeto.

### IA e implantação

O modelo inicial é o padrão de eve e fica em [agent/agent.ts](agent/agent.ts). Confira o catálogo atual e o orçamento antes de trocá-lo. Na Vercel, a IA usa OIDC do projeto. No desenvolvimento local, configure `AI_GATEWAY_API_KEY` de modo seguro.

```bash
npm run typecheck
npm test
npm run build
```

Fora da Vercel, o build produz o servidor de auto-hospedagem. Na Vercel, produz Build Output e exige as credenciais de implantação do projeto. Não force `VERCEL=1` sem um projeto vinculado e credenciais válidas.

Planos gratuitos e créditos de teste têm limites. Não há promessa de IA ou pesquisa ilimitadas sem custo. Cotas do aplicativo não substituem um orçamento do provedor.

## Android 4.4

O frontend usa JavaScript ES5, XMLHttpRequest, SVG e Canvas 2D. O modo econômico é recomendado e ativado inicialmente no Android 4.x. Angular moderno, WebGL e SDKs recentes não são dependências do tablet.

**É necessário testar no tablet real.** Navegador, certificados HTTPS/TLS e desempenho podem impedir recursos mesmo com código compatível. Voz e tela cheia são opcionais; digitação permanece disponível.

## Verificação

- `npm test`: extração, bloqueio de credenciais/hipóteses, recuperação, paridade entre cliente e servidor, cookies e origem de pedidos.
- [tests/rls.sql](tests/rls.sql): isolamento de usuários, escrita cruzada, vínculo da conversa, cota atômica e exclusão. Fixtures transacionais são revertidas.
- Inspeção visual e teste de persistência local no navegador.

Limitações atuais, incluindo paginação e consolidação de preferências conflitantes: [arquitetura](docs/architecture.md).

---

Feito por **Matheus Aguirra**.
