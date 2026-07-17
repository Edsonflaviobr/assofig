# Back-end ASSOFIG

API REST da Associação de Fisioterapeutas e Terapeutas Ocupacionais de Guaxupé e Região. O projeto foi criado em Node.js com TypeScript e PostgreSQL para atender a camada `Front-end/js/api.js`.

## O que este back-end faz

- autenticação por e-mail e senha;
- perfis de associado (`member`) e diretoria (`admin`);
- cadastro, consulta, alteração e exclusão de associados;
- controle de inadimplência e regularização;
- criação e consulta de pagamentos;
- solicitação pública de associação;
- formulário público de contato;
- cadastro e validação de CPF ou CNPJ;
- proteção das rotas conforme o perfil do usuário.

Todos os integrantes da ata são associados. Somente os cinco membros da Diretoria Executiva possuem permissão administrativa: Edson, Jamili, Gabriel, Verônica e Marcella. Esses cinco também podem entrar normalmente no perfil de associado.

## Como o código foi organizado

```text
Back-end/
|-- migrations/              Alterações versionadas do banco
|   |-- 001_initial.sql      Estrutura inicial
|   `-- 002_cpf_cnpj.sql     Suporte a CPF e CNPJ
|-- scripts/
|   |-- migrate.ts           Executa migrações pendentes
|   `-- seed.ts              Cadastra os associados iniciais
|-- src/
|   |-- config/              Variáveis de ambiente
|   |-- db/                  Conexão e transações PostgreSQL
|   |-- middleware/          Autenticação, autorização e erros
|   |-- routes/              Endpoints REST
|   |-- schemas/             Validações compartilhadas
|   |-- utils/               JWT, CPF/CNPJ e erros da API
|   |-- app.ts               Configuração ESM do Express e entrypoint da Vercel
|   `-- local.ts             Inicialização exclusiva do servidor local
|-- tests/                   Testes automatizados
|-- .env.example             Exemplo de configuração
|-- docker-compose.yml       PostgreSQL para desenvolvimento
`-- package.json             Dependências e comandos
```

A aplicação foi dividida dessa forma para manter banco, regras de acesso, validações e rotas separados. Isso facilita testar e evoluir cada parte sem concentrar toda a lógica em um único arquivo.

## Tecnologias e decisões

- **Node.js 24 e TypeScript:** servidor e tipagem do código.
- **Express:** endpoints HTTP da API REST.
- **PostgreSQL:** armazenamento persistente.
- **pg:** consultas parametrizadas e transações.
- **Zod:** valida os dados recebidos antes de acessar o banco.
- **JWT:** gera o token usado no cabeçalho `Authorization`.
- **bcryptjs:** armazena apenas o hash das senhas.
- **Helmet, CORS e rate limit:** proteções HTTP básicas.
- **Vitest e Supertest:** testes de regras e endpoints.

As consultas usam parâmetros (`$1`, `$2` etc.) para evitar injeção de SQL. Senhas não são armazenadas em texto aberto.

## Pré-requisitos

- Node.js 24;
- npm;
- PostgreSQL 16 recomendado;
- opcionalmente Docker Desktop, para iniciar o PostgreSQL pelo arquivo `docker-compose.yml`.

Confira o Node.js:

```powershell
node --version
npm --version
```

## 1. Instalar as dependências

Abra o PowerShell na pasta `Back-end` e execute:

```powershell
npm install
```

## 2. Criar o arquivo de configuração

```powershell
Copy-Item .env.example .env
```

Edite o arquivo `.env`:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/assofig
JWT_SECRET=coloque-aqui-uma-chave-secreta-com-mais-de-32-caracteres
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5500,http://127.0.0.1:5500
SEED_PASSWORD=defina-uma-senha-inicial-segura
```

Nunca envie o arquivo `.env` para um repositório. Ele já está ignorado pelo `.gitignore`.

## 3. Iniciar o PostgreSQL

### Opção A: Docker Desktop

Com o Docker instalado e aberto:

```powershell
docker compose up -d
```

O contêiner cria:

- banco: `assofig`;
- usuário: `postgres`;
- senha: `postgres`;
- porta: `5432`.

Para verificar:

```powershell
docker compose ps
```

Para parar sem apagar os dados:

```powershell
docker compose stop
```

### Opção B: PostgreSQL instalado no Windows

Crie um banco chamado `assofig` pelo pgAdmin ou pelo `psql`. Depois ajuste `DATABASE_URL` com o usuário e a senha reais da instalação:

```env
DATABASE_URL=postgresql://SEU_USUARIO:SUA_SENHA@localhost:5432/assofig
```

O erro `ECONNREFUSED 127.0.0.1:5432` significa que o PostgreSQL não está iniciado ou não está ouvindo nessa porta.

## 4. Criar as tabelas

Com o banco em funcionamento:

```powershell
npm run db:migrate
```

O script executa os arquivos em `migrations/` na ordem e registra cada execução em `schema_migrations`. Uma migração aplicada não é executada novamente.

As principais tabelas são:

| Tabela | Finalidade |
|---|---|
| `associados` | Dados cadastrais e situação financeira |
| `users` | Autenticação, senha protegida e perfil |
| `inadimplencias` | Pendências e regularizações |
| `pagamentos` | Histórico de pagamentos |
| `inscricoes` | Solicitações de novos associados |
| `contatos` | Mensagens do site |
| `schema_migrations` | Controle das migrações aplicadas |

## 5. Cadastrar os associados iniciais

```powershell
npm run db:seed
```

O seed pode ser executado novamente: ele atualiza os registros existentes pelo e-mail, sem criar cópias. A senha inicial de todos é o valor de `SEED_PASSWORD`.

Os e-mails técnicos seguem o padrão apresentado no arquivo `scripts/seed.ts`, por exemplo:

- `edson.sousa@assofig.local`;
- `jamili.bernardino@assofig.local`;
- `gabriel.goulart@assofig.local`.

Para os cinco diretores, o mesmo e-mail e senha permitem selecionar `member` ou `admin` no login. Para os demais, somente `member` é autorizado. Contas administrativas que não pertençam à diretoria atual são desativadas pelo seed.

### Situação dos CPFs iniciais

Doze CPFs informados passaram na validação e estão preparados no seed. O CPF informado para Marcella não passou nos dígitos verificadores e foi deixado como `null` para evitar armazenar um documento incorreto. Ele deve ser incluído depois que o número correto for confirmado.

## 6. Executar em desenvolvimento

```powershell
npm run dev
```

A API ficará disponível em:

```text
http://localhost:3000/api
```

Teste no navegador:

```text
http://localhost:3000/api/health
```

Resposta esperada:

```json
{ "status": "ok" }
```

## 7. Conectar o front-end

O front-end usa mocks por padrão. Antes de carregar `js/api.js`, configure:

```html
<script>
  window.ASSOFIG_API_URL = 'http://localhost:3000/api';
  window.ASSOFIG_USE_MOCKS = false;
</script>
<script src="js/api.js"></script>
```

Sirva o front-end em uma origem autorizada por `CORS_ORIGIN`, por exemplo `http://localhost:5500`. Abrir somente o arquivo HTML pelo endereço `file://` pode causar bloqueios do navegador.

A camada `api.js` já possui os caminhos compatíveis com o back-end. Entretanto, partes demonstrativas de `script.js` ainda usam `localStorage`; ao finalizar o novo front-end, substitua esses fluxos por chamadas a `AssofigAPI`.

## CPF e CNPJ no novo formulário

No formulário de associação, recomenda-se usar o nome `cpfCnpj`:

```html
<label>
  CPF ou CNPJ
  <input name="cpfCnpj" required>
</label>
```

A API também reconhece `document`, `cpf` e `cnpj`. Valores com ou sem pontuação são aceitos:

```json
{
  "name": "Nome da pessoa ou empresa",
  "profession": "Fisioterapeuta",
  "email": "contato@example.com",
  "phone": "(35) 99999-0000",
  "city": "Guaxupé",
  "cpfCnpj": "11.444.777/0001-61"
}
```

Internamente, o documento é salvo somente com números. CPF/CNPJ inválido retorna HTTP `400`; documento duplicado retorna HTTP `409`. Mais detalhes estão em `docs/cpf-cnpj-api.md`.

## Autenticação e autorização

O login recebe:

```json
{
  "email": "edson.sousa@assofig.local",
  "password": "senha-definida-no-seed",
  "role": "admin"
}
```

A resposta contém um token JWT:

```json
{
  "token": "...",
  "role": "admin",
  "user": {
    "id": 1,
    "name": "Edson Flavio de Sousa",
    "email": "edson.sousa@assofig.local",
    "profession": "Fisioterapeuta"
  }
}
```

As chamadas protegidas enviam:

```http
Authorization: Bearer SEU_TOKEN
```

A API aplica duas verificações:

1. `authenticate` valida se o token existe, é legítimo e não expirou;
2. `authorize` confirma se o perfil pode acessar aquela rota.

## Endpoints principais

| Método | Endpoint | Acesso |
|---|---|---|
| GET | `/api/health` | Público |
| POST | `/api/auth/login` | Público |
| POST | `/api/inscricoes` | Público |
| POST | `/api/contato` | Público |
| GET | `/api/noticias` | Público |
| GET | `/api/eventos` | Público |
| GET | `/api/associados/me` | Associado |
| GET | `/api/beneficios/historico` | Associado |
| GET/POST | `/api/pagamentos` | Autenticado |
| GET/POST | `/api/diretoria/associados` | Diretoria |
| PUT/DELETE | `/api/diretoria/associados/:id` | Diretoria |
| GET/POST | `/api/diretoria/associados/:id/inadimplencias` | Diretoria |
| PATCH | `/api/diretoria/associados/:id/inadimplencias/:inadimplenciaId/regularizar` | Diretoria |

Os estados de associado usados pelo front-end são:

- `active`: em dia;
- `late`: inadimplente;
- `pending`: cadastro pendente.

## Inadimplência

A diretoria pode registrar uma pendência com mês de referência, vencimento e valor. Quando existe pendência aberta, o associado passa para `late`. Ao regularizar todas as pendências, ele volta para `active`, exceto se o cadastro ainda estiver `pending`.

O `PUT /api/diretoria/associados/:id` também é compatível com o botão demonstrativo atual: mudar o status para `late` abre uma pendência padrão; mudar para `active` regulariza as pendências abertas.

## Testes

Execute:

```powershell
npm test
```

Os testes verificam:

- disponibilidade da API;
- proteção das rotas da diretoria;
- respostas de validação e 404;
- CPF válido e inválido;
- CNPJ válido e inválido;
- os documentos fornecidos para o seed.

Para acompanhar durante alterações:

```powershell
npm run test:watch
```

## Compilação e produção

Valide e compile:

```powershell
npm run build
```

Inicie o código compilado:

```powershell
npm start
```

Em produção, use uma senha forte para o PostgreSQL, um `JWT_SECRET` longo e exclusivo, HTTPS, backups automáticos e uma origem CORS específica. Como CPF/CNPJ são dados pessoais, limite o acesso administrativo e evite registrá-los em logs.

## Comandos disponíveis

| Comando | Função |
|---|---|
| `npm run dev` | Servidor com recarga automática |
| `npm run build` | Compila e valida o TypeScript |
| `npm start` | Executa a versão compilada |
| `npm run db:migrate` | Aplica migrações pendentes |
| `npm run db:seed` | Cadastra/atualiza associados iniciais |
| `npm test` | Executa todos os testes |
| `npm run test:watch` | Executa testes em modo contínuo |


## Deploy na Vercel

A Vercel detecta automaticamente `src/app.ts` como uma aplicação Express e a publica como uma única Vercel Function. O projeto não usa `vercel.json` nem rewrites manuais.

No projeto da Vercel:

1. configure `Back-end` como **Root Directory**;
2. mantenha a detecção automática e não defina Output Directory;
3. cadastre `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` e `CORS_ORIGIN`;
4. use a connection string PostgreSQL do pooler do Supabase, não a URL pública do projeto;
5. aplique migrações e seed fora do build da Vercel.

O guia completo está em [`docs/deploy-vercel.md`](docs/deploy-vercel.md).

## Problemas comuns

### `ECONNREFUSED` na porta 5432

O PostgreSQL não está iniciado, a porta está errada ou `DATABASE_URL` aponta para outro local.

### `password authentication failed`

Usuário ou senha de `DATABASE_URL` não correspondem ao PostgreSQL.

### Erro de CORS

Inclua a URL exata do front-end em `CORS_ORIGIN`, separando múltiplas origens por vírgula, e reinicie a API.

### HTTP 401

O token não foi enviado, expirou ou é inválido. Faça login novamente.

### HTTP 403

O usuário está autenticado, mas não possui o perfil exigido. Somente a diretoria pode acessar `/api/diretoria/*`.

### HTTP 409

E-mail ou CPF/CNPJ já está cadastrado.

## Estado atual do ambiente

O código compila e os testes automatizados estão aprovados. Nesta máquina, o PostgreSQL ainda não está disponível na porta 5432 e não existe um arquivo `.env`; por isso as migrações e o seed ainda não foram persistidos em um banco real. Depois de iniciar o banco, siga as etapas 2 a 6 deste README.