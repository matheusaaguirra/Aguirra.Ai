# Ativar “Continuar com Google” no Aguirra

O botão e o fluxo do aplicativo estão implementados. A verificação atual do Supabase retorna Google desativado. A ativação requer um **Client ID OAuth e Client Secret**, diferentes da chave do Gemini já salva. Não envie esses segredos no chat.

## 1. Criar as credenciais OAuth no Google

Abra https://console.cloud.google.com/auth/overview e selecione o projeto Aguirra AI. Configure nome do aplicativo, e-mail de suporte e público externo. Use apenas os escopos básicos openid, e-mail e perfil. Não habilite APIs de dados privados, Gmail ou cobrança.

Em Clients → Create client → Web application, preencha:

| Campo | Valor |
| --- | --- |
| Nome | Aguirra Web |
| Authorized JavaScript origins | https://aguirra-ai.vercel.app |
| Authorized redirect URIs | https://wfgibbqcxptjqdgbbjhs.supabase.co/auth/v1/callback |

Salve o Client ID e o Client Secret. Se a aplicação ficar em Testing, adicione seu e-mail como test user; outras contas só poderão entrar conforme o público e o status de publicação configurados no Google. Não há solicitação de acesso a Gmail, Drive ou outros dados pessoais além da identidade básica.

## 2. Configurar o Supabase

Abra https://supabase.com/dashboard/project/wfgibbqcxptjqdgbbjhs/auth/providers e escolha Google. Habilite o provedor e cole Client ID e Client Secret nos respectivos campos. Mantenha as verificações de segurança padrão; não ative Skip nonce check. Salve.

Em Authentication → URL Configuration:

| Campo | Valor |
| --- | --- |
| Site URL | https://aguirra-ai.vercel.app |
| Redirect URLs — adicionar exatamente | https://aguirra-ai.vercel.app/api/google-callback |

Não use a URL de callback do aplicativo como redirect URI do cliente Google: o Google primeiro retorna ao Supabase; depois o Supabase retorna ao aplicativo.

## 3. Testar

Espere até um minuto para a atualização de disponibilidade e recarregue o Aguirra. Abra seu espaço e toque em Continuar com Google. Escolha a conta na página oficial do Google e conclua o consentimento.

Ao voltar ao Aguirra, o rodapé deve mostrar a conta conectada. Guarde uma memória, entre com a mesma conta em outro navegador e confirme a sincronização. Uma segunda conta não deve enxergar dados da primeira. Saia para verificar que o núcleo do visitante continua separado no navegador.

## Proteções implementadas

O início do fluxo exige POST com Origin válido. O servidor usa PKCE S256 e guarda o verificador em cookie HttpOnly, Secure, SameSite=Lax com validade curta. O callback troca o código no servidor e cria os cookies de sessão já usados pelo aplicativo. Não há tokens na URL final, tokens em localStorage nem Client Secret no frontend. O retorno é fixo para a origem pública autorizada; parâmetros next arbitrários não são aceitos. A conta continua opcional para conversar. O modo Windows local mantém seu acesso próprio por código.

## Estado de verificação

Os testes do protocolo usam respostas simuladas e verificam desafio PKCE, troca de código, cookies, bloqueio de origem externa e callback sem verificador. O login real não foi concluído: faltam as credenciais OAuth e a ativação do provedor no Supabase. O conector disponível não oferece edição dessas configurações de autenticação; os campos acima devem ser preenchidos no painel pelo proprietário.

Documentação oficial: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
