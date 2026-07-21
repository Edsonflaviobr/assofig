import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(), transaction: vi.fn(), sendPaymentProofEmail: vi.fn()
}));

vi.mock('../src/db/pool.js', () => ({ pool: { query: mocks.poolQuery } }));
vi.mock('../src/db/transaction.js', () => ({ transaction: mocks.transaction }));
vi.mock('../src/services/email.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/email.js')>()),
  sendPaymentProofEmail: mocks.sendPaymentProofEmail
}));

import { app } from '../src/app.js';
import { signToken } from '../src/utils/auth.js';

const memberToken = signToken({ userId: 7, role: 'member', associadoId: 99 });
const auth = { Authorization: `Bearer ${memberToken}` };
type FakeResult = { rows: Array<Record<string, unknown>>; rowCount: number };
type FakeClient = { query: ReturnType<typeof vi.fn> };
type TransactionWork = (client: FakeClient) => Promise<unknown>;

function allowMemberAccess(associadoId = 99): void {
  mocks.poolQuery.mockResolvedValueOnce({ rows: [{ must_change_password: false }], rowCount: 1 });
  mocks.poolQuery.mockResolvedValueOnce({ rows: [{ associado_id: associadoId }], rowCount: 1 });
}
function ownOpenDelinquency(): void {
  mocks.poolQuery.mockResolvedValueOnce({ rows: [{ id: 15, status: 'open' }], rowCount: 1 });
}
function installTransaction(clientQuery: ReturnType<typeof vi.fn>): void {
  mocks.transaction.mockImplementation((work: TransactionWork) => work({ query: clientQuery }));
}
const validPdf = Buffer.from('%PDF-1.7 comprovante');

describe('inadimplências do associado e comprovante', () => {
  beforeEach(() => {
    mocks.poolQuery.mockReset();
    mocks.transaction.mockReset();
    mocks.sendPaymentProofEmail.mockReset();
  });

  it('exige autenticação na consulta pessoal', async () => {
    const response = await request(app).get('/api/member/inadimplencias');
    expect(response.status).toBe(401);
  });

  it('lista somente inadimplências do associado vinculado e normaliza resolved como paid', async () => {
    allowMemberAccess();
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [
        { id: 15, amount: 120, dueDate: '2026-08-10', referenceMonth: '2026-08-01', status: 'open', proofSentAt: null },
        { id: 14, amount: 80, dueDate: '2026-07-10', referenceMonth: '2026-07-01', status: 'paid', proofSentAt: null }
      ], rowCount: 2
    });

    const response = await request(app).get('/api/member/inadimplencias?associadoId=500').set(auth);

    expect(response.status).toBe(200);
    expect(response.body.inadimplencias).toHaveLength(2);
    expect(response.body.inadimplencias[1].status).toBe('paid');
    expect(mocks.poolQuery.mock.calls[2]?.[1]).toEqual([99]);
    expect(String(mocks.poolQuery.mock.calls[2]?.[0])).toContain("WHEN 'resolved' THEN 'paid'");
  });

  it('mantém o alias usado pela camada de API do frontend', async () => {
    allowMemberAccess();
    mocks.poolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const response = await request(app).get('/api/auth/me/inadimplencias').set(auth);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ inadimplencias: [] });
  });

  it('retorna erro claro quando o usuário não possui vínculo de associado', async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ must_change_password: false }], rowCount: 1 });
    mocks.poolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const response = await request(app).get('/api/member/inadimplencias').set(auth);
    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/sem vínculo com associado/i);
  });

  it('não processa arquivo quando a inadimplência não pertence ao associado', async () => {
    allowMemberAccess();
    mocks.poolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const response = await request(app).post('/api/member/inadimplencias/15/comprovante').set(auth)
      .attach('proof', validPdf, { filename: 'comprovante.pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.sendPaymentProofEmail).not.toHaveBeenCalled();
  });

  it('impede comprovante para inadimplência quitada', async () => {
    allowMemberAccess();
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ id: 15, status: 'resolved' }], rowCount: 1 });
    const response = await request(app).post('/api/member/inadimplencias/15/comprovante').set(auth)
      .attach('proof', validPdf, { filename: 'comprovante.pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/já quitada/i);
    expect(mocks.sendPaymentProofEmail).not.toHaveBeenCalled();
  });

  it('rejeita arquivo ausente', async () => {
    allowMemberAccess(); ownOpenDelinquency();
    const response = await request(app).post('/api/member/inadimplencias/15/comprovante').set(auth);
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/campo proof/i);
  });

  it('rejeita tipo MIME não permitido', async () => {
    allowMemberAccess(); ownOpenDelinquency();
    const response = await request(app).post('/api/member/inadimplencias/15/comprovante').set(auth)
      .attach('proof', Buffer.from('arquivo'), { filename: 'comprovante.txt', contentType: 'text/plain' });
    expect(response.status).toBe(415);
    expect(response.body.message).toMatch(/formato de arquivo inválido/i);
  });

  it('rejeita conteúdo incompatível com o MIME informado', async () => {
    allowMemberAccess(); ownOpenDelinquency();
    const response = await request(app).post('/api/member/inadimplencias/15/comprovante').set(auth)
      .attach('proof', Buffer.from('não é pdf'), { filename: 'falso.pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(415);
    expect(response.body.message).toMatch(/conteúdo do arquivo/i);
  });

  it('rejeita arquivo maior que 10 MB', async () => {
    allowMemberAccess(); ownOpenDelinquency();
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1); oversized.write('%PDF-');
    const response = await request(app).post('/api/member/inadimplencias/15/comprovante').set(auth)
      .attach('proof', oversized, { filename: 'grande.pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(413);
    expect(response.body.message).toMatch(/no máximo 10 MB/i);
  });

  it('não altera o banco quando o Resend falha', async () => {
    allowMemberAccess(); ownOpenDelinquency();
    const clientQuery = vi.fn(async (sql: string): Promise<FakeResult> => {
      if (sql.includes('FOR UPDATE')) return { rows: [{ id: 15, amount: 120, due_date: '2026-08-10', reference_month: '2026-08-01', status: 'open', associado_name: 'Associada', associado_email: 'associada@email.com' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    installTransaction(clientQuery);
    mocks.sendPaymentProofEmail.mockRejectedValue(new Error('Resend indisponível'));
    const response = await request(app).post('/api/member/inadimplencias/15/comprovante').set(auth)
      .attach('proof', validPdf, { filename: 'comprovante.pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(502);
    expect(response.body.message).toMatch(/enviar o comprovante por e-mail/i);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('UPDATE inadimplencias'))).toBe(false);
  });

  it('envia o anexo e só então registra proof_sent', async () => {
    allowMemberAccess(); ownOpenDelinquency();
    const clientQuery = vi.fn(async (sql: string, params?: unknown[]): Promise<FakeResult> => {
      if (sql.includes('FOR UPDATE')) return { rows: [{ id: 15, amount: 120, due_date: '2026-08-10', reference_month: '2026-08-01', status: 'open', associado_name: 'Associada', associado_email: 'associada@email.com' }], rowCount: 1 };
      if (sql.includes('UPDATE inadimplencias')) {
        expect(params).toEqual([15, 99, 'resend-email-id']);
        return { rows: [{ id: 15, status: 'proof_sent', proofSentAt: '2026-07-20T12:00:00.000Z' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    installTransaction(clientQuery);
    mocks.sendPaymentProofEmail.mockResolvedValue('resend-email-id');
    const response = await request(app).post('/api/member/inadimplencias/15/comprovante').set(auth)
      .attach('proof', validPdf, { filename: 'comprovante.pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Comprovante enviado com sucesso. O pagamento será conferido pela Diretoria.', inadimplencia: { id: 15, status: 'proof_sent', proofSentAt: '2026-07-20T12:00:00.000Z' } });
    expect(mocks.sendPaymentProofEmail).toHaveBeenCalledOnce();
    const email = mocks.sendPaymentProofEmail.mock.calls[0]?.[0];
    expect(email).toMatchObject({ memberName: 'Associada', memberEmail: 'associada@email.com', delinquencyId: 15 });
    expect(email.proof).toMatchObject({ filename: 'comprovante.pdf', contentType: 'application/pdf' });
    expect(email.proof.content).toEqual(validPdf);
    const updateOrder = clientQuery.mock.invocationCallOrder.at(-1)!;
    expect(updateOrder).toBeGreaterThan(mocks.sendPaymentProofEmail.mock.invocationCallOrder[0]!);
  });
});
