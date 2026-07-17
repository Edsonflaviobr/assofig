import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  transaction: vi.fn(),
  sendPasswordResetEmail: vi.fn()
}));

vi.mock('../src/db/pool.js', () => ({
  pool: { query: mocks.poolQuery }
}));

vi.mock('../src/db/transaction.js', () => ({
  transaction: mocks.transaction
}));

vi.mock('../src/services/email.js', () => ({
  sendPasswordResetEmail: mocks.sendPasswordResetEmail
}));

import { app } from '../src/app.js';

const genericMessage = 'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.';
const validToken = 'A'.repeat(43);

type FakeQueryResult = { rows: Array<Record<string, unknown>>; rowCount: number };
type FakeClient = { query: (sql: string, params?: unknown[]) => Promise<FakeQueryResult> };
type TransactionWork = (client: FakeClient) => Promise<unknown>;

function useClient(query: FakeClient['query']): void {
  mocks.transaction.mockImplementation((work: TransactionWork) => work({ query }));
}

describe('recuperação de senha', () => {
  beforeEach(() => {
    mocks.poolQuery.mockReset();
    mocks.transaction.mockReset();
    mocks.sendPasswordResetEmail.mockReset();
  });

  it('solicita recuperação sem armazenar o token original', async () => {
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [{ id: 7, email: 'usuario@email.com', name: 'Usuário' }],
      rowCount: 1
    });
    const clientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    useClient(clientQuery);
    mocks.sendPasswordResetEmail.mockResolvedValue(true);

    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'USUARIO@email.com' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: genericMessage });
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledOnce();
    const email = mocks.sendPasswordResetEmail.mock.calls[0]?.[0] as { token: string };
    expect(email.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const insertCall = clientQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO password_reset_tokens'));
    expect(insertCall).toBeDefined();
    const storedHash = insertCall?.[1]?.[1];
    expect(storedHash).toBe(createHash('sha256').update(email.token).digest('hex'));
    expect(storedHash).not.toBe(email.token);
    expect(insertCall?.[1]?.[2]).toBe(30);
  });

  it('retorna a mesma resposta quando o e-mail não existe', async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'inexistente@email.com' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: genericMessage });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('rejeita token inválido', async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    useClient(clientQuery);

    const response = await request(app).post('/api/auth/reset-password').send({
      token: validToken,
      password: 'NovaSenha#2026',
      passwordConfirmation: 'NovaSenha#2026'
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Token inválido ou expirado.');
  });

  it('rejeita token expirado por consultar somente tokens dentro da validade', async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    useClient(clientQuery);

    const response = await request(app).post('/api/auth/reset-password').send({
      token: 'B'.repeat(43),
      password: 'NovaSenha#2026',
      passwordConfirmation: 'NovaSenha#2026'
    });

    expect(response.status).toBe(400);
    expect(String(clientQuery.mock.calls[0]?.[0])).toContain('expires_at > NOW()');
  });

  it('redefine a senha com bcrypt e invalida os tokens do usuário', async () => {
    let passwordHash = '';
    const clientQuery = vi.fn(async (sql: string, params?: unknown[]): Promise<FakeQueryResult> => {
      if (sql.includes('SELECT id, user_id')) return { rows: [{ id: 11, user_id: 7 }], rowCount: 1 };
      if (sql.includes('UPDATE users SET password_hash')) {
        passwordHash = String(params?.[1]);
        return { rows: [{ id: 7 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    useClient(clientQuery);

    const response = await request(app).post('/api/auth/reset-password').send({
      token: validToken,
      password: 'NovaSenha#2026',
      passwordConfirmation: 'NovaSenha#2026'
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Senha redefinida com sucesso.');
    expect(await bcrypt.compare('NovaSenha#2026', passwordHash)).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('SET used_at = NOW()'))).toBe(true);
  });

  it('impede a reutilização do mesmo token', async () => {
    let used = false;
    const clientQuery = vi.fn(async (sql: string): Promise<FakeQueryResult> => {
      if (sql.includes('SELECT id, user_id')) {
        return used ? { rows: [], rowCount: 0 } : { rows: [{ id: 11, user_id: 7 }], rowCount: 1 };
      }
      if (sql.includes('UPDATE password_reset_tokens SET used_at')) used = true;
      return { rows: [{ id: 7 }], rowCount: 1 };
    });
    useClient(clientQuery);
    const body = { token: validToken, password: 'NovaSenha#2026', passwordConfirmation: 'NovaSenha#2026' };

    const first = await request(app).post('/api/auth/reset-password').send(body);
    const second = await request(app).post('/api/auth/reset-password').send(body);

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(second.body.message).toBe('Token inválido ou expirado.');
  });
});