# Recuperação de senha

A API implementa recuperação de senha sem revelar se um endereço pertence a uma conta.

## Endpoints

### `POST /api/auth/forgot-password`

Corpo:

```json
{
  "email": "usuario@email.com"
}
```

Resposta HTTP 200, igual para contas existentes e inexistentes:

```json
{
  "message": "Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação."
}
```

O endpoint aceita no máximo 5 solicitações por IP a cada 15 minutos. Para uma conta ativa, a API gera 32 bytes aleatórios com `node:crypto`, guarda somente o hash SHA-256 e define expiração de 30 minutos. Uma nova solicitação invalida tokens anteriores ainda abertos.

### `POST /api/auth/reset-password`

Corpo:

```json
{
  "token": "token-recebido-no-email",
  "password": "nova-senha",
  "passwordConfirmation": "nova-senha"
}
```

Em caso de sucesso:

```json
{
  "message": "Senha redefinida com sucesso."
}
```

Token inexistente, expirado ou já utilizado retorna HTTP 400 com a mesma mensagem genérica de token inválido. A nova senha é armazenada com bcrypt, custo 12. Depois da alteração, todos os tokens abertos do usuário são invalidados.

## Link enviado

O serviço monta o endereço exatamente no formato:

```text
FRONTEND_URL/reset-password?token=TOKEN
```

`FRONTEND_URL` deve conter somente a origem do front-end, por exemplo `https://assofig.vercel.app`.

## Serviço de e-mail

A implementação usa uma abstração em `src/services/email.ts`. O provedor disponível é o Resend, chamado por HTTPS com o `fetch` nativo do Node.js 24.

Variáveis de produção:

```env
FRONTEND_URL=https://assofig.vercel.app
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_chave_fornecida_pelo_resend
EMAIL_FROM=no-reply@dominio-verificado.com
```

O remetente precisa pertencer a um domínio validado no Resend. Em produção, essas quatro variáveis são obrigatórias.

Em desenvolvimento, use `EMAIL_PROVIDER=disabled`. Nesse modo, a API mantém a resposta genérica, não imprime token ou senha e remove o token que não pôde ser enviado. Para testar o fluxo completo localmente, configure uma chave e um remetente de teste do Resend.

## Banco de dados

Execute antes de publicar a funcionalidade:

```powershell
npm run db:migrate
```

A migration `003_password_reset_tokens.sql` cria `password_reset_tokens`, relaciona cada token a `users`, armazena somente `token_hash`, registra expiração e marca o uso em `used_at`.

Tokens e senhas nunca devem ser incluídos em logs de aplicação.