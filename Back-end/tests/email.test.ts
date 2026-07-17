import { describe, expect, it, vi } from 'vitest';

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

import { sendPasswordResetEmail } from '../src/services/email.js';

describe('e-mail de recuperação', () => {
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
});