import { env } from '../config/env.js';

type PasswordResetEmail = {
  to: string;
  name: string;
  token: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character] ?? character);
}

export async function sendPasswordResetEmail({ to, name, token }: PasswordResetEmail): Promise<boolean> {
  if (env.EMAIL_PROVIDER === 'disabled') return false;
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error('Serviço de e-mail não configurado.');

  const resetUrl = new URL('/reset-password', env.FRONTEND_URL);
  resetUrl.searchParams.set('token', token);
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl.toString());
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject: 'Redefinição de senha da ASSOFIG',
      text: `Olá, ${name}. Use este link para redefinir sua senha: ${resetUrl.toString()}\n\nO link expira em 30 minutos e pode ser utilizado uma única vez.`,
      html: `<p>Olá, ${safeName}.</p><p>Use o link abaixo para redefinir sua senha:</p><p><a href="${safeUrl}">Redefinir senha</a></p><p>O link expira em 30 minutos e pode ser utilizado uma única vez.</p>`
    })
  });

  if (!response.ok) throw new Error(`O serviço de e-mail respondeu com status ${response.status}.`);
  return true;
}