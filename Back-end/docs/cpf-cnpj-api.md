# CPF e CNPJ na API

Os endpoints de cadastro aceitam qualquer um destes nomes de campo:

- `cpfCnpj` (recomendado para o front-end)
- `document`
- `cpf`
- `cnpj`

O valor pode ser enviado com ou sem pontuação. A API valida os dígitos verificadores e salva somente os números.

Exemplo de solicitação de associação:

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

Endpoints afetados:

- `POST /api/inscricoes`: CPF/CNPJ obrigatório.
- `POST /api/diretoria/associados`: CPF/CNPJ opcional durante a transição do front-end.
- `PUT /api/diretoria/associados/:id`: permite incluir ou alterar o documento.

Documentos duplicados retornam HTTP `409`. Documentos inválidos retornam HTTP `400`.
