import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate, requireMemberLink, requirePasswordChangeCompleted } from '../middleware/auth.js';
import { ApiError } from '../utils/api-error.js';
import { idSchema, moneySchema } from '../schemas/common.js';
import { env } from '../config/env.js';

export const pagamentosRouter = Router();
export const paymentsPixRouter = Router();
pagamentosRouter.use(authenticate, requirePasswordChangeCompleted);
paymentsPixRouter.use(authenticate, requirePasswordChangeCompleted, requireMemberLink);

const paymentSchema = z.object({
  associadoId: idSchema.optional(),
  inadimplenciaId: idSchema.optional(),
  amount: moneySchema,
  method: z.enum(['pix', 'card', 'dinheiro', 'transferencia']),
  externalReference: z.string().trim().max(160).optional()
});

const getPix: RequestHandler = (_req, res) => {
  res.json({ pixKey: env.PIX_KEY, receiverName: env.PIX_RECEIVER_NAME });
};

pagamentosRouter.get('/pix', requireMemberLink, getPix);
paymentsPixRouter.get('/', getPix);

pagamentosRouter.get('/', async (req, res) => {
  const requestedId = req.query.associadoId ? idSchema.parse(req.query.associadoId) : undefined;
  const associadoId = req.auth!.role === 'admin' ? requestedId : req.auth!.associadoId;
  const result = await pool.query(
    `SELECT *, amount::float AS amount FROM pagamentos
     WHERE ($1::bigint IS NULL OR associado_id=$1) ORDER BY created_at DESC`, [associadoId ?? null]);
  res.json(result.rows);
});

pagamentosRouter.post('/', async (req, res) => {
  const input = paymentSchema.parse(req.body);
  const associadoId = req.auth!.role === 'admin' ? input.associadoId : req.auth!.associadoId;
  if (!associadoId) throw new ApiError(400, 'O associado do pagamento deve ser informado.');
  const result = await pool.query(
    `INSERT INTO pagamentos (associado_id, inadimplencia_id, amount, method, external_reference)
     VALUES ($1,$2,$3,$4,$5) RETURNING *, amount::float AS amount`,
    [associadoId, input.inadimplenciaId ?? null, input.amount, input.method, input.externalReference ?? null]);
  res.status(201).json(result.rows[0]);
});
