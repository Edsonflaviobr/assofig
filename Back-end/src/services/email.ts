import { Resend } from 'resend';
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
  if (!env.RESEND_API_KEY) throw new Error('Serviço de e-mail não configurado.');

  const resetUrl = new URL('/reset-password', env.FRONTEND_URL);
  resetUrl.searchParams.set('token', token);
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl.toString());
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: 'ASSOFIG <contato@assofig.com>',
    to: [to],
    subject: 'Recuperação de senha - ASSOFIG',
    text: `Olá, ${name}. Houve uma solicitação de recuperação de senha para sua conta.\n\nRedefinir senha: ${resetUrl.toString()}\n\nEste link expira em 30 minutos. Se você não fez esta solicitação, ignore esta mensagem.`,
    html: `<p>Olá, ${safeName}.</p><p>Houve uma solicitação de recuperação de senha para sua conta.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px">Redefinir senha</a></p><p>Se o botão não funcionar, acesse este link:</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>Este link expira em 30 minutos.</p><p>Se você não fez esta solicitação, ignore esta mensagem.</p>`
  });

  if (error) throw new Error('O serviço de e-mail não concluiu o envio.');
  return true;
}