import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';

export const beneficiosRouter = Router();
beneficiosRouter.get('/historico', authenticate, authorize('member'), (_req, res) => res.json([]));
