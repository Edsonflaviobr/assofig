import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ poolQuery: vi.fn() }));
vi.mock('../src/db/pool.js', () => ({ pool: { query: mocks.poolQuery } }));

import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { signToken } from '../src/utils/auth.js';

const token = signToken({ userId: 70, role: 'member', associadoId: 90 });
const authorization = { Authorization: `Bearer ${token}` };
let passwordHash = '';
let mustChangePassword = true;

type QueryResult = { rows: Array<Record<string, unknown>>; rowCount: number };

function installDatabaseMock(): void {
  mocks.poolQuery.mockImplementation(async (sql: string, params?: unknown[]): Promise<QueryResult> => {
    if (sql.includes('SELECT u.id, u.email, u.password_hash')) {
      return {
        rows: [{
          id: 70,
          email: 'novo@email.com',
          password_hash: passwordHash,
          role: 'member',
          name: 'Novo Associado',
          associado_id: 90,
          must_change_password: mustChangePassword,
          profession: 'Fisioterapeuta'
        }],
        rowCount: 1
      };
    }
    if (sql.includes('SELECT password_hash, must_change_password')) {
      return { rows: [{ password_hash: passwordHash, must_change_password: mustChangePassword }], rowCount: 1 };
    }
    if (sql.includes('UPDATE users SET password_hash')) {
      passwordHash = String(params?.[1]);
      mustChangePassword = false;
      return { rows: [{ id: 70 }], rowCount: 1 };
    }
    if (sql.includes('SELECT must_change_password FROM users')) {
      return { rows: [{ must_change_password: mustChangePassword }], rowCount: 1 };
    }
    if (sql.includes('SELECT u.must_change_password AS')) {
      return {
        rows: [{
          mustChangePassword,
          user: { id: 70, name: 'Novo Associado', email: 'novo@email.com', mustChangePassword },
          associado: { id: 90, name: 'Novo Associado', email: 'novo@email.com', city: 'Guaxupé', inadimplencias: [] }
        }],
        rowCount: 1
      };
    }
    return { rows: [], rowCount: 0 };
  });
}

describe('troca obrigatória da senha inicial', () => {
  beforeEach(async () => {
    passwordHash = await bcrypt.hash(env.SEED_PASSWORD, 12);
    mustChangePassword = true;
    mocks.poolQuery.mockReset();
    installDatabaseMock();
  });

  it('login com senha inicial retorna mustChangePassword true', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'novo@email.com',
      password: env.SEED_PASSWORD,
      role: 'member'
    });

    expect(response.status).toBe(200);
    expect(response.body.mustChangePassword).toBe(true);
    expect(response.body.token).toEqual(expect.any(String));
  });

  it('permite somente o perfil mínimo antes da troca', async () => {
    const response = await request(app).get('/api/auth/me').set(authorization);

    expect(response.status).toBe(200);
    expect(response.body.mustChangePassword).toBe(true);
    expect(response.body.associado).toEqual({ id: 90, name: 'Novo Associado', email: 'novo@email.com' });
    expect(response.body.associado.inadimplencias).toBeUndefined();
  });

  it('bloqueia as demais rotas privadas enquanto a troca é obrigatória', async () => {
    const response = await request(app).get('/api/payments/pix').set(authorization);

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/troca da senha inicial/i);
  });

  it('rejeita a troca quando a senha atual está incorreta', async () => {
    const response = await request(app).post('/api/auth/change-initial-password').set(authorization).send({
      currentPassword: 'SenhaIncorreta#1',
      newPassword: 'NovaSenha#2026',
      confirmPassword: 'NovaSenha#2026'
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Senha atual incorreta.');
  });

  it('rejeita confirmação diferente', async () => {
    const response = await request(app).post('/api/auth/change-initial-password').set(authorization).send({
      currentPassword: env.SEED_PASSWORD,
      newPassword: 'NovaSenha#2026',
      confirmPassword: 'OutraSenha#2026'
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Dados inválidos.');
  });

  it('rejeita nova senha igual à senha inicial', async () => {
    const response = await request(app).post('/api/auth/change-initial-password').set(authorization).send({
      currentPassword: env.SEED_PASSWORD,
      newPassword: env.SEED_PASSWORD,
      confirmPassword: env.SEED_PASSWORD
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/diferente da senha inicial/i);
  });

  it('troca válida substitui o hash e define must_change_password como false', async () => {
    const oldHash = passwordHash;
    const response = await request(app).post('/api/auth/change-initial-password').set(authorization).send({
      currentPassword: env.SEED_PASSWORD,
      newPassword: 'NovaSenha#2026',
      confirmPassword: 'NovaSenha#2026'
    });

    expect(response.status).toBe(200);
    expect(response.body.mustChangePassword).toBe(false);
    expect(passwordHash).not.toBe(oldHash);
    expect(await bcrypt.compare('NovaSenha#2026', passwordHash)).toBe(true);
    expect(mustChangePassword).toBe(false);
  });

  it('login posterior informa troca concluída e libera acesso privado', async () => {
    await request(app).post('/api/auth/change-initial-password').set(authorization).send({
      currentPassword: env.SEED_PASSWORD,
      newPassword: 'NovaSenha#2026',
      confirmPassword: 'NovaSenha#2026'
    });

    const login = await request(app).post('/api/auth/login').send({
      email: 'novo@email.com',
      password: 'NovaSenha#2026',
      role: 'member'
    });
    const privateAccess = await request(app).get('/api/payments/pix').set({ Authorization: `Bearer ${login.body.token}` });

    expect(login.status).toBe(200);
    expect(login.body.mustChangePassword).toBe(false);
    expect(privateAccess.status).toBe(200);
  });
});