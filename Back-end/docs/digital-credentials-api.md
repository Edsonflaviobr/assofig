# Credenciais digitais

## Configuração

`CREDENTIAL_VALID_UNTIL` é opcional e aceita uma data ISO completa (`YYYY-MM-DD`), por exemplo:

```env
CREDENTIAL_VALID_UNTIL=2027-11-30
```

Sem essa variável, a emissão continua disponível, `validade_credencial` permanece nula e a API retorna `validadeAno: null`. A ASSOFIG deve definir administrativamente a regra anual antes de configurar a data em produção.

## Migration

Execute na pasta `Back-end`:

```powershell
npm run db:migrate
```

A migration `010_digital_credentials.sql` adiciona campos nullable em `associados`; ela não gera códigos em massa e não modifica cadastros existentes.

## Endpoints

### `GET /api/minha-credencial`

Exige autenticação e vínculo com associado. Antes da primeira emissão retorna:

```json
{ "disponivel": false }
```

### `POST /api/minha-credencial/emitir`

Exige autenticação e vínculo com associado. Emite na primeira chamada e retorna a mesma credencial nas chamadas seguintes:

```json
{
  "disponivel": true,
  "tipoCredencial": "carteira",
  "nomeExibicao": "Edson Sousa",
  "categoriaExibicao": "Fisioterapeuta",
  "validadeAno": 2027,
  "codigoVerificacao": "AS4K-82PZ",
  "status": "disponivel"
}
```

### `POST /api/credenciais/validar`

Rota pública com limite de 30 solicitações a cada 15 minutos por cliente.

```json
{ "codigo": "AS4K-82PZ" }
```

A busca aceita letras minúsculas, espaços e código sem hífen. A resposta pública nunca inclui ID, e-mail, CPF, CNPJ, telefone ou dados financeiros.

## Categorias

- Fisioterapeuta, Terapeuta Ocupacional e Estudante: `carteira`.
- Empresa: `certificado`.

O banco atual usa `associados.profession` como categoria. Não existe campo separado para nome fantasia e razão social; para empresas, `associados.name` é retornado integralmente.
