import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireMemberLink, requirePasswordChangeCompleted } from '../middleware/auth.js';
import { getOwnCredential, issueOwnCredential, validatePublicCredential } from '../services/credentials.js';

export const credentialsRouter = Router();
export const publicCredentialsRouter = Router();

credentialsRouter.use(authenticate, requirePasswordChangeCompleted, requireMemberLink);

credentialsRouter.get('/', async (req, res) => {
  res.json(await getOwnCredential(req.auth!.associadoId!));
});

credentialsRouter.post('/emitir', async (req, res) => {
  res.json(await issueOwnCredential(req.auth!.associadoId!));
});

const validationSchema = z.object({
  codigo: z.string().trim().min(1).max(40)
});

publicCredentialsRouter.post('/validar', async (req, res) => {
  const input = validationSchema.parse(req.body);
  res.json(await validatePublicCredential(input.codigo));
});
