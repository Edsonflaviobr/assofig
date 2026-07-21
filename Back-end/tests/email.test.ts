import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {
    RESEND_API_KEY: 're_teste',
    FRONTEND_URL: 'https://assofig.vercel.app'
  },
  send: vi.fn()
}));

vi.mock('../src/config/env.js', () => ({ env: mocks.env }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.send };
  }
}));

import {
  sendApplicationEmail,
  sendContactEmail,
  sendEventRegistrationRequestEmail,
  sendPartnerQuestionEmail,
  sendPasswordResetEmail,
  sendPaymentProofEmail
} from '../src/services/email.js';

describe('envio de e-mails', () => {
  beforeEach(() => mocks.send.mockReset());
  it('envia o link para FRONTEND_URL sem registrar ou alterar o token', async () => {
    mocks.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });
    const token = 'A'.repeat(43);

    const delivered = await sendPasswordResetEmail({
      to: 'usuario@email.com',
      name: 'Usuário',
      token
    });

    expect(delivered).toBe(true);
    const body = mocks.send.mock.calls[0]?.[0] as { from: string; to: string[]; subject: string; text: string; html: string };
    const expectedUrl = `https://assofig.vercel.app/reset-password?token=${token}`;
    expect(body.from).toBe('ASSOFIG <contato@assofig.com>');
    expect(body.to).toEqual(['usuario@email.com']);
    expect(body.subject).toBe('Recuperação de senha - ASSOFIG');
    expect(body.text).toContain(expectedUrl);
    expect(body.html).toContain(expectedUrl);
    expect(body.html).toContain('Redefinir senha');
    expect(body.html).toContain('30 minutos');
    expect(body.html).toContain('ignore esta mensagem');
  });
  it('envia o contato público para contato@assofig.com', async () => {
    mocks.send.mockResolvedValue({ data: { id: 'contact-id' }, error: null });

    await sendContactEmail({
      name: 'Visitante',
      email: 'visitante@email.com',
      subject: 'Informações',
      message: 'Mensagem enviada pelo site.'
    });

    const body = mocks.send.mock.calls[0]?.[0] as { to: string[]; replyTo: string; subject: string };
    expect(body.to).toEqual(['contato@assofig.com']);
    expect(body.replyTo).toBe('visitante@email.com');
    expect(body.subject).toBe('Contato pelo site - ASSOFIG');
  });

  it('envia a solicitação de associação sem criar cadastro oficial', async () => {
    mocks.send.mockResolvedValue({ data: { id: 'application-id' }, error: null });

    await sendApplicationEmail({
      name: 'Interessada',
      profession: 'Fisioterapeuta',
      email: 'interessada@email.com',
      document: '11444777000161',
      phone: '35999990000',
      city: 'Guaxupé'
    });

    const body = mocks.send.mock.calls[0]?.[0] as { to: string[]; replyTo: string; subject: string };
    expect(body.to).toEqual(['contato@assofig.com']);
    expect(body.replyTo).toBe('interessada@email.com');
    expect(body.subject).toBe('Nova solicitação de associação - ASSOFIG');
  });
  it('envia comprovante ao faturamento com replyTo e anexo em Buffer', async () => {
    mocks.send.mockResolvedValue({ data: { id: 'proof-email-id' }, error: null });
    const proof = Buffer.from('%PDF-1.7 comprovante');

    const emailId = await sendPaymentProofEmail({
      memberName: 'Associada Teste',
      memberEmail: 'associada@email.com',
      delinquencyId: 15,
      amount: 120,
      dueDate: '2026-08-10',
      referenceMonth: '2026-08-01',
      proof: { filename: 'comprovante.pdf', contentType: 'application/pdf', content: proof }
    });

    expect(emailId).toBe('proof-email-id');
    const body = mocks.send.mock.calls[0]?.[0] as {
      to: string[];
      replyTo: string;
      subject: string;
      text: string;
      attachments: Array<{ filename: string; contentType: string; content: Buffer }>;
    };
    expect(body.to).toEqual(['faturamento@assofig.com']);
    expect(body.replyTo).toBe('associada@email.com');
    expect(body.subject).toBe('Comprovante de pagamento - Associada Teste');
    expect(body.text).toContain('08/2026');
    expect(body.text).toContain('120,00');
    expect(body.text).toContain('10/08/2026');
    expect(body.text).toContain('não realiza a baixa automática');
    expect(body.attachments).toEqual([{ filename: 'comprovante.pdf', contentType: 'application/pdf', content: proof }]);
  });
  it('envia dúvida sobre parceiro para contato com Reply-To do associado', async () => {
    mocks.send.mockResolvedValue({ data: { id: 'question-id' }, error: null });
    await sendPartnerQuestionEmail({
      memberName: 'Associada Teste', memberEmail: 'associada@email.com', memberPhone: '35999990000',
      partnerName: 'Clínica Parceira', activity: 'Fisioterapia', city: 'Guaxupé',
      message: 'Como utilizar o benefício?', sentAt: new Date('2026-07-20T15:00:00-03:00')
    });

    const body = mocks.send.mock.calls[0]?.[0] as { to: string[]; replyTo: string; subject: string; text: string };
    expect(body.to).toEqual(['contato@assofig.com']);
    expect(body.replyTo).toBe('associada@email.com');
    expect(body.subject).toBe('Dúvida sobre parceiro ou benefício - Clínica Parceira');
    expect(body.text).toContain('Como utilizar o benefício?');
  });

  it('envia solicitação de evento para contato com Reply-To do associado', async () => {
    mocks.send.mockResolvedValue({ data: { id: 'registration-id' }, error: null });
    await sendEventRegistrationRequestEmail({
      memberName: 'Associada Teste', memberEmail: 'associada@email.com', memberPhone: null,
      eventName: 'Congresso ASSOFIG', eventDate: '2027-08-10', producer: 'ASSOFIG', city: 'Guaxupé',
      requestedAt: new Date('2026-07-20T15:00:00-03:00')
    });

    const body = mocks.send.mock.calls[0]?.[0] as { to: string[]; replyTo: string; subject: string; text: string };
    expect(body.to).toEqual(['contato@assofig.com']);
    expect(body.replyTo).toBe('associada@email.com');
    expect(body.subject).toBe('Solicitação de inscrição em evento - Congresso ASSOFIG');
    expect(body.text).toContain('10/08/2027');
  });
});
