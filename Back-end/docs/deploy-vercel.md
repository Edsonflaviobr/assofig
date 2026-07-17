# Deploy do back-end na Vercel

Este projeto segue a detecção automática atual da Vercel para Express. O arquivo `src/app.ts` exporta a aplicação Express como `default`; a Vercel o transforma em uma única Vercel Function. Não é necessário criar `vercel.json`, uma pasta `api/` ou rewrites manuais.

## Estrutura de inicialização

- `src/app.ts`: configura o Express e exporta a aplicação. É o entrypoint detectado pela Vercel.
- `src/local.ts`: chama `app.listen()` somente para `npm run dev` e `npm start`.
- `src/db/pool.ts`: cria o pool PostgreSQL no escopo global e o anexa ao ciclo de vida do Fluid Compute.

As rotas continuam registradas com o prefixo `/api`, portanto os endereços publicados permanecem iguais, por exemplo `/api/health` e `/api/auth/login`.

## Configuração do projeto

Ao importar o repositório na Vercel:

1. Selecione o repositório que contém `Front-end` e `Back-end`.
2. Defina **Root Directory** como `Back-end`.
3. Mantenha a detecção automática do framework.
4. Não configure Output Directory.
5. Não sobrescreva Install Command, Build Command ou Development Command sem necessidade.

## Variáveis de ambiente

Cadastre em **Project Settings > Environment Variables**:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Connection string do pooler do Supabase com SSL |
| `JWT_SECRET` | Segredo exclusivo com pelo menos 32 caracteres |
| `JWT_EXPIRES_IN` | Por exemplo, `8h` |
| `SEED_PASSWORD` | Senha inicial forte dos novos associados; obrigatória no backend |
| `CORS_ORIGIN` | URL exata do front-end publicado |
| `FRONTEND_URL` | Origem do front-end usada no link de redefinição |
| `EMAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` | Chave secreta do Resend |
| `EMAIL_FROM` | Remetente de domínio verificado no Resend |
| `PIX_KEY` | Chave PIX da ASSOFIG |
| `PIX_RECEIVER_NAME` | Nome do favorecido, por exemplo `ASSOFIG` |

Não é necessário configurar `PORT` na Vercel. `SEED_PASSWORD` é obrigatória no backend porque também define a senha inicial dos novos associados cadastrados pela diretoria.

Para o Supabase, copie a connection string no painel em **Connect**. Para execução serverless, use preferencialmente o **Transaction pooler** e mantenha SSL habilitado. A URL pública `https://<projeto>.supabase.co` não substitui a connection string PostgreSQL.

Exemplo de formato, sem credenciais reais:

```env
DATABASE_URL=postgresql://postgres.<project-ref>:SENHA@HOST.pooler.supabase.com:6543/postgres?sslmode=require
```

Se a senha contiver caracteres especiais, use a connection string fornecida pelo painel ou aplique URL encoding à senha.

## Migrações e seed

Migrações não são executadas no build da Vercel. As migrations `003_password_reset_tokens.sql` e `005_must_change_password.sql` são obrigatórias para recuperação e troca inicial de senha. Antes do primeiro deploy funcional, use a `DATABASE_URL` de produção em um `.env` local seguro e execute:

```powershell
npm run db:migrate
npm run db:seed
```

Mantenha `SEED_PASSWORD` configurada na Vercel e nunca a exponha ao frontend. O arquivo `.env` não deve ser enviado ao Git.

## Deploy e verificação

Faça o deploy pela integração Git da Vercel. Depois valide:

```text
https://SEU-BACKEND.vercel.app/api/health
```

Resposta esperada:

```json
{ "status": "ok" }
```

No front-end, configure:

```html
<script>
  window.ASSOFIG_API_URL = 'https://SEU-BACKEND.vercel.app/api';
  window.ASSOFIG_USE_MOCKS = false;
</script>
```

Inclua a URL de produção do front-end em `CORS_ORIGIN`. Para testar um Preview Deployment do front-end, inclua também a URL exata desse preview, separada por vírgula.

## Desenvolvimento local

O fluxo local não mudou:

```powershell
npm run dev
```

Para validar a versão compilada:

```powershell
npm run build
npm start
```

## Por que não existe `vercel.json`

A Vercel reconhece oficialmente `src/app.ts` e aceita um `default export` da aplicação Express. Um `vercel.json` com `builds`, `routes` ou rewrites para `/api` reproduziria configurações antigas, poderia alterar os caminhos atuais e substituir padrões que a plataforma já fornece automaticamente.
