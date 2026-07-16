import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('contrato HTTP básico', () => {
  it('expõe o health check', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('protege a listagem da diretoria', async () => {
    const response = await request(app).get('/api/diretoria/associados');
    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/Token/);
  });

  it('rejeita um formulário de inscrição inválido antes de acessar o banco', async () => {
    const response = await request(app).post('/api/inscricoes').send({ name: 'A' });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Dados inválidos.');
  });

  it('retorna 404 padronizado', async () => {
    const response = await request(app).get('/api/inexistente');
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Endpoint não encontrado.');
  });
});
