# Aguirra sem API paga

O caminho principal é **PC + Ollama + tablet na mesma rede**. O site é uma aplicação web; o tablet não executa o modelo.

| Recurso | Onde funciona | Cobrança de API |
| --- | --- | --- |
| Conversa com IA | Ollama no computador | Nenhuma |
| Núcleo e histórico do modo local | SQLite no computador | Nenhuma |
| Notícias | Feeds RSS públicos da BBC | Nenhuma |
| Visual, mapa e modo econômico | Navegador do tablet | Nenhuma |
| Sincronização online opcional | Supabase Free + Vercel Hobby | Cotas dos planos gratuitos |

Nenhuma chave de IA ou cartão é necessário no modo local. Endpoints de modelos remotos, modelos com nome `cloud` e geração na hospedagem online estão bloqueados pelo código. Os módulos de busca paga foram removidos. A rota de conversa não abre um Workflow para data/hora, memórias ou manchetes.

## Preparar no Windows

1. Instale **Node.js 24.x** de <https://nodejs.org/>.
2. Instale **Ollama** de <https://ollama.com/download>.
3. Baixe ou clone este repositório no computador.
4. Abra `Iniciar-Aguirra.cmd`.

O iniciador instala as dependências, verifica o Ollama, baixa `qwen3:4b` quando necessário e cria o modelo `aguirra-local` com contexto de 8.192 tokens. O download inicial do modelo é de aproximadamente 2,5 GB. Você pode conferir o modelo em <https://ollama.com/library/qwen3:4b>.

Na primeira inicialização, o terminal mostra um **código de acesso** e um endereço como `http://192.168.1.10:3000`. Esse endereço é um exemplo: use exatamente o endereço mostrado no seu computador.

No tablet, conectado à mesma rede Wi-Fi, abra o endereço. Toque no acesso do usuário e informe o código. O PC e o tablet passam a compartilhar o mesmo núcleo salvo no computador.

O código é mostrado uma vez e guardado como hash no computador. Para trocá-lo e encerrar as sessões anteriores:

```bash
npm run local -- --reset-access
```

## Preparar manualmente

```bash
npm ci
ollama pull qwen3:4b
ollama create aguirra-local -f Modelfile
npm run local
```

O Ollama precisa estar aberto. **O computador precisa permanecer ligado** para o tablet conversar com a IA. Não é necessário domínio, VPS, assinatura de IA ou serviço de túnel.

## Rede e tablet

- Se o Windows perguntar sobre a rede, autorize o servidor somente na sua rede privada. Não crie encaminhamento de portas no roteador e não exponha o Ollama à internet.
- Na rede de casa, o endereço HTTP evita depender dos certificados antigos do Android 4.4. O código de acesso protege o aplicativo, mas HTTP não cifra o tráfego: use apenas a sua rede privada confiável.
- O navegador inicia em modo econômico quando detecta Android 4.x. Voz e tela cheia dependem do navegador.
- O IP pode mudar com o roteador; uma reserva DHCP pode manter o mesmo endereço.
- Desempenho e memória variam. `qwen3:4b` é uma escolha inicial pequena; é necessário avaliar a velocidade no seu computador.

## O que a versão online faz

A interface publicada pode guardar memórias no navegador, ou sincronizar a conta nos planos gratuitos já configurados. Ela fornece histórico, mapa e manchetes RSS. **Não executa a IA local do seu computador pela internet.** A conversa local é acessada pelo endereço exibido no terminal. A pesquisa online com Google foi preparada para visitantes sem conta, mas aguarda uma chave gratuita do proprietário; consulte o [guia de ativação](google-gratuito.md).

Vercel Hobby e Supabase Free têm cotas; não foi ativado plano pago nem overage automático neste projeto. Se as cotas gratuitas acabarem, o serviço pode limitar/pausar. Não há contratação automática de capacidade paga pelo aplicativo.

RSS é uma consulta limitada a feeds públicos, não uma busca de toda a web. Há links e horários das publicações. Não verifica cotações, qualquer site ou toda notícia possível. O modelo local também pode errar.

## Voz sintética

Respostas são lidas automaticamente por padrão. Em Configurações você pode escolher uma voz, testar e interromper a leitura. Cada resposta também tem um botão **Ouvir resposta**. O microfone envia a frase reconhecida para a conversa quando o reconhecimento estiver disponível.

A primeira opção é uma voz em português instalada no navegador/aparelho. No modo local do Windows, existe uma alternativa: o PC gera um arquivo WAV com System.Speech e o tablet reproduz o áudio. Essa opção não usa API paga nem exige que o tablet tenha SpeechSynthesis. O computador precisa ter uma voz em português instalada. Você pode selecionar **Voz do meu computador (Windows)** nas configurações.

O Windows sintetiza o áudio em memória. O texto é passado por stdin a um script fixo; não vira comando. Nenhum áudio de resposta é enviado a provedor de voz ou salvo no repositório. Respostas de voz são limitadas a 6.000 caracteres. Navegadores podem exigir um toque inicial para liberar áudio: use Ouvir resposta.

O navegador e a voz instalada no Android 4.4 ainda precisam ser testados no aparelho real. Se o microfone da página não funcionar, a digitação e o ditado do próprio teclado do Android continuam sendo alternativas de entrada.

## Situação da verificação

O código, a memória, o login local, a persistência SQLite, a sintaxe ES5, o isolamento na nuvem e o protocolo de conexão ao modelo são verificados por testes. O protocolo de IA é testado com um servidor local de teste, sem chamada paga. A inferência real com Ollama e a compatibilidade no tablet precisam ser verificadas no computador e no aparelho do usuário.

A opção Google exige um projeto sem faturamento e adesão explícita à cota gratuita. Há limite global de 100 pesquisas/dia na hospedagem, sem fallback pago. A conta do Aguirra é opcional para perguntar; ela serve para sincronizar o núcleo.
