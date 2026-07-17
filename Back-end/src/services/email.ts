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

type ContactEmail = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

type ApplicationEmail = {
  name: string;
  profession: string;
  email: string;
  document: string;
  phone: string;
  registry?: string;
  city: string;
};

export async function sendContactEmail(input: ContactEmail): Promise<boolean> {
  if (!env.RESEND_API_KEY) throw new Error('Serviço de e-mail não configurado.');
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: 'ASSOFIG <contato@assofig.com>',
    to: ['contato@assofig.com'],
    replyTo: input.email,
    subject: 'Contato pelo site - ASSOFIG',
    text: `Nome: ${input.name}\nE-mail: ${input.email}\nAssunto: ${input.subject}\n\n${input.message}`,
    html: `<p><strong>Nome:</strong> ${escapeHtml(input.name)}</p><p><strong>E-mail:</strong> ${escapeHtml(input.email)}</p><p><strong>Assunto:</strong> ${escapeHtml(input.subject)}</p><p>${escapeHtml(input.message).replace(/\n/g, '<br>')}</p>`
  });
  if (error) throw new Error('O serviço de e-mail não concluiu o envio.');
  return true;
}

export async function sendApplicationEmail(input: ApplicationEmail): Promise<boolean> {
  if (!env.RESEND_API_KEY) throw new Error('Serviço de e-mail não configurado.');
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: 'ASSOFIG <contato@assofig.com>',
    to: ['contato@assofig.com'],
    replyTo: input.email,
    subject: 'Nova solicitação de associação - ASSOFIG',
    text: `Nome: ${input.name}\nProfissão: ${input.profession}\nE-mail: ${input.email}\nDocumento: ${input.document}\nTelefone: ${input.phone}\nRegistro: ${input.registry ?? ''}\nCidade: ${input.city}`,
    html: `<p><strong>Nome:</strong> ${escapeHtml(input.name)}</p><p><strong>Profissão:</strong> ${escapeHtml(input.profession)}</p><p><strong>E-mail:</strong> ${escapeHtml(input.email)}</p><p><strong>Documento:</strong> ${escapeHtml(input.document)}</p><p><strong>Telefone:</strong> ${escapeHtml(input.phone)}</p><p><strong>Registro:</strong> ${escapeHtml(input.registry ?? '')}</p><p><strong>Cidade:</strong> ${escapeHtml(input.city)}</p>`
  });
  if (error) throw new Error('O serviço de e-mail não concluiu o envio.');
  return true;
}