import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  transaction: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn()
}));

vi.mock('../src/db/pool.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../src/db/transaction.js', () => ({ transaction: mocks.transaction }));
vi.mock('../src/services/password-reset.js', () => ({
  requestPasswordReset: mocks.requestPasswordReset,
  resetPassword: mocks.resetPassword
}));

import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { signToken } from '../src/utils/auth.js';

const memberToken = signToken({ userId: 7, role: 'member', associadoId: 99 });
const adminToken = signToken({ userId: 1, role: 'admin', associadoId: 1 });
const adminWithoutMemberToken = signToken({ userId: 2, role: 'admin', associadoId: null });
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

type FakeResult = { rows: Array<Record<string, unknown>>; rowCount: number };
type FakeClient = { query: (sql: string, params?: unknown[]) => Promise<FakeResult> };
type TransactionWork = (client: FakeClient) => Promise<unknown>;

function useClient(query: FakeClient['query']): void {
  mocks.transaction.mockImplementation((work: TransactionWork) => work({ query }));
}

function allowPrivateAccess(): void {
  mocks.poolQuery.mockResolvedValueOnce({ rows: [{ must_change_password: false }], rowCount: 1 });
}

function allowMemberLink(associadoId: number): void {
  mocks.poolQuery.mockResolvedValueOnce({ rows: [{ associado_id: associadoId }], rowCount: 1 });
}

describe('área restrita', () => {
  beforeEach(() => {
    mocks.poolQuery.mockReset();
    mocks.transaction.mockReset();
    mocks.requestPasswordReset.mockReset();
    mocks.resetPassword.mockReset();
  });

  it('retorna usuário e associado em /api/auth/me usando somente o userId do token', async () => {
    const associado = { id: 99, name: 'Associada', email: 'associada@email.com', inadimplencias: [] };
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [{ user: { id: 7, role: 'member' }, associado }],
      rowCount: 1
    });

    const response = await request(app).get('/api/auth/me').set(auth(memberToken));

    expect(response.status).toBe(200);
    expect(response.body.associado).toEqual(associado);
    expect(response.body.member).toEqual(associado);
    expect(response.body.permissions).toEqual({ canAccessMemberArea: true, canAccessAdminArea: false });
    expect(mocks.poolQuery.mock.calls[0]?.[1]).toEqual([7]);
    expect(String(mocks.poolQuery.mock.calls[0]?.[0])).toContain('WHERE u.id = $1');
  });

  it('mantém /api/associados/me seguro pelo userId e retorna as próprias inadimplências', async () => {
    allowPrivateAccess();
    allowMemberLink(99);
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [{ id: 99, name: 'Associada', inadimplencias: [{ id: 3, status: 'open' }] }],
      rowCount: 1
    });

    const response = await request(app).get('/api/associados/me').set(auth(memberToken));

    expect(response.status).toBe(200);
    expect(response.body.inadimplencias).toEqual([{ id: 3, status: 'open' }]);
    expect(mocks.poolQuery.mock.calls[2]?.[1]).toEqual([7]);
  });

  it('protege /api/members para uso exclusivo da diretoria', async () => {
    const unauthenticated = await request(app).get('/api/members');
    allowPrivateAccess();
    const member = await request(app).get('/api/members').set(auth(memberToken));
    allowPrivateAccess();
    mocks.poolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const admin = await request(app).get('/api/members').set(auth(adminToken));

    expect(unauthenticated.status).toBe(401);
    expect(member.status).toBe(403);
    expect(admin.status).toBe(200);
  });

  it('diretor vinculado mantém role administrativa no login e recebe as duas permissões', async () => {
    const passwordHash = await bcrypt.hash('SenhaDiretor#2026', 12);
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [{
        id: 1, email: 'diretor@email.com', password_hash: passwordHash, role: 'admin',
        name: 'Diretor Associado', associado_id: 1, must_change_password: false,
        profession: 'Fisioterapeuta'
      }],
      rowCount: 1
    });

    const response = await request(app).post('/api/auth/login').send({
      email: 'diretor@email.com', password: 'SenhaDiretor#2026', role: 'member'
    });

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('admin');
    expect(response.body.user).toMatchObject({ role: 'admin', associadoId: 1 });
    expect(response.body.permissions).toEqual({ canAccessMemberArea: true, canAccessAdminArea: true });
  });

  it('/api/auth/me retorna dados pessoais e permissões duplas ao diretor vinculado', async () => {
    const associado = { id: 1, name: 'Diretor Associado', email: 'diretor@email.com', inadimplencias: [] };
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [{
        mustChangePassword: false,
        user: { id: 1, role: 'admin', associadoId: 1 },
        associado
      }],
      rowCount: 1
    });

    const response = await request(app).get('/api/auth/me').set(auth(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: 1, role: 'admin', associadoId: 1 });
    expect(response.body.permissions).toEqual({ canAccessMemberArea: true, canAccessAdminArea: true });
    expect(response.body.member).toEqual(associado);
    expect(response.body.associado).toEqual(associado);
    expect(mocks.poolQuery.mock.calls[0]?.[1]).toEqual([1]);
  });

  it('diretor vinculado acessa a própria área pessoal sem perder acesso administrativo', async () => {
    allowPrivateAccess();
    allowMemberLink(1);
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Diretor Associado', inadimplencias: [] }],
      rowCount: 1
    });

    const personal = await request(app).get('/api/associados/me').set(auth(adminToken));

    allowPrivateAccess();
    mocks.poolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const administrative = await request(app).get('/api/members').set(auth(adminToken));

    expect(personal.status).toBe(200);
    expect(administrative.status).toBe(200);
  });

  it('rota de perfil próprio ignora qualquer associado indicado pelo cliente', async () => {
    allowPrivateAccess();
    allowMemberLink(1);
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Diretor Associado', inadimplencias: [] }],
      rowCount: 1
    });

    const response = await request(app).get('/api/associados/me?associadoId=99').set(auth(adminToken));

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(1);
    expect(mocks.poolQuery.mock.calls[2]?.[1]).toEqual([1]);
  });

  it('diretor sem vínculo recebe erro claro apenas na área do associado', async () => {
    allowPrivateAccess();
    mocks.poolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const personal = await request(app).get('/api/associados/me').set(auth(adminWithoutMemberToken));

    allowPrivateAccess();
    mocks.poolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const administrative = await request(app).get('/api/members').set(auth(adminWithoutMemberToken));

    expect(personal.status).toBe(403);
    expect(personal.body.message).toMatch(/sem vínculo com associado/i);
    expect(administrative.status).toBe(200);
  });

  it('cria associado e usuário vinculado com a senha inicial do ambiente', async () => {
    const clientQuery = vi.fn(async (sql: string, params?: unknown[]): Promise<FakeResult> => {
      if (sql.includes('INSERT INTO associados')) {
        return { rows: [{ id: 42, name: 'Nova Associada', email: 'nova@email.com', status: 'active' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    useClient(clientQuery);
    allowPrivateAccess();

    const response = await request(app).post('/api/members').set(auth(adminToken)).send({
      name: 'Nova Associada',
      profession: 'Fisioterapeuta',
      email: 'nova@email.com',
      city: 'Guaxupé',
      status: 'active'
    });

    expect(response.status).toBe(201);
    const userInsert = clientQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO users'));
    expect(userInsert).toBeDefined();
    expect(String(userInsert?.[1]?.[1])).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare(env.SEED_PASSWORD, String(userInsert?.[1]?.[1]))).toBe(true);
    expect(userInsert?.[1]?.[3]).toBe(42);
    expect(String(userInsert?.[0])).toContain('must_change_password');
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('expõe GET /api/members/:id para carregar o formulário de edição', async () => {
    allowPrivateAccess();
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [{ id: 42, name: 'Associada', email: 'associada@email.com', status: 'active' }],
      rowCount: 1
    });

    const response = await request(app).get('/api/members/42').set(auth(adminToken));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 42, name: 'Associada' });
    expect(mocks.poolQuery.mock.calls[1]?.[1]).toEqual([42]);
  });

  it('gera a referência mensal a partir da data de vencimento', async () => {
    const clientQuery = vi.fn(async (sql: string, params?: unknown[]): Promise<FakeResult> => {
      if (sql.includes('INSERT INTO inadimplencias')) {
        return { rows: [{ id: 8, associado_id: 42, reference: '08/2026', amount: 120, status: 'open' }], rowCount: 1 };
      }
      if (sql.includes('SELECT EXISTS')) return { rows: [{ has_open: true }], rowCount: 1 };
      if (sql.includes('SELECT status FROM associados')) return { rows: [{ status: 'active' }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    useClient(clientQuery);
    allowPrivateAccess();

    const response = await request(app).post('/api/members/42/inadimplencias').set(auth(adminToken)).send({
      amount: 120,
      dueDate: '2026-08-10'
    });

    expect(response.status).toBe(201);
    expect(response.body.reference).toBe('08/2026');
    const insert = clientQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO inadimplencias'));
    expect(insert?.[1]).toEqual([42, '2026-08-01', '2026-08-10', 120, null]);
    expect(String(insert?.[0])).toContain("to_char(reference_month, 'MM/YYYY') AS reference");
  });

  it('sincroniza o e-mail de cadastro com o usuário sem alterar a senha', async () => {
    const clientQuery = vi.fn(async (sql: string, _params?: unknown[]): Promise<FakeResult> => {
      if (sql.startsWith('SELECT * FROM associados')) {
        return { rows: [{ id: 42, name: 'Associada', profession: 'Fisioterapeuta', email: 'antigo@email.com', document: null, phone: null, registry: null, city: 'Guaxupé', status: 'active' }], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE associados SET')) {
        return { rows: [{ id: 42, name: 'Associada', email: 'novo@email.com' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    useClient(clientQuery);
    allowPrivateAccess();

    const response = await request(app).put('/api/members/42').set(auth(adminToken)).send({ email: 'novo@email.com' });

    expect(response.status).toBe(200);
    const userUpdate = clientQuery.mock.calls.find(([sql]) => String(sql).startsWith('UPDATE users SET email'));
    expect(userUpdate?.[1]).toEqual([42, 'novo@email.com', 'Associada']);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('SET password_hash'))).toBe(false);
  });

  it('mantém as inadimplências administrativas disponíveis pelo alias', async () => {
    allowPrivateAccess();
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ id: 3, associado_id: 42, status: 'open' }], rowCount: 1 });

    const response = await request(app).get('/api/members/42/inadimplencias').set(auth(adminToken));

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  it('retorna somente os dados PIX configurados para usuário autenticado', async () => {
    const originalKey = env.PIX_KEY;
    const originalName = env.PIX_RECEIVER_NAME;
    env.PIX_KEY = 'pix-configurado';
    env.PIX_RECEIVER_NAME = 'ASSOFIG';
    allowPrivateAccess();
    allowMemberLink(99);
    try {
      const response = await request(app).get('/api/payments/pix').set(auth(memberToken));
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ pixKey: 'pix-configurado', receiverName: 'ASSOFIG' });
    } finally {
      env.PIX_KEY = originalKey;
      env.PIX_RECEIVER_NAME = originalName;
    }
  });
  it('rejeita e-mail duplicado sem manter cadastro parcial', async () => {
    const duplicate = Object.assign(new Error('duplicate'), { code: '23505' });
    allowPrivateAccess();
    mocks.transaction.mockRejectedValue(duplicate);

    const response = await request(app).post('/api/members').set(auth(adminToken)).send({
      name: 'Associada Duplicada',
      profession: 'Fisioterapeuta',
      email: 'existente@email.com',
      city: 'Guaxupé',
      status: 'active'
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Já existe um registro com estes dados.');
  });
  it('interrompe o cadastro sem transação quando SEED_PASSWORD não está definida', async () => {
    const currentSeedPassword = process.env.SEED_PASSWORD;
    delete process.env.SEED_PASSWORD;
    allowPrivateAccess();
    try {
      const response = await request(app).post('/api/members').set(auth(adminToken)).send({
        name: 'Nova Associada',
        profession: 'Fisioterapeuta',
        email: 'sem-senha@email.com',
        city: 'Guaxupé',
        status: 'active'
      });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Configuração da senha inicial indisponível.');
      expect(mocks.transaction).not.toHaveBeenCalled();
    } finally {
      process.env.SEED_PASSWORD = currentSeedPassword;
    }
  });
});
