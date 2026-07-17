import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate, authorize, requirePasswordChangeCompleted } from '../middleware/auth.js';
import { ApiError } from '../utils/api-error.js';

export const associadosRouter = Router();

associadosRouter.get('/me', authenticate, requirePasswordChangeCompleted, authorize('member'), async (req, res) => {
  const result = await pool.query(
    `SELECT a.*, COALESCE(json_agg(json_build_object(
       'id', i.id, 'referenceMonth', i.reference_month, 'dueDate', i.due_date,
       'amount', i.amount::float, 'status', i.status, 'notes', i.notes
     ) ORDER BY i.due_date DESC) FILTER (WHERE i.id IS NOT NULL), '[]') AS inadimplencias
     FROM users u JOIN associados a ON a.id = u.associado_id
     LEFT JOIN inadimplencias i ON i.associado_id = a.id
     WHERE u.id = $1 AND u.active = TRUE GROUP BY a.id`, [req.auth!.userId]);
  if (!result.rowCount) throw new ApiError(404, 'Associado não encontrado.');
  res.json(result.rows[0]);
});
