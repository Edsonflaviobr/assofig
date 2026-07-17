import { Router } from 'express';
import { authenticate, authorize, requirePasswordChangeCompleted } from '../middleware/auth.js';

export const beneficiosRouter = Router();
beneficiosRouter.get('/historico', authenticate, requirePasswordChangeCompleted, authorize('member'), (_req, res) => res.json([]));
