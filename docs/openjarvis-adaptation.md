# Adaptação inspirada no OpenJarvis

O [OpenJarvis](https://github.com/open-jarvis/OpenJarvis) é um framework de IA pessoal com foco em execução local. Ele oferece agentes, memória com recuperação, telemetria por inferência e benchmarks de latência e vazão.

O Aguirra mantém sua própria arquitetura TypeScript + eve + Ollama + SQLite/Supabase. Em vez de introduzir uma segunda aplicação Python ou trocar o runtime, esta adaptação aproveita ideias compatíveis com a base existente.

## O que foi aplicado

### Recuperação de memória por relevância

A função `relevant()` em `agent/lib/memory.ts` agora usa um ranking lexical no estilo BM25:

- Termos raros e específicos pesam mais do que palavras frequentes.
- A frequência de um termo e o tamanho da memória influenciam a pontuação.
- Perfil e preferências continuam disponíveis como contexto geral, mas com peso menor do que uma correspondência direta.
- Não há embeddings, download de modelos adicionais ou dependências Python.

Isso melhora a seleção de memórias sem transferir dados pessoais para outro serviço.

### Benchmark da inferência local

O comando `npm run bench:local` consulta a API nativa do Ollama em localhost e mede:

- Latência média, p50, p95, mínima e máxima.
- Tokens de saída por segundo e tokens de entrada por segundo, quando o Ollama fornece essas métricas.
- Quantidade média e total de tokens de saída.

O benchmark faz uma chamada de aquecimento antes das amostras. Ele não guarda prompts ou respostas, não consulta APIs externas e não estima consumo de energia sem instrumentação de hardware.

## Como executar no Windows

Com o Ollama aberto e o modelo do Aguirra já instalado:

```powershell
npm run bench:local
```

Para mais amostras e saída estruturada:

```powershell
npm run bench:local -- --samples 10 --json
npm run bench:local -- --samples 10 --output .aguirra/benchmark.json
```

Também é possível testar outro modelo que já esteja instalado:

```powershell
npm run bench:local -- --model qwen3:4b --samples 5
```

A URL configurada em `OLLAMA_BASE_URL` pode terminar em `/v1`, como no adaptador do Aguirra. O benchmark usa a API nativa `/api/generate`, mas aceita somente HTTP em `localhost`, `127.0.0.1` ou `::1`.

## Como comparar resultados

Compare modelos no mesmo computador, com o mesmo número de amostras e sem outras inferências concorrentes. O p50 representa a experiência típica; o p95 ajuda a identificar travamentos ou variações. Tokens por segundo mede vazão, não qualidade da resposta.

Uma execução curta é útil para triagem. Use 10 ou mais amostras para comparações mais consistentes. Faça uma nova execução após alterar o modelo, quantização ou parâmetros do Ollama.

## Limites e decisões

- O OpenJarvis completo não é uma dependência do Aguirra: seus módulos são Python e exigiriam outro runtime e uma integração entre processos.
- Nenhum modelo cloud, API paga, ferramenta de shell ou permissão adicional foi habilitado.
- O benchmark mede o que o Ollama expõe. Não mede watts, temperatura ou VRAM.
- As métricas são agregadas e não incluem textos de conversas, respostas, memórias, IDs de usuários ou credenciais.

Referências: [repositório OpenJarvis](https://github.com/open-jarvis/OpenJarvis), [telemetria e traces](https://github.com/open-jarvis/OpenJarvis/blob/main/docs/user-guide/telemetry.md), [benchmarks](https://github.com/open-jarvis/OpenJarvis/blob/main/docs/user-guide/benchmarks.md) e [memória](https://github.com/open-jarvis/OpenJarvis/blob/main/docs/user-guide/memory.md).
