import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../utils/auth.js';
import { verifyToken } from '../utils/auth.js';
import { ApiError } from '../utils/api-error.js';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const [scheme, token] = req.header('authorization')?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) return next(new ApiError(401, 'Token de acesso não informado.'));
  try { req.auth = verifyToken(token); next(); }
  catch { next(new ApiError(401, 'Token de acesso inválido ou expirado.')); }
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) return next(new ApiError(403, 'Você não tem permissão para esta operação.'));
    next();
  };
}
