import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  sendApplicationEmail: vi.fn(),
  sendAssociationRequestConfirmationEmail: vi.fn(),
  sendContactEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn()
}));

vi.mock('../src/db/pool.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../src/services/email.js', () => ({
  sendApplicationEmail: mocks.sendApplicationEmail,
  sendAssociationRequestConfirmationEmail: mocks.sendAssociationRequestConfirmationEmail,
  sendContactEmail: mocks.sendContactEmail,
  sendPasswordResetEmail: mocks.sendPasswordResetEmail
}));

import { app } from '../src/app.js';

describe('formulários públicos separados do cadastro oficial', () => {
  beforeEach(() => {
    mocks.poolQuery.mockReset();
    mocks.sendApplicationEmail.mockReset();
    mocks.sendAssociationRequestConfirmationEmail.mockReset();
    mocks.sendContactEmail.mockReset();
    mocks.sendPasswordResetEmail.mockReset();
  });

  it('armazena interesse em inscricoes, não cria associado e envia à ASSOFIG', async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ id: 8, status: 'recebida' }], rowCount: 1 });
    mocks.sendApplicationEmail.mockResolvedValue(true);
    mocks.sendAssociationRequestConfirmationEmail.mockResolvedValue(true);

    const response = await request(app).post('/api/inscricoes').send({
      name: 'Pessoa Interessada',
      profession: 'Fisioterapeuta',
      email: 'interessada@email.com',
      cpfCnpj: '11.444.777/0001-61',
      phone: '(35) 99999-0000',
      city: 'Guaxupé'
    });

    expect(response.status).toBe(201);
    expect(String(mocks.poolQuery.mock.calls[0]?.[0])).toContain('INSERT INTO inscricoes');
    expect(String(mocks.poolQuery.mock.calls[0]?.[0])).not.toContain('associados');
    expect(mocks.sendApplicationEmail).toHaveBeenCalledOnce();
    expect(mocks.sendAssociationRequestConfirmationEmail).toHaveBeenCalledOnce();
    expect(mocks.poolQuery.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sendAssociationRequestConfirmationEmail.mock.invocationCallOrder[0]!
    );
  });

  it('mantém o cadastro e a resposta quando o e-mail de confirmação falha', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ id: 9, status: 'recebida' }], rowCount: 1 });
    mocks.sendApplicationEmail.mockResolvedValue(true);
    mocks.sendAssociationRequestConfirmationEmail.mockRejectedValue(new Error('falha interna'));
    try {
      const response = await request(app).post('/api/inscricoes').send({
        name: 'Pessoa Interessada', profession: 'Fisioterapeuta', email: 'interessada@email.com',
        cpfCnpj: '11.444.777/0001-61', phone: '(35) 99999-0000', city: 'Guaxupé'
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: 9, status: 'recebida' });
      expect(mocks.poolQuery).toHaveBeenCalledOnce();
      expect(consoleError).toHaveBeenCalledWith('Falha ao enviar confirmação da solicitação de associação por e-mail.');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('não envia confirmação quando o cadastro não é salvo', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.poolQuery.mockRejectedValueOnce(new Error('banco indisponível'));
    try {
      const response = await request(app).post('/api/inscricoes').send({
        name: 'Pessoa Interessada', profession: 'Fisioterapeuta', email: 'interessada@email.com',
        cpfCnpj: '11.444.777/0001-61', phone: '(35) 99999-0000', city: 'Guaxupé'
      });

      expect(response.status).toBe(500);
      expect(mocks.sendApplicationEmail).not.toHaveBeenCalled();
      expect(mocks.sendAssociationRequestConfirmationEmail).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
  it('preserva o contato no banco e envia a mensagem institucional', async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    mocks.sendContactEmail.mockResolvedValue(true);

    const response = await request(app).post('/api/contato').send({
      name: 'Visitante do Site',
      email: 'visitante@email.com',
      subject: 'Informações',
      message: 'Gostaria de receber mais informações.'
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ sent: true });
    expect(String(mocks.poolQuery.mock.calls[0]?.[0])).toContain('INSERT INTO contatos');
    expect(mocks.sendContactEmail).toHaveBeenCalledOnce();
  });

  it('preserva a resposta pública e o registro quando o e-mail falha', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.poolQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    mocks.sendContactEmail.mockRejectedValue(new Error('falha interna'));
    try {
      const response = await request(app).post('/api/contato').send({
        name: 'Visitante do Site',
        email: 'visitante@email.com',
        subject: 'Informações',
        message: 'Gostaria de receber mais informações.'
      });
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ sent: true });
    } finally {
      consoleError.mockRestore();
    }
  });
});