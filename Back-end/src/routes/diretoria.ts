import { Router, type RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { transaction } from '../db/transaction.js';
import { authenticate, requireAdmin, requirePasswordChangeCompleted } from '../middleware/auth.js';
import { ApiError } from '../utils/api-error.js';
import { dateSchema, emailSchema, idSchema, moneySchema } from '../schemas/common.js';
import { documentSchema, readDocumentInput } from '../utils/document.js';

export const diretoriaRouter = Router();
export const membersRouter = Router();
diretoriaRouter.use(authenticate, requirePasswordChangeCompleted, requireAdmin);
membersRouter.use(authenticate, requirePasswordChangeCompleted, requireAdmin);

const memberSchema = z.object({
  name: z.string().trim().min(3).max(160),
  profession: z.string().trim().min(2).max(100),
  email: emailSchema,
  document: documentSchema.optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  registry: z.string().trim().max(80).optional().nullable(),
  city: z.string().trim().min(2).max(120),
  status: z.enum(['active', 'late', 'pending']).default('pending'),
  password: z.string().min(6).max(200).optional()
});

const delinquencySchema = z.object({
  dueDate: dateSchema,
  amount: moneySchema,
  notes: z.string().trim().max(1000).optional()
}).transform((input) => ({
  ...input,
  referenceMonth: `${input.dueDate.slice(0, 7)}-01`
}));

async function syncFinancialStatus(client: { query: Function }, associadoId: number) {
  const open = await client.query("SELECT EXISTS (SELECT 1 FROM inadimplencias WHERE associado_id = $1 AND status IN ('open', 'proof_sent')) AS has_open", [associadoId]);
  const current = await client.query('SELECT status FROM associados WHERE id = $1', [associadoId]);
  if (!current.rowCount) throw new ApiError(404, 'Associado não encontrado.');
  const status = open.rows[0].has_open ? 'late' : current.rows[0].status === 'pending' ? 'pending' : 'active';
  await client.query('UPDATE associados SET status = $2, updated_at = NOW() WHERE id = $1', [associadoId, status]);
}

const listAssociados: RequestHandler = async (req, res) => {
  const status = z.enum(['active', 'late', 'pending']).optional().parse(req.query.status);
  const search = z.string().trim().max(160).optional().parse(req.query.search);
  const result = await pool.query(
    `SELECT a.*, COUNT(i.id) FILTER (WHERE i.status IN ('open', 'proof_sent'))::int AS open_delinquencies
     FROM associados a LEFT JOIN inadimplencias i ON i.associado_id = a.id
     WHERE ($1::associado_status IS NULL OR a.status = $1)
       AND ($2::text IS NULL OR a.name ILIKE '%' || $2 || '%' OR a.email ILIKE '%' || $2 || '%' OR a.document = regexp_replace($2, '\D', '', 'g'))
     GROUP BY a.id ORDER BY a.name`, [status ?? null, search ?? null]);
  res.json(result.rows);
};

const getAssociado: RequestHandler = async (req, res) => {
  const result = await pool.query('SELECT * FROM associados WHERE id = $1', [idSchema.parse(req.params.id)]);
  if (!result.rowCount) throw new ApiError(404, 'Associado não encontrado.');
  res.json(result.rows[0]);
};

const createAssociado: RequestHandler = async (req, res) => {
  const input = memberSchema.parse({ ...req.body, document: readDocumentInput(req.body) });
  const initialPassword = process.env.SEED_PASSWORD;
  if (!initialPassword) throw new ApiError(500, 'Configuração da senha inicial indisponível.');
  const passwordHash = await bcrypt.hash(initialPassword, 12);
  const member = await transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO associados (name, profession, email, document, phone, registry, city, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [input.name, input.profession, input.email, input.document ?? null, input.phone ?? null, input.registry ?? null, input.city, input.status]);
    await client.query(
      `INSERT INTO users (email, password_hash, role, name, associado_id, must_change_password) VALUES ($1,$2,'member',$3,$4,TRUE)`,
      [input.email, passwordHash, input.name, result.rows[0].id]);
    if (input.status === 'late') {
      await client.query(
        `INSERT INTO inadimplencias (associado_id, reference_month, due_date, amount, notes)
         VALUES ($1, date_trunc('month', CURRENT_DATE)::date, CURRENT_DATE, 50, 'Inadimplência registrada no cadastro')`,
        [result.rows[0].id]);
    }
    return result.rows[0];
  });
  res.status(201).json(member);
};

const updateAssociado: RequestHandler = async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const rawDocument = readDocumentInput(req.body);
  const input = memberSchema.partial().parse(rawDocument === undefined ? req.body : { ...req.body, document: rawDocument });
  if (!Object.keys(input).length) throw new ApiError(400, 'Informe ao menos um campo para alteração.');
  const updated = await transaction(async (client) => {
    const currentResult = await client.query('SELECT * FROM associados WHERE id = $1 FOR UPDATE', [id]);
    if (!currentResult.rowCount) throw new ApiError(404, 'Associado não encontrado.');
    const current = currentResult.rows[0];
    const next = { ...current, ...input };
    const result = await client.query(
      `UPDATE associados SET name=$2, profession=$3, email=$4, document=$5, phone=$6, registry=$7, city=$8, status=$9, updated_at=NOW()
       WHERE id=$1 RETURNING *`, [id, next.name, next.profession, next.email, next.document, next.phone, next.registry, next.city, next.status]);
    await client.query('UPDATE users SET email=$2, name=$3, updated_at=NOW() WHERE associado_id=$1', [id, next.email, next.name]);
    if (input.password) await client.query('UPDATE users SET password_hash=$2, updated_at=NOW() WHERE associado_id=$1', [id, await bcrypt.hash(input.password, 12)]);
    if (input.status === 'late') {
      await client.query(
        `INSERT INTO inadimplencias (associado_id, reference_month, due_date, amount, notes)
         VALUES ($1, date_trunc('month', CURRENT_DATE)::date, CURRENT_DATE, 50, 'Inadimplência registrada pela diretoria')
         ON CONFLICT (associado_id, reference_month) DO UPDATE SET status='open', resolved_at=NULL, updated_at=NOW()`, [id]);
    } else if (input.status === 'active') {
      await client.query("UPDATE inadimplencias SET status='resolved', resolved_at=NOW(), updated_at=NOW() WHERE associado_id=$1 AND status IN ('open','proof_sent')", [id]);
    }
    return result.rows[0];
  });
  res.json(updated);
};

const deleteAssociado: RequestHandler = async (req, res) => {
  const result = await pool.query('DELETE FROM associados WHERE id = $1 RETURNING id', [idSchema.parse(req.params.id)]);
  if (!result.rowCount) throw new ApiError(404, 'Associado não encontrado.');
  res.json(result.rows[0]);
};

const listInadimplencias: RequestHandler = async (req, res) => {
  const result = await pool.query(
    `SELECT *, to_char(reference_month, 'MM/YYYY') AS reference, amount::float AS amount
     FROM inadimplencias WHERE associado_id=$1 ORDER BY due_date DESC`,
    [idSchema.parse(req.params.id)]
  );
  res.json(result.rows);
};

const createInadimplencia: RequestHandler = async (req, res) => {
  const associadoId = idSchema.parse(req.params.id);
  const input = delinquencySchema.parse(req.body);
  const item = await transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO inadimplencias (associado_id, reference_month, due_date, amount, notes)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *, to_char(reference_month, 'MM/YYYY') AS reference, amount::float AS amount`,
      [associadoId, input.referenceMonth, input.dueDate, input.amount, input.notes ?? null]);
    await syncFinancialStatus(client, associadoId);
    return result.rows[0];
  });
  res.status(201).json(item);
};

const regularizeInadimplencia: RequestHandler = async (req, res) => {
  const associadoId = idSchema.parse(req.params.id);
  const item = await transaction(async (client) => {
    const result = await client.query(
      `UPDATE inadimplencias SET status='resolved', resolved_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND associado_id=$2
       RETURNING *, to_char(reference_month, 'MM/YYYY') AS reference, amount::float AS amount`,
      [idSchema.parse(req.params.inadimplenciaId), associadoId]);
    if (!result.rowCount) throw new ApiError(404, 'Inadimplência não encontrada.');
    await syncFinancialStatus(client, associadoId);
    return result.rows[0];
  });
  res.json(item);
};

diretoriaRouter.get('/associados', listAssociados);
diretoriaRouter.get('/associados/:id', getAssociado);
diretoriaRouter.post('/associados', createAssociado);
diretoriaRouter.put('/associados/:id', updateAssociado);
diretoriaRouter.delete('/associados/:id', deleteAssociado);
diretoriaRouter.get('/associados/:id/inadimplencias', listInadimplencias);
diretoriaRouter.post('/associados/:id/inadimplencias', createInadimplencia);
diretoriaRouter.patch('/associados/:id/inadimplencias/:inadimplenciaId/regularizar', regularizeInadimplencia);

membersRouter.get('/', listAssociados);
membersRouter.get('/:id', getAssociado);
membersRouter.post('/', createAssociado);
membersRouter.put('/:id', updateAssociado);
membersRouter.delete('/:id', deleteAssociado);
membersRouter.get('/:id/inadimplencias', listInadimplencias);
membersRouter.post('/:id/inadimplencias', createInadimplencia);
membersRouter.patch('/:id/inadimplencias/:inadimplenciaId/regularizar', regularizeInadimplencia);
