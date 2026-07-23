import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('../src/db/pool.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../src/db/transaction.js', () => ({ transaction: mocks.transaction }));

import { app } from '../src/app.js';
import {
  credentialDisplayName,
  generateVerificationCode,
  mapCredentialCategory,
  normalizeVerificationCode
} from '../src/services/credentials.js';
import { signToken } from '../src/utils/auth.js';

type CredentialRow = {
  id: number;
  name: string;
  profession: string;
  email: string;
  document: string | null;
  tipo_credencial: 'carteira' | 'certificado' | null;
  codigo_verificacao_credencial: string | null;
  status_credencial: 'disponivel' | 'suspensa' | 'vencida' | null;
  data_emissao_credencial: string | null;
  validade_credencial: string | null;
  credential_expired: boolean;
};

type QueryResult = { rows: Array<Record<string, unknown>>; rowCount: number };

const userToken = signToken({ userId: 1, role: 'member', associadoId: 10 });
const otherToken = signToken({ userId: 2, role: 'member', associadoId: 20 });
const userAuth = { Authorization: `Bearer ${userToken}` };
const otherAuth = { Authorization: `Bearer ${otherToken}` };

let records: Map<number, CredentialRow>;
let uniqueFailures: number;

function queryResult(rows: Array<Record<string, unknown>>): QueryResult {
  return { rows, rowCount: rows.length };
}

function member(overrides: Partial<CredentialRow> = {}): CredentialRow {
  return {
    id: 10,
    name: 'Edson Flavio de Sousa',
    profession: 'Fisioterapeuta',
    email: 'associado@email.com',
    document: '11995365637',
    tipo_credencial: null,
    codigo_verificacao_credencial: null,
    status_credencial: null,
    data_emissao_credencial: null,
    validade_credencial: null,
    credential_expired: false,
    ...overrides
  };
}

function installDatabaseMock(): void {
  mocks.poolQuery.mockImplementation(async (sql: string, params: unknown[] = []): Promise<QueryResult> => {
    if (sql.includes('SELECT must_change_password FROM users')) {
      return queryResult([{ must_change_password: false }]);
    }
    if (sql.includes('SELECT u.associado_id')) {
      return queryResult([{ associado_id: params[0] === 2 ? 20 : 10 }]);
    }
    if (sql.includes('WHERE codigo_verificacao_credencial=$1')) {
      const row = [...records.values()].find((item) => item.codigo_verificacao_credencial === params[0]);
      return queryResult(row ? [row] : []);
    }
    if (sql.includes('FROM associados WHERE id=$1')) {
      const row = records.get(Number(params[0]));
      return queryResult(row ? [row] : []);
    }
    return queryResult([]);
  });

  mocks.clientQuery.mockImplementation(async (sql: string, params: unknown[] = []): Promise<QueryResult> => {
    if (sql.includes('FROM associados WHERE id=$1 FOR UPDATE')) {
      const row = records.get(Number(params[0]));
      return queryResult(row ? [row] : []);
    }
    if (sql.includes('UPDATE associados')) {
      if (uniqueFailures > 0) {
        uniqueFailures -= 1;
        throw Object.assign(new Error('colisão'), { code: '23505' });
      }
      const row = records.get(Number(params[0]));
      if (!row || row.codigo_verificacao_credencial) return queryResult([]);
      Object.assign(row, {
        tipo_credencial: params[1],
        codigo_verificacao_credencial: params[2],
        status_credencial: 'disponivel',
        data_emissao_credencial: '2026-07-23T12:00:00.000Z',
        validade_credencial: params[3] ?? null,
        credential_expired: false
      });
      return queryResult([row]);
    }
    return queryResult([]);
  });
}

describe('credenciais digitais', () => {
  beforeEach(() => {
    records = new Map([
      [10, member()],
      [20, member({ id: 20, name: 'Maria Silva', email: 'outro@email.com', document: '08135543654' })]
    ]);
    uniqueFailures = 0;
    mocks.poolQuery.mockReset();
    mocks.clientQuery.mockReset();
    mocks.transaction.mockReset();
    installDatabaseMock();
    mocks.transaction.mockImplementation(async (work: (client: { query: typeof mocks.clientQuery }) => Promise<unknown>) => {
      return work({ query: mocks.clientQuery });
    });
  });

  it.each([
    ['Fisioterapeuta', 'carteira', 'Fisioterapeuta'],
    ['terapeuta_ocupacional', 'carteira', 'Terapeuta Ocupacional'],
    ['TO', 'carteira', 'Terapeuta Ocupacional'],
    ['Estudante', 'carteira', 'Estudante'],
    ['Empresa', 'certificado', 'Empresa']
  ] as const)('mapeia %s para %s', (category, credentialType, publicCategory) => {
    expect(mapCredentialCategory(category)).toMatchObject({ credentialType, publicCategory });
  });

  it('não entrega carteira para empresa nem certificado empresarial para pessoa física', () => {
    expect(mapCredentialCategory('Empresa').credentialType).toBe('certificado');
    expect(mapCredentialCategory('Fisioterapeuta').credentialType).toBe('carteira');
  });

  it('reduz nome de pessoa e preserva nome empresarial completo', () => {
    expect(credentialDisplayName('  Edson   Flavio de Sousa ', false)).toBe('Edson Sousa');
    expect(credentialDisplayName('Empresa Exemplo Ltda.', true)).toBe('Empresa Exemplo Ltda.');
  });

  it('usuário antigo emite a primeira credencial imediatamente', async () => {
    const response = await request(app).post('/api/minha-credencial/emitir').set(userAuth).send({ associadoId: 20 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      disponivel: true,
      tipoCredencial: 'carteira',
      nomeExibicao: 'Edson Sousa',
      categoriaExibicao: 'Fisioterapeuta',
      status: 'disponivel'
    });
    expect(response.body.codigoVerificacao).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
    expect(records.get(10)?.data_emissao_credencial).toBe('2026-07-23T12:00:00.000Z');
    expect(records.get(20)?.codigo_verificacao_credencial).toBeNull();
  });

  it('empresa recebe exclusivamente certificado e nome completo', async () => {
    records.set(10, member({ name: 'Empresa Exemplo Ltda.', profession: 'Empresa' }));
    const response = await request(app).post('/api/minha-credencial/emitir').set(userAuth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      tipoCredencial: 'certificado', nomeExibicao: 'Empresa Exemplo Ltda.', categoriaExibicao: 'Empresa'
    });
  });

  it('preserva código e data de emissão nas chamadas seguintes', async () => {
    const first = await request(app).post('/api/minha-credencial/emitir').set(userAuth);
    const issuedAt = records.get(10)?.data_emissao_credencial;
    const second = await request(app).post('/api/minha-credencial/emitir').set(userAuth);

    expect(second.status).toBe(200);
    expect(second.body.codigoVerificacao).toBe(first.body.codigoVerificacao);
    expect(records.get(10)?.data_emissao_credencial).toBe(issuedAt);
    expect(mocks.clientQuery.mock.calls.filter((call) => String(call[0]).includes('UPDATE associados'))).toHaveLength(1);
  });

  it('consulta sem emitir retorna indisponível sem criar código', async () => {
    const response = await request(app).get('/api/minha-credencial').set(userAuth);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ disponivel: false });
    expect(records.get(10)?.codigo_verificacao_credencial).toBeNull();
  });

  it('gera códigos no formato esperado e sem duplicidade na amostra', () => {
    const codes = new Set(Array.from({ length: 500 }, generateVerificationCode));
    expect(codes.size).toBe(500);
    for (const code of codes) expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
  });

  it('repete a geração quando o banco detecta colisão', async () => {
    uniqueFailures = 1;
    const response = await request(app).post('/api/minha-credencial/emitir').set(userAuth);

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });

  it.each(['ABCD-2345', 'ABCD2345', ' abcd - 2345 '])('normaliza o código público %s', (input) => {
    expect(normalizeVerificationCode(input)).toBe('ABCD-2345');
  });

  it('valida código público com e sem hífen e sem retornar dados privados', async () => {
    records.set(10, member({
      tipo_credencial: 'carteira', codigo_verificacao_credencial: 'ABCD-2345',
      status_credencial: 'disponivel', data_emissao_credencial: '2026-07-23T12:00:00.000Z',
      validade_credencial: '2027-11-30'
    }));
    const response = await request(app).post('/api/credenciais/validar').send({ codigo: ' abcd2345 ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      encontrada: true, valida: true, tipoCredencial: 'carteira', nome: 'Edson Sousa',
      categoria: 'Fisioterapeuta', situacao: 'Ativo', validadeAno: 2027
    });
    expect(response.body).not.toHaveProperty('email');
    expect(response.body).not.toHaveProperty('document');
    expect(response.body).not.toHaveProperty('id');
  });

  it('usuário nunca consulta a credencial de outro cadastro pela rota própria', async () => {
    records.get(20)!.codigo_verificacao_credencial = 'WXYZ-6789';
    records.get(20)!.tipo_credencial = 'carteira';
    records.get(20)!.status_credencial = 'disponivel';
    const own = await request(app).post('/api/minha-credencial/emitir').set(userAuth).send({ associadoId: 20 });
    const other = await request(app).get('/api/minha-credencial').set(otherAuth);

    expect(own.body.nomeExibicao).toBe('Edson Sousa');
    expect(other.body.nomeExibicao).toBe('Maria Silva');
  });

  it('informa credencial suspensa sem considerá-la válida', async () => {
    records.set(10, member({
      tipo_credencial: 'carteira', codigo_verificacao_credencial: 'ABCD-2345',
      status_credencial: 'suspensa', data_emissao_credencial: '2026-07-23T12:00:00.000Z'
    }));
    const response = await request(app).post('/api/credenciais/validar').send({ codigo: 'ABCD-2345' });

    expect(response.body).toMatchObject({ encontrada: true, valida: false, situacao: 'Suspensa' });
    expect(response.body.mensagem).toMatch(/temporariamente suspensa/i);
  });

  it('informa credencial vencida sem considerá-la válida', async () => {
    records.set(10, member({
      tipo_credencial: 'certificado', profession: 'Empresa', name: 'Empresa Exemplo Ltda.',
      codigo_verificacao_credencial: 'ABCD-2345', status_credencial: 'disponivel',
      data_emissao_credencial: '2025-01-01T12:00:00.000Z', validade_credencial: '2026-11-30',
      credential_expired: true
    }));
    const response = await request(app).post('/api/credenciais/validar').send({ codigo: 'ABCD-2345' });

    expect(response.body).toMatchObject({
      encontrada: true, valida: false, tipoCredencial: 'certificado', situacao: 'Vencida', validadeAno: 2026
    });
    expect(response.body.mensagem).toMatch(/credencial está vencida/i);
  });

  it('retorna contrato neutro para código inexistente', async () => {
    const response = await request(app).post('/api/credenciais/validar').send({ codigo: 'ZZZZ-9999' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ encontrada: false, valida: false, mensagem: 'Credencial não localizada.' });
  });
});
