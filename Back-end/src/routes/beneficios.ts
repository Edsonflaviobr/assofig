import { Router } from 'express';
import { authenticate, requireMemberLink, requirePasswordChangeCompleted } from '../middleware/auth.js';

export const beneficiosRouter = Router();
beneficiosRouter.get('/historico', authenticate, requirePasswordChangeCompleted, requireMemberLink, (_req, res) => res.json([]));
