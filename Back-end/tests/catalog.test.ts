import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
  transaction: vi.fn(),
  sendPartnerQuestionEmail: vi.fn(),
  sendEventRegistrationRequestEmail: vi.fn()
}));

vi.mock('../src/db/pool.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../src/db/transaction.js', () => ({ transaction: mocks.transaction }));
vi.mock('../src/services/email.js', () => ({
  sendPartnerQuestionEmail: mocks.sendPartnerQuestionEmail,
  sendEventRegistrationRequestEmail: mocks.sendEventRegistrationRequestEmail,
  sendPaymentProofEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendContactEmail: vi.fn(),
  sendApplicationEmail: vi.fn()
}));

import { app } from '../src/app.js';
import { signToken } from '../src/utils/auth.js';

type Row = Record<string, unknown>;
type QueryResult = { rows: Row[]; rowCount: number };

const adminToken = signToken({ userId: 1, role: 'admin', associadoId: 10 });
const memberToken = signToken({ userId: 2, role: 'member', associadoId: 20 });
const adminAuth = { Authorization: `Bearer ${adminToken}` };
const memberAuth = { Authorization: `Bearer ${memberToken}` };

let partners: Row[];
let events: Row[];
let requests: Set<string>;
let nextPartnerId: number;
let nextEventId: number;

function result(rows: Row[]): QueryResult {
  return { rows, rowCount: rows.length };
}

function partnerFromParams(params: unknown[] = [], existing?: Row): Row {
  return {
    id: existing?.id ?? nextPartnerId++,
    name: params[existing ? 1 : 0],
    email: params[existing ? 2 : 1],
    document: params[existing ? 3 : 2],
    phone: params[existing ? 4 : 3],
    activity: params[existing ? 5 : 4],
    city: params[existing ? 6 : 5],
    status: params[existing ? 7 : 6],
    deletedAt: existing?.deletedAt ?? null
  };
}

function eventFromParams(params: unknown[] = [], existing?: Row): Row {
  return {
    id: existing?.id ?? nextEventId++,
    name: params[existing ? 1 : 0],
    eventDate: params[existing ? 2 : 1],
    description: params[existing ? 3 : 2],
    producer: params[existing ? 4 : 3],
    city: params[existing ? 5 : 4],
    registrationStatus: params[existing ? 6 : 5],
    deletedAt: existing?.deletedAt ?? null
  };
}

function installDatabaseMock(): void {
  mocks.poolQuery.mockImplementation(async (sql: string, params: unknown[] = []): Promise<QueryResult> => {
    if (sql.includes('SELECT must_change_password FROM users')) return result([{ must_change_password: false }]);
    if (sql.includes('SELECT u.associado_id')) {
      return result([{ associado_id: params[0] === 1 ? 10 : 20 }]);
    }
    if (sql.includes('INSERT INTO partners')) {
      const partner = partnerFromParams(params);
      partners.push(partner);
      return result([partner]);
    }
    if (sql.includes('FROM partners ORDER BY name')) {
      return result([...partners].sort((a, b) => String(a.name).localeCompare(String(b.name))));
    }
    if (sql.includes('FROM partners WHERE id=$1')) {
      return result(partners.filter((item) => item.id === params[0]));
    }
    if (sql.includes("FROM partners WHERE status='active'")) {
      return result(partners.filter((item) => item.status === 'active' && item.deletedAt === null));
    }
    if (sql.includes('JOIN associados a ON a.id=$2')) {
      const partner = partners.find((item) => item.id === params[0] && item.status === 'active' && item.deletedAt === null);
      return result(partner ? [{
        partner_name: partner.name,
        activity: partner.activity,
        city: partner.city,
        member_name: 'Associada Teste',
        member_email: 'associada@email.com',
        member_phone: '35999990000'
      }] : []);
    }
    if (sql.includes('UPDATE partners SET name=$2')) {
      const index = partners.findIndex((item) => item.id === params[0] && item.deletedAt === null);
      if (index < 0) return result([]);
      partners[index] = partnerFromParams(params, partners[index]);
      return result([partners[index]!]);
    }
    if (sql.includes('UPDATE partners SET deleted_at=NOW()')) {
      const partner = partners.find((item) => item.id === params[0] && item.deletedAt === null);
      if (!partner) return result([]);
      partner.deletedAt = new Date().toISOString();
      return result([{ id: partner.id }]);
    }
    if (sql.includes('INSERT INTO events')) {
      const event = eventFromParams(params);
      events.push(event);
      return result([event]);
    }
    if (sql.includes('FROM events WHERE deleted_at IS NULL ORDER BY event_date DESC')) {
      return result(events
        .filter((item) => item.deletedAt === null)
        .sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate))));
    }
    if (sql.includes('FROM events WHERE id=$1')) return result(events.filter((item) => item.id === params[0]));
    if (sql.includes('UPDATE events SET name=$2')) {
      const index = events.findIndex((item) => item.id === params[0] && item.deletedAt === null);
      if (index < 0) return result([]);
      events[index] = eventFromParams(params, events[index]);
      return result([events[index]!]);
    }
    if (sql.includes('UPDATE events SET deleted_at=NOW()')) {
      const event = events.find((item) => item.id === params[0] && item.deletedAt === null);
      if (!event) return result([]);
      event.deletedAt = new Date().toISOString();
      return result([{ id: event.id }]);
    }
    if (sql.includes('LEFT JOIN event_registration_requests')) {
      return result(events
        .filter((item) => item.deletedAt === null && String(item.eventDate) >= '2026-01-01')
        .map((item) => ({ ...item, registrationRequested: requests.has(`${item.id}:${params[0]}`) })));
    }
    return result([]);
  });

  mocks.clientQuery.mockImplementation(async (sql: string, params: unknown[] = []): Promise<QueryResult> => {
    if (sql.includes('SELECT * FROM partners')) {
      const partner = partners.find((item) => item.id === params[0] && item.deletedAt === null);
      return result(partner ? [{
        ...partner,
        deleted_at: partner.deletedAt
      }] : []);
    }
    if (sql.includes('UPDATE partners SET name=$2')) {
      const index = partners.findIndex((item) => item.id === params[0]);
      partners[index] = partnerFromParams(params, partners[index]);
      return result([partners[index]!]);
    }
    if (sql.includes('SELECT * FROM events')) {
      const event = events.find((item) => item.id === params[0] && item.deletedAt === null);
      return result(event ? [{
        ...event,
        event_date: event.eventDate,
        registration_status: event.registrationStatus,
        deleted_at: event.deletedAt
      }] : []);
    }
    if (sql.includes('UPDATE events SET name=$2')) {
      const index = events.findIndex((item) => item.id === params[0]);
      events[index] = eventFromParams(params, events[index]);
      return result([events[index]!]);
    }
    if (sql.includes('FROM events') && sql.includes('FOR SHARE')) {
      const event = events.find((item) => item.id === params[0] && item.deletedAt === null && String(item.eventDate) >= '2026-01-01');
      return result(event ? [{
        id: event.id,
        name: event.name,
        event_date: event.eventDate,
        producer: event.producer,
        city: event.city,
        registration_status: event.registrationStatus
      }] : []);
    }
    if (sql.includes('SELECT name,email,phone FROM associados')) {
      return result([{ name: 'Associada Teste', email: 'associada@email.com', phone: '35999990000' }]);
    }
    if (sql.includes('INSERT INTO event_registration_requests')) {
      const key = `${params[0]}:${params[1]}`;
      if (requests.has(key)) return result([]);
      requests.add(key);
      return result([{ id: requests.size, requested_at: new Date('2026-07-20T15:00:00-03:00') }]);
    }
    return result([]);
  });
}

describe('parceiros e eventos', () => {
  beforeEach(() => {
    partners = [];
    events = [];
    requests = new Set();
    nextPartnerId = 1;
    nextEventId = 1;
    mocks.poolQuery.mockReset();
    mocks.clientQuery.mockReset();
    mocks.transaction.mockReset();
    mocks.sendPartnerQuestionEmail.mockReset().mockResolvedValue(true);
    mocks.sendEventRegistrationRequestEmail.mockReset().mockResolvedValue(true);
    installDatabaseMock();
    mocks.transaction.mockImplementation(async (work: (client: { query: typeof mocks.clientQuery }) => Promise<unknown>) => {
      const requestSnapshot = new Set(requests);
      try {
        return await work({ query: mocks.clientQuery });
      } catch (error) {
        requests = requestSnapshot;
        throw error;
      }
    });
  });

  it('administrador cria parceiros ativos e inativos', async () => {
    const active = await request(app).post('/api/admin/partners').set(adminAuth).send({
      name: 'Clínica Parceira', email: 'clinica@email.com', document: '11444777000161',
      phone: '35999990000', activity: 'Fisioterapia', city: 'Guaxupé', status: 'active'
    });
    const inactive = await request(app).post('/api/admin/partners').set(adminAuth).send({
      name: 'Profissional Parceiro', email: 'profissional@email.com', document: '11995365637',
      phone: '35988880000', activity: 'Pilates', city: 'Muzambinho', status: 'inactive'
    });

    expect(active.status).toBe(201);
    expect(inactive.status).toBe(201);
    expect(partners.map((item) => item.status)).toEqual(['active', 'inactive']);
  });

  it('administrador edita e exclui parceiro logicamente', async () => {
    partners.push({ id: 1, name: 'Parceiro', email: 'parceiro@email.com', document: '11995365637', phone: '35999990000', activity: 'Pilates', city: 'Guaxupé', status: 'active', deletedAt: null });
    const edited = await request(app).patch('/api/admin/partners/1').set(adminAuth).send({ city: 'Muzambinho' });
    const removed = await request(app).delete('/api/admin/partners/1').set(adminAuth);

    expect(edited.status).toBe(200);
    expect(edited.body.city).toBe('Muzambinho');
    expect(removed.status).toBe(200);
    expect(partners[0]?.deletedAt).not.toBeNull();
  });

  it('associado vê somente parceiros ativos e não excluídos', async () => {
    partners = [
      { id: 1, name: 'Ativo', status: 'active', deletedAt: null },
      { id: 2, name: 'Inativo', status: 'inactive', deletedAt: null },
      { id: 3, name: 'Excluído', status: 'active', deletedAt: '2026-01-01' }
    ];
    const response = await request(app).get('/api/member/partners').set(memberAuth);

    expect(response.status).toBe(200);
    expect(response.body.map((item: Row) => item.name)).toEqual(['Ativo']);
  });

  it('associado envia dúvida com seus dados no e-mail', async () => {
    partners.push({ id: 1, name: 'Clínica', activity: 'Fisioterapia', city: 'Guaxupé', status: 'active', deletedAt: null });
    const response = await request(app).post('/api/member/partners/1/question').set(memberAuth).send({ message: 'Como utilizar o benefício?' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mocks.sendPartnerQuestionEmail).toHaveBeenCalledWith(expect.objectContaining({
      memberEmail: 'associada@email.com', partnerName: 'Clínica', message: 'Como utilizar o benefício?'
    }));
  });

  it('protege rotas e impede associado comum de administrar parceiros', async () => {
    const unauthenticated = await request(app).get('/api/member/partners');
    const forbidden = await request(app).get('/api/admin/partners').set(memberAuth);

    expect(unauthenticated.status).toBe(401);
    expect(forbidden.status).toBe(403);
  });

  it('administrador cria, edita e exclui evento e mantém o histórico', async () => {
    const created = await request(app).post('/api/admin/events').set(adminAuth).send({
      name: 'Congresso', eventDate: '2027-08-10', description: 'Evento científico',
      producer: 'ASSOFIG', city: 'Guaxupé', registrationStatus: 'registration_open'
    });
    events.push({ id: 2, name: 'Evento passado', eventDate: '2020-01-10', description: 'Histórico', producer: 'ASSOFIG', city: 'Guaxupé', registrationStatus: 'registration_waiting', deletedAt: null });
    const edited = await request(app).patch('/api/admin/events/1').set(adminAuth).send({ city: 'Muzambinho' });
    const removed = await request(app).delete('/api/admin/events/1').set(adminAuth);
    const history = await request(app).get('/api/admin/events').set(adminAuth);

    expect(created.status).toBe(201);
    expect(edited.body.city).toBe('Muzambinho');
    expect(removed.status).toBe(200);
    expect(history.body.map((item: Row) => item.name)).toContain('Evento passado');
    expect(history.body.map((item: Row) => item.name)).not.toContain('Congresso');
  });

  it('associado vê somente eventos atuais/futuros e o estado persistido da solicitação', async () => {
    events = [
      { id: 1, name: 'Futuro', eventDate: '2099-10-10', registrationStatus: 'registration_open', deletedAt: null },
      { id: 2, name: 'Passado', eventDate: '2020-01-10', registrationStatus: 'registration_open', deletedAt: null },
      { id: 3, name: 'Excluído', eventDate: '2099-11-10', registrationStatus: 'registration_open', deletedAt: '2026-01-01' }
    ];
    requests.add('1:20');
    const response = await request(app).get('/api/member/events/upcoming').set(memberAuth);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ name: 'Futuro', registrationRequested: true });
  });

  it('evento aguardando inscrição não permite solicitação', async () => {
    events.push({ id: 1, name: 'Evento', eventDate: '2099-10-10', producer: 'ASSOFIG', city: 'Guaxupé', registrationStatus: 'registration_waiting', deletedAt: null });
    const response = await request(app).post('/api/member/events/1/registration-request').set(memberAuth);

    expect(response.status).toBe(409);
    expect(mocks.sendEventRegistrationRequestEmail).not.toHaveBeenCalled();
  });

  it('evento aberto registra solicitação e envia um único e-mail', async () => {
    events.push({ id: 1, name: 'Evento', eventDate: '2099-10-10', producer: 'ASSOFIG', city: 'Guaxupé', registrationStatus: 'registration_open', deletedAt: null });
    const first = await request(app).post('/api/member/events/1/registration-request').set(memberAuth);
    const duplicate = await request(app).post('/api/member/events/1/registration-request').set(memberAuth);

    expect(first.status).toBe(201);
    expect(first.body.success).toBe(true);
    expect(duplicate.status).toBe(409);
    expect(mocks.sendEventRegistrationRequestEmail).toHaveBeenCalledTimes(1);
  });

  it('reverte a solicitação quando o Resend falha', async () => {
    events.push({ id: 1, name: 'Evento', eventDate: '2099-10-10', producer: 'ASSOFIG', city: 'Guaxupé', registrationStatus: 'registration_open', deletedAt: null });
    mocks.sendEventRegistrationRequestEmail.mockRejectedValueOnce(new Error('Resend indisponível'));
    const failed = await request(app).post('/api/member/events/1/registration-request').set(memberAuth);
    const retry = await request(app).post('/api/member/events/1/registration-request').set(memberAuth);

    expect(failed.status).toBe(502);
    expect(retry.status).toBe(201);
    expect(requests.has('1:20')).toBe(true);
  });
});
