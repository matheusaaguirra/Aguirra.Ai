# Perguntas como pontos e respostas reutilizáveis

Cada pergunta do histórico carregado é um ponto independente, inclusive repetições e consultas sem resposta. O mapa mostra dez pontos por página, com busca, seleção por toque ou teclado e leitura da resposta e fontes. Respostas reutilizadas ligam o novo ponto ao ponto anterior quando ambos estão na página. As memórias pessoais continuam editáveis abaixo do mapa; o projeto mantém seu registro contínuo, sem criar conversas.

## Resposta rápida

Antes de solicitar uma resposta, o navegador procura uma resposta salva com a mesma pergunta ou uma reformulação conservadora. “O que é memória RAM?”, “Me explique RAM” e “Qual é a definição de RAM?” compartilham a definição. Perguntas sobre função, qualificadores, números ou negações diferentes não são agrupadas só por palavras semelhantes. Não há embeddings ou uma nova API de similaridade.

Visitantes armazenam os pontos no próprio aparelho. Usuários conectados reutilizam o histórico carregado da própria conta e o servidor também confere a correspondência, o contexto e a validade antes de reutilizar. A reprodução pode começar antes de o novo ponto terminar de sincronizar. Falhas de sincronização são avisadas. A antecipação na conta conectada exige um snapshot carregado há menos de um minuto; ao voltar para a aba, dados antigos são atualizados. Cada reutilização autenticada cria seu próprio registro, sem substituir o ponto original.

Respostas gerais elegíveis valem por sete dias. Reutilizar não renova o vencimento. Mudanças no núcleo, desativação da memória, erro, resposta indisponível ou vencimento impedem o reaproveitamento. Consultas reconhecidas como atuais, de notícias, clima, preços, hora, fatos pessoais e contextos dependentes ficam fora dessa reutilização. Essa é uma correspondência local conservadora; perguntas semanticamente próximas com outras palavras podem exigir uma nova geração. A primeira pergunta continua dependendo do tempo dos provedores. “Consultar de novo” ignora o reaproveitamento.

Respostas antigas sem os novos metadados continuam visíveis no mapa, mas precisam ser consultadas uma vez para habilitar o reaproveitamento. O mapa usa os até mil registros carregados pelo histórico atual, com paginação de dez perguntas na tela.

## Áudio no aparelho

Trechos ElevenLabs já gerados ficam também no IndexedDB do navegador, separados entre visitante e cada conta. São no máximo vinte trechos e aproximadamente 8 MB, com prazo de sete dias. A mesma resposta pode ser ouvida após recarregar a página sem gerar outro áudio. O cache segue o texto exato e a revisão da voz; mudanças da voz padrão do servidor exigem atualizar a versão em `audio-cache.js`. Sem IndexedDB ou com armazenamento indisponível, a geração normal continua funcionando. Sair da conta, apagar dados ou esquecer/alterar memórias limpa os áudios correspondentes no aparelho. A resposta em texto também depende do histórico ainda existir.

## Banco e custos

A migração `question_answer_cache` acrescenta apenas `cache_meta` JSONB à tabela existente de mensagens. As mesmas políticas RLS continuam restringindo leitura e escrita ao proprietário. Não há tabela pública de respostas compartilhadas, extensão vetorial, nova assinatura ou novo serviço pago. A voz nova continua exigindo plano ElevenLabs Free, sem excedentes e com créditos disponíveis. As cotas dos provedores continuam ativas.

## Validação

49 testes automatizados: equivalência e diferenças de perguntas, expiração, falhas, mudança de contexto, desativação da memória, respostas sem provedor, persistência da nova pergunta, atualização forçada, um ponto por pergunta, cache de áudio entre carregamentos, isolamento por conta e limites de armazenamento; além das verificações anteriores. ES5, TypeScript e build foram verificados. O teste transacional no Supabase confirmou acesso aos metadados pelo proprietário e isolamento entre duas contas, com rollback de todos os dados temporários.

Os avisos do consultor de segurança permaneceram iguais aos anteriores: tabelas internas sem acesso direto, RPC público protegido por segredo do servidor e configuração de proteção de senhas vazadas. Nenhuma permissão foi ampliada. Referências de manutenção: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable e https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
