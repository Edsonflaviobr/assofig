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
type PaymentProofEmail = {
  memberName: string;
  memberEmail: string;
  delinquencyId: number;
  amount: number;
  dueDate: string | Date;
  referenceMonth: string | Date | null;
  proof: {
    filename: string;
    contentType: string;
    content: Buffer;
  };
};

function datePart(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatDate(value: string | Date): string {
  const [year, month, day] = datePart(value).split('-');
  return year && month && day ? `${day}/${month}/${year}` : 'Não informada';
}

function formatReference(value: string | Date | null): string {
  if (!value) return 'Não informada';
  const [year, month] = datePart(value).split('-');
  return year && month ? `${month}/${year}` : 'Não informada';
}

export async function sendPaymentProofEmail(input: PaymentProofEmail): Promise<string | null> {
  if (!env.RESEND_API_KEY) throw new Error('Serviço de e-mail não configurado.');

  const reference = formatReference(input.referenceMonth);
  const dueDate = formatDate(input.dueDate);
  const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(input.amount);
  const resend = new Resend(env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: 'ASSOFIG <contato@assofig.com>',
    to: ['faturamento@assofig.com'],
    replyTo: input.memberEmail,
    subject: `Comprovante de pagamento - ${input.memberName}`,
    text: `Comprovante de pagamento recebido\n\nNome do associado:\n${input.memberName}\n\nE-mail:\n${input.memberEmail}\n\nReferência:\n${reference}\n\nValor:\n${amount}\n\nData de vencimento:\n${dueDate}\n\nIdentificador da inadimplência:\n${input.delinquencyId}\n\nO associado enviou um comprovante de pagamento para conferência. O envio do comprovante não realiza a baixa automática da inadimplência.`,
    html: `<h2>Comprovante de pagamento recebido</h2><p><strong>Nome do associado:</strong><br>${escapeHtml(input.memberName)}</p><p><strong>E-mail:</strong><br>${escapeHtml(input.memberEmail)}</p><p><strong>Referência:</strong><br>${escapeHtml(reference)}</p><p><strong>Valor:</strong><br>${escapeHtml(amount)}</p><p><strong>Data de vencimento:</strong><br>${escapeHtml(dueDate)}</p><p><strong>Identificador da inadimplência:</strong><br>${input.delinquencyId}</p><p>O associado enviou um comprovante de pagamento para conferência. O envio do comprovante não realiza a baixa automática da inadimplência.</p>`,
    attachments: [{
      filename: input.proof.filename,
      contentType: input.proof.contentType,
      content: input.proof.content
    }]
  });

  if (error) throw new Error('O serviço de e-mail não concluiu o envio.');
  return data?.id ?? null;
}
