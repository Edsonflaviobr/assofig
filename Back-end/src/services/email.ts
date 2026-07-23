import { createHash } from 'node:crypto';
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
type AssociationRequestConfirmationEmail = Pick<ApplicationEmail, 'name' | 'email' | 'document'>;

export async function sendAssociationRequestConfirmationEmail(
  input: AssociationRequestConfirmationEmail
): Promise<boolean> {
  if (!env.RESEND_API_KEY) throw new Error('Serviço de e-mail não configurado.');

  const safeName = escapeHtml(input.name);
  const idempotencyHash = createHash('sha256')
    .update(`${input.email}:${input.document}`)
    .digest('hex');
  const resend = new Resend(env.RESEND_API_KEY);
  const text = `Olá, ${input.name}!

Agradecemos pelo seu interesse em fazer parte da Associação de Fisioterapeutas e Terapeutas Ocupacionais de Guaxupé e Região (ASSOFIG).

Recebemos sua solicitação de associação e ficamos muito felizes com seu interesse. Acreditamos que, juntos, somos mais fortes e podemos contribuir para o fortalecimento da Fisioterapia e da Terapia Ocupacional em nossa região.

Este e-mail confirma o início do processo de análise da sua solicitação. Todos os pedidos são avaliados pela Diretoria da ASSOFIG, conforme os critérios previstos em nosso Estatuto. O prazo para conclusão da análise é de até 30 dias, embora estejamos trabalhando para que esse processo ocorra no menor tempo possível.

PARA DARMOS CONTINUIDADE AO SEU CADASTRO, SOLICITAMOS QUE RESPONDA ESTE E-MAIL COM:

Se você é profissional:
Número de registro no Conselho Regional de Fisioterapia e Terapia Ocupacional (CREFITO).

Se você é estudante:
Comprovante de matrícula atualizado. Aceitamos qualquer documento que contenha seu nome completo, instituição de ensino, curso, RA ou número de matrícula e uma informação que demonstre sua validade ou período letivo, como carteira estudantil, crachá institucional, comprovante da secretaria, documento do portal do aluno ou equivalente.

Se você representa uma empresa:
Comprovante de inscrição no CNPJ, demonstrando atividade relacionada à área de atuação da associação por meio do CNAE principal ou secundário.

Após a aprovação, você receberá um novo e-mail contendo sua senha provisória de acesso à área restrita. O acesso será realizado com o e-mail informado no cadastro e a senha provisória.

Na área restrita você poderá:
- Acessar benefícios e parcerias vigentes da ASSOFIG;
- Realizar inscrições em eventos promovidos pela associação;
- Acompanhar sua situação cadastral e financeira;
- Solicitar seu cartão digital e certificado de associado;
- Utilizar outros serviços exclusivos disponibilizados aos associados.

SOBRE A ANUIDADE

A ASSOFIG possui uma anuidade com vencimento previsto para novembro de cada ano, com pagamento por PIX. As informações sobre valores, vencimentos e situação financeira ficarão disponíveis na área restrita.

Como a associação está em fase inicial de implantação e captação de associados, ainda não há valor definido nem obrigatoriedade de pagamento para profissionais e empresas. O valor será apreciado pela Diretoria e divulgado oficialmente antes do período de cobrança. Nossa expectativa é que corresponda a menos de R$ 10,00 por mês, cobrado anualmente.

Para estudantes associados, será praticada uma contribuição anual de valor simbólico, divulgada oportunamente.

A ASSOFIG está sendo construída para representar, fortalecer e valorizar fisioterapeutas, terapeutas ocupacionais, estudantes e empresas parceiras da nossa região. Esperamos contar com sua participação nessa jornada.

Agradecemos novamente pela confiança e pelo interesse em fazer parte da nossa associação.

Em caso de dúvidas, basta responder este e-mail.

Atenciosamente,

Diretoria da ASSOFIG
Associação de Fisioterapeutas e Terapeutas Ocupacionais de Guaxupé e Região
https://www.assofig.com
contato@assofig.com`;

  const { error } = await resend.emails.send({
    from: 'ASSOFIG <contato@assofig.com>',
    to: [input.email],
    replyTo: 'contato@assofig.com',
    subject: 'Recebemos sua solicitação de associação à ASSOFIG',
    text,
    html: `<div style="margin:0;background:#f3f6f9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#243447;line-height:1.6"><div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #dfe7ee"><div style="background:#0b568f;padding:24px;color:#ffffff"><h1 style="margin:0;font-size:24px;line-height:1.3">Recebemos sua solicitação</h1><p style="margin:8px 0 0">Associação de Fisioterapeutas e Terapeutas Ocupacionais de Guaxupé e Região</p></div><div style="padding:28px"><p style="margin-top:0">Olá, <strong>${safeName}</strong>!</p><p>Agradecemos pelo seu interesse em fazer parte da ASSOFIG.</p><p>Recebemos sua solicitação de associação e ficamos muito felizes com seu interesse. Acreditamos que, juntos, somos mais fortes e podemos contribuir para o fortalecimento da Fisioterapia e da Terapia Ocupacional em nossa região.</p><p>Este e-mail confirma o início do processo de análise da sua solicitação. Todos os pedidos são avaliados pela Diretoria da ASSOFIG, conforme os critérios previstos em nosso Estatuto. O prazo para conclusão da análise é de até <strong>30 dias</strong>.</p><div style="margin:24px 0;padding:18px;background:#eef6fb;border-left:4px solid #0b568f"><p style="margin-top:0"><strong>PARA DARMOS CONTINUIDADE AO SEU CADASTRO, RESPONDA ESTE E-MAIL COM:</strong></p><p><strong>Se você é profissional:</strong><br>Número de registro no Conselho Regional de Fisioterapia e Terapia Ocupacional (CREFITO).</p><p><strong>Se você é estudante:</strong><br>Comprovante de matrícula atualizado contendo nome, instituição, curso, RA ou matrícula e informação de validade ou período letivo. Pode ser carteira estudantil, crachá institucional, comprovante da secretaria, documento do portal do aluno ou equivalente.</p><p style="margin-bottom:0"><strong>Se você representa uma empresa:</strong><br>Comprovante de inscrição no CNPJ que demonstre atividade relacionada à associação por meio do CNAE principal ou secundário.</p></div><p>Após a aprovação, você receberá um novo e-mail com sua senha provisória. O acesso será realizado com o e-mail informado no cadastro.</p><p><strong>Na área restrita você poderá:</strong></p><ul style="padding-left:22px"><li>Acessar benefícios e parcerias vigentes;</li><li>Realizar inscrições em eventos;</li><li>Acompanhar sua situação cadastral e financeira;</li><li>Solicitar cartão digital e certificado de associado;</li><li>Utilizar outros serviços exclusivos.</li></ul><h2 style="font-size:19px;color:#0b568f;margin-top:28px">Sobre a anuidade</h2><p>A ASSOFIG possui uma anuidade com vencimento previsto para novembro, com pagamento por PIX. As informações ficarão disponíveis na área restrita.</p><p>Como a associação está em fase inicial, ainda não há valor definido nem obrigatoriedade de pagamento para profissionais e empresas. A expectativa é de um valor inferior a R$ 10,00 por mês, cobrado anualmente, sujeito à aprovação e divulgação oficial pela Diretoria.</p><p>Para estudantes, será praticada uma contribuição anual simbólica, divulgada oportunamente.</p><p>A ASSOFIG está sendo construída para representar, fortalecer e valorizar profissionais, estudantes e empresas parceiras da nossa região. Esperamos contar com sua participação nessa jornada.</p><p>Em caso de dúvidas, basta responder este e-mail.</p><p style="margin-bottom:0">Atenciosamente,<br><strong>Diretoria da ASSOFIG</strong><br>Associação de Fisioterapeutas e Terapeutas Ocupacionais de Guaxupé e Região<br><a href="https://www.assofig.com" style="color:#0b568f">www.assofig.com</a><br><a href="mailto:contato@assofig.com" style="color:#0b568f">contato@assofig.com</a></p></div></div></div>`
  }, { idempotencyKey: `association-confirmation-${idempotencyHash}` });

  if (error) throw new Error('O serviço de e-mail não concluiu o envio.');
  return true;
}
type PartnerQuestionEmail = {
  memberName: string;
  memberEmail: string;
  memberPhone?: string | null;
  partnerName: string;
  activity: string;
  city: string;
  message: string;
  sentAt: Date;
};

type EventRegistrationRequestEmail = {
  memberName: string;
  memberEmail: string;
  memberPhone?: string | null;
  eventName: string;
  eventDate: string | Date;
  producer: string;
  city: string;
  requestedAt: string | Date;
};

function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(value instanceof Date ? value : new Date(value));
}

export async function sendPartnerQuestionEmail(input: PartnerQuestionEmail): Promise<boolean> {
  if (!env.RESEND_API_KEY) throw new Error('Serviço de e-mail não configurado.');
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: 'ASSOFIG <contato@assofig.com>',
    to: ['contato@assofig.com'],
    replyTo: input.memberEmail,
    subject: `Dúvida sobre parceiro ou benefício - ${input.partnerName}`,
    text: `Nome do associado: ${input.memberName}\nE-mail: ${input.memberEmail}\nTelefone: ${input.memberPhone ?? 'Não informado'}\nParceiro ou benefício: ${input.partnerName}\nAtividade: ${input.activity}\nCidade: ${input.city}\nData e hora: ${formatDateTime(input.sentAt)}\n\nMensagem:\n${input.message}`,
    html: `<p><strong>Nome do associado:</strong> ${escapeHtml(input.memberName)}</p><p><strong>E-mail:</strong> ${escapeHtml(input.memberEmail)}</p><p><strong>Telefone:</strong> ${escapeHtml(input.memberPhone ?? 'Não informado')}</p><p><strong>Parceiro ou benefício:</strong> ${escapeHtml(input.partnerName)}</p><p><strong>Atividade:</strong> ${escapeHtml(input.activity)}</p><p><strong>Cidade:</strong> ${escapeHtml(input.city)}</p><p><strong>Data e hora:</strong> ${escapeHtml(formatDateTime(input.sentAt))}</p><p><strong>Mensagem:</strong><br>${escapeHtml(input.message).replace(/\n/g, '<br>')}</p>`
  });
  if (error) throw new Error('O serviço de e-mail não concluiu o envio.');
  return true;
}

export async function sendEventRegistrationRequestEmail(input: EventRegistrationRequestEmail): Promise<boolean> {
  if (!env.RESEND_API_KEY) throw new Error('Serviço de e-mail não configurado.');
  const resend = new Resend(env.RESEND_API_KEY);
  const eventDate = formatDate(input.eventDate);
  const requestedAt = formatDateTime(input.requestedAt);
  const { error } = await resend.emails.send({
    from: 'ASSOFIG <contato@assofig.com>',
    to: ['contato@assofig.com'],
    replyTo: input.memberEmail,
    subject: `Solicitação de inscrição em evento - ${input.eventName}`,
    text: `Nome do associado: ${input.memberName}\nE-mail: ${input.memberEmail}\nTelefone: ${input.memberPhone ?? 'Não informado'}\nEvento: ${input.eventName}\nData: ${eventDate}\nProdutor: ${input.producer}\nCidade: ${input.city}\nData e hora da solicitação: ${requestedAt}`,
    html: `<p><strong>Nome do associado:</strong> ${escapeHtml(input.memberName)}</p><p><strong>E-mail:</strong> ${escapeHtml(input.memberEmail)}</p><p><strong>Telefone:</strong> ${escapeHtml(input.memberPhone ?? 'Não informado')}</p><p><strong>Evento:</strong> ${escapeHtml(input.eventName)}</p><p><strong>Data:</strong> ${escapeHtml(eventDate)}</p><p><strong>Produtor:</strong> ${escapeHtml(input.producer)}</p><p><strong>Cidade:</strong> ${escapeHtml(input.city)}</p><p><strong>Data e hora da solicitação:</strong> ${escapeHtml(requestedAt)}</p>`
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
