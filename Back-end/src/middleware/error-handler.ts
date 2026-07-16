import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/api-error.js';

export const notFound: RequestHandler = (_req, _res, next) => next(new ApiError(404, 'Endpoint não encontrado.'));

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) { res.status(400).json({ message: 'Dados inválidos.', errors: error.issues }); return; }
  if (error instanceof ApiError) { res.status(error.status).json({ message: error.message, ...(error.details ? { details: error.details } : {}) }); return; }
  if ((error as { code?: string }).code === '23505') { res.status(409).json({ message: 'Já existe um registro com estes dados.' }); return; }
  console.error(error);
  res.status(500).json({ message: 'Ocorreu um erro interno. Tente novamente.' });
};
