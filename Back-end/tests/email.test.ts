import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_teste',
    EMAIL_FROM: 'no-reply@assofig.test',
    FRONTEND_URL: 'https://assofig.vercel.app'
  }
}));

vi.mock('../src/config/env.js', () => ({ env: mocks.env }));

import { sendPasswordResetEmail } from '../src/services/email.js';

describe('e-mail de recuperação', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envia o link para FRONTEND_URL sem registrar ou alterar o token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const token = 'A'.repeat(43);

    const delivered = await sendPasswordResetEmail({
      to: 'usuario@email.com',
      name: 'Usuário',
      token
    });

    expect(delivered).toBe(true);
    const requestOptions = fetchMock.mock.calls[0]?.[1] as { body: string };
    const body = JSON.parse(requestOptions.body) as { text: string; html: string };
    const expectedUrl = `https://assofig.vercel.app/reset-password?token=${token}`;
    expect(body.text).toContain(expectedUrl);
    expect(body.html).toContain(expectedUrl);
  });
});