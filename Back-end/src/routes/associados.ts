import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApiError } from '../utils/api-error.js';

export const associadosRouter = Router();

associadosRouter.get('/me', authenticate, authorize('member'), async (req, res) => {
  const result = await pool.query(
    `SELECT a.*, COALESCE(json_agg(json_build_object(
       'id', i.id, 'referenceMonth', i.reference_month, 'dueDate', i.due_date,
       'amount', i.amount::float, 'status', i.status, 'notes', i.notes
     ) ORDER BY i.due_date DESC) FILTER (WHERE i.id IS NOT NULL), '[]') AS inadimplencias
     FROM associados a LEFT JOIN inadimplencias i ON i.associado_id = a.id
     WHERE a.id = $1 GROUP BY a.id`, [req.auth!.associadoId]);
  if (!result.rowCount) throw new ApiError(404, 'Associado não encontrado.');
  res.json(result.rows[0]);
});
