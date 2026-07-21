import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ poolQuery: vi.fn() }));
vi.mock('../src/db/pool.js', () => ({ pool: { query: mocks.poolQuery } }));

import { app } from '../src/app.js';

describe('eventos públicos', () => {
  beforeEach(() => mocks.poolQuery.mockReset());

  it('retorna eventos futuros sem autenticação e somente com campos públicos', async () => {
    mocks.poolQuery.mockResolvedValue({
      rows: [{ id: 2, name: 'Evento próximo', eventDate: '2027-03-10', description: 'Descrição pública' }],
      rowCount: 1
    });

    const response = await request(app).get('/api/public/events');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 2, name: 'Evento próximo', eventDate: '2027-03-10', description: 'Descrição pública' }
    ]);
    expect(response.body[0]).not.toHaveProperty('producer');
    expect(response.body[0]).not.toHaveProperty('registrationStatus');
    const sql = String(mocks.poolQuery.mock.calls[0]?.[0]);
    expect(sql).toContain('e.deleted_at IS NULL');
    expect(sql).toContain("e.registration_status IN ('registration_open', 'registration_waiting')");
    expect(sql).toContain("AT TIME ZONE 'America/Sao_Paulo'");
    expect(sql).toContain('ORDER BY e.event_date,e.name');
  });

  it('retorna lista vazia quando não existem eventos disponíveis', async () => {
    mocks.poolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const response = await request(app).get('/api/public/events');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
