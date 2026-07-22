import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { transaction } from '../db/transaction.js';
import { authenticate, requireAdmin, requirePasswordChangeCompleted } from '../middleware/auth.js';
import { dateSchema, emailSchema, idSchema } from '../schemas/common.js';
import { sendEventRegistrationRequestEmail, sendPartnerQuestionEmail } from '../services/email.js';
import { listUpcomingMemberEvents } from '../services/events.js';
import { ApiError } from '../utils/api-error.js';
import { documentSchema, readDocumentInput } from '../utils/document.js';

export const adminCatalogRouter = Router();
export const memberCatalogRouter = Router();

adminCatalogRouter.use(authenticate, requirePasswordChangeCompleted, requireAdmin);

const partnerSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: emailSchema,
  document: documentSchema,
  phone: z.string().trim().min(8).max(30),
  activity: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(120),
  status: z.enum(['active', 'inactive'])
});

const eventSchema = z.object({
  name: z.string().trim().min(2).max(160),
  eventDate: dateSchema,
  description: z.string().trim().min(3).max(10_000),
  producer: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(120),
  registrationStatus: z.enum(['registration_open', 'registration_waiting'])
});

const questionSchema = z.object({
  message: z.string().trim().min(1).max(5000)
});

function partnerInput(body: Record<string, unknown>) {
  return { ...body, document: readDocumentInput(body) };
}

function eventInput(body: Record<string, unknown>) {
  const input = { ...body };
  if (body.eventDate !== undefined || body.event_date !== undefined) {
    input.eventDate = body.eventDate ?? body.event_date;
  }
  if (body.registrationStatus !== undefined || body.registration_status !== undefined) {
    input.registrationStatus = body.registrationStatus ?? body.registration_status;
  }
  return input;
}

const partnerColumns = `
  id, name, email, document, phone, activity, city, status,
  created_at AS "createdAt", updated_at AS "updatedAt", deleted_at AS "deletedAt"`;

const eventColumns = `
  id, name, event_date AS "eventDate", description, producer, city,
  registration_status AS "registrationStatus",
  created_at AS "createdAt", updated_at AS "updatedAt", deleted_at AS "deletedAt"`;

adminCatalogRouter.post('/partners', async (req, res) => {
  const input = partnerSchema.parse(partnerInput(req.body ?? {}));
  const result = await pool.query(
    `INSERT INTO partners (name,email,document,phone,activity,city,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${partnerColumns}`,
    [input.name, input.email, input.document, input.phone, input.activity, input.city, input.status]
  );
  res.status(201).json(result.rows[0]);
});

adminCatalogRouter.get('/partners', async (_req, res) => {
  const result = await pool.query(`SELECT ${partnerColumns} FROM partners ORDER BY name`);
  res.json(result.rows);
});

adminCatalogRouter.get('/partners/:id', async (req, res) => {
  const result = await pool.query(`SELECT ${partnerColumns} FROM partners WHERE id=$1`, [idSchema.parse(req.params.id)]);
  if (!result.rowCount) throw new ApiError(404, 'Parceiro não encontrado.');
  res.json(result.rows[0]);
});

adminCatalogRouter.patch('/partners/:id', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const rawDocument = readDocumentInput(req.body);
  const input = partnerSchema.partial().parse(rawDocument === undefined ? (req.body ?? {}) : { ...req.body, document: rawDocument });
  if (!Object.keys(input).length) throw new ApiError(400, 'Informe ao menos um campo para alteração.');
  const partner = await transaction(async (client) => {
    const currentResult = await client.query('SELECT * FROM partners WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [id]);
    if (!currentResult.rowCount) throw new ApiError(404, 'Parceiro não encontrado.');
    const next = { ...currentResult.rows[0], ...input };
    const result = await client.query(
      `UPDATE partners SET name=$2,email=$3,document=$4,phone=$5,activity=$6,city=$7,status=$8,updated_at=NOW()
       WHERE id=$1 RETURNING ${partnerColumns}`,
      [id, next.name, next.email, next.document, next.phone, next.activity, next.city, next.status]
    );
    return result.rows[0];
  });
  res.json(partner);
});

adminCatalogRouter.put('/partners/:id', async (req, res) => {
  const input = partnerSchema.parse(partnerInput(req.body ?? {}));
  const result = await pool.query(
    `UPDATE partners SET name=$2,email=$3,document=$4,phone=$5,activity=$6,city=$7,status=$8,updated_at=NOW()
     WHERE id=$1 AND deleted_at IS NULL RETURNING ${partnerColumns}`,
    [idSchema.parse(req.params.id), input.name, input.email, input.document, input.phone, input.activity, input.city, input.status]
  );
  if (!result.rowCount) throw new ApiError(404, 'Parceiro não encontrado.');
  res.json(result.rows[0]);
});

adminCatalogRouter.delete('/partners/:id', async (req, res) => {
  const result = await pool.query(
    'UPDATE partners SET deleted_at=NOW(),updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL RETURNING id',
    [idSchema.parse(req.params.id)]
  );
  if (!result.rowCount) throw new ApiError(404, 'Parceiro não encontrado.');
  res.json(result.rows[0]);
});

memberCatalogRouter.get('/partners', async (_req, res) => {
  const result = await pool.query(
    `SELECT id,name,email,document,phone,activity,city
     FROM partners WHERE status='active' AND deleted_at IS NULL ORDER BY name`
  );
  res.json(result.rows);
});

memberCatalogRouter.post('/partners/:partnerId/question', async (req, res) => {
  const partnerId = idSchema.parse(req.params.partnerId);
  const input = questionSchema.parse(req.body);
  const result = await pool.query(
    `SELECT p.name AS partner_name,p.activity,p.city,
            a.name AS member_name,a.email AS member_email,a.phone AS member_phone
     FROM partners p
     JOIN associados a ON a.id=$2
     WHERE p.id=$1 AND p.status='active' AND p.deleted_at IS NULL`,
    [partnerId, req.auth!.associadoId]
  );
  if (!result.rowCount) throw new ApiError(404, 'Parceiro ativo não encontrado.');
  const item = result.rows[0];
  try {
    await sendPartnerQuestionEmail({
      memberName: item.member_name,
      memberEmail: item.member_email,
      memberPhone: item.member_phone,
      partnerName: item.partner_name,
      activity: item.activity,
      city: item.city,
      message: input.message,
      sentAt: new Date()
    });
  } catch {
    throw new ApiError(502, 'Não foi possível enviar a mensagem. Tente novamente.');
  }
  res.json({ success: true, message: 'Mensagem enviada. Aguarde as instruções da Diretoria por e-mail.' });
});

adminCatalogRouter.post('/events', async (req, res) => {
  const input = eventSchema.parse(eventInput(req.body ?? {}));
  const result = await pool.query(
    `INSERT INTO events (name,event_date,description,producer,city,registration_status)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${eventColumns}`,
    [input.name, input.eventDate, input.description, input.producer, input.city, input.registrationStatus]
  );
  res.status(201).json(result.rows[0]);
});

adminCatalogRouter.get('/events', async (_req, res) => {
  const result = await pool.query(
    `SELECT ${eventColumns} FROM events WHERE deleted_at IS NULL ORDER BY event_date DESC, id DESC`
  );
  res.json(result.rows);
});

adminCatalogRouter.get('/events/:id', async (req, res) => {
  const result = await pool.query(`SELECT ${eventColumns} FROM events WHERE id=$1`, [idSchema.parse(req.params.id)]);
  if (!result.rowCount) throw new ApiError(404, 'Evento não encontrado.');
  res.json(result.rows[0]);
});

adminCatalogRouter.patch('/events/:id', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const input = eventSchema.partial().parse(eventInput(req.body ?? {}));
  if (!Object.keys(input).length) throw new ApiError(400, 'Informe ao menos um campo para alteração.');
  const event = await transaction(async (client) => {
    const currentResult = await client.query('SELECT * FROM events WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [id]);
    if (!currentResult.rowCount) throw new ApiError(404, 'Evento não encontrado.');
    const next = { ...currentResult.rows[0], ...input };
    const result = await client.query(
      `UPDATE events SET name=$2,event_date=$3,description=$4,producer=$5,city=$6,registration_status=$7,updated_at=NOW()
       WHERE id=$1 RETURNING ${eventColumns}`,
      [id, next.name, next.eventDate ?? next.event_date, next.description, next.producer, next.city,
        next.registrationStatus ?? next.registration_status]
    );
    return result.rows[0];
  });
  res.json(event);
});

adminCatalogRouter.put('/events/:id', async (req, res) => {
  const input = eventSchema.parse(eventInput(req.body ?? {}));
  const result = await pool.query(
    `UPDATE events SET name=$2,event_date=$3,description=$4,producer=$5,city=$6,registration_status=$7,updated_at=NOW()
     WHERE id=$1 AND deleted_at IS NULL RETURNING ${eventColumns}`,
    [idSchema.parse(req.params.id), input.name, input.eventDate, input.description, input.producer, input.city, input.registrationStatus]
  );
  if (!result.rowCount) throw new ApiError(404, 'Evento não encontrado.');
  res.json(result.rows[0]);
});

adminCatalogRouter.delete('/events/:id', async (req, res) => {
  const result = await pool.query(
    'UPDATE events SET deleted_at=NOW(),updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL RETURNING id',
    [idSchema.parse(req.params.id)]
  );
  if (!result.rowCount) throw new ApiError(404, 'Evento não encontrado.');
  res.json(result.rows[0]);
});

memberCatalogRouter.get('/events/upcoming', async (req, res) => {
  res.json(await listUpcomingMemberEvents(req.auth!.associadoId!));
});

memberCatalogRouter.post('/events/:eventId/registration-request', async (req, res) => {
  const eventId = idSchema.parse(req.params.eventId);
  const associadoId = req.auth!.associadoId!;
  await transaction(async (client) => {
    const eventResult = await client.query(
      `SELECT id,name,event_date,producer,city,registration_status
       FROM events
       WHERE id=$1 AND deleted_at IS NULL
         AND event_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
       FOR SHARE`,
      [eventId]
    );
    if (!eventResult.rowCount) throw new ApiError(404, 'Evento disponível não encontrado.');
    const event = eventResult.rows[0];
    if (event.registration_status !== 'registration_open') {
      throw new ApiError(409, 'As inscrições para este evento ainda não estão abertas.');
    }

    const memberResult = await client.query(
      'SELECT name,email,phone FROM associados WHERE id=$1',
      [associadoId]
    );
    if (!memberResult.rowCount) throw new ApiError(403, 'Usuário sem vínculo com associado.');

    const inserted = await client.query(
      `INSERT INTO event_registration_requests (event_id,associado_id,status)
       VALUES ($1,$2,'pending') ON CONFLICT (event_id,associado_id) DO NOTHING
       RETURNING id,requested_at`,
      [eventId, associadoId]
    );
    if (!inserted.rowCount) throw new ApiError(409, 'A inscrição para este evento já foi solicitada.');

    const member = memberResult.rows[0];
    try {
      await sendEventRegistrationRequestEmail({
        memberName: member.name,
        memberEmail: member.email,
        memberPhone: member.phone,
        eventName: event.name,
        eventDate: event.event_date,
        producer: event.producer,
        city: event.city,
        requestedAt: inserted.rows[0].requested_at
      });
    } catch {
      throw new ApiError(502, 'Não foi possível enviar a solicitação por e-mail. Tente novamente.');
    }
  });

  res.status(201).json({
    success: true,
    message: 'Solicitação realizada. Aguarde a confirmação da Diretoria pelo seu e-mail.'
  });
});
