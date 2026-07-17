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

import { sendApplicationEmail, sendContactEmail, sendPasswordResetEmail } from '../src/services/email.js';

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
});