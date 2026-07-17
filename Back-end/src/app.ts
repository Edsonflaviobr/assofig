import express from 'express';
import cors from 'cors';

import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { associadosRouter } from './routes/associados.js';
import { diretoriaRouter } from './routes/diretoria.js';
import { pagamentosRouter } from './routes/pagamentos.js';
import { publicRouter } from './routes/public.js';
import { beneficiosRouter } from './routes/beneficios.js';
import { errorHandler, notFound } from './middleware/error-handler.js';

export const app = express();
const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api/auth/forgot-password', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.' }
}));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api/associados', associadosRouter);
app.use('/api/diretoria', diretoriaRouter);
app.use('/api/pagamentos', pagamentosRouter);
app.use('/api/beneficios', beneficiosRouter);
app.use('/api', publicRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
