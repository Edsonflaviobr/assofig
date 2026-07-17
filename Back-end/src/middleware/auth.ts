import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../utils/auth.js';
import { verifyToken } from '../utils/auth.js';
import { ApiError } from '../utils/api-error.js';
import { pool } from '../db/pool.js';

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

export async function requirePasswordChangeCompleted(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(new ApiError(401, 'Token de acesso não informado.'));
  try {
    const result = await pool.query(
      'SELECT must_change_password FROM users WHERE id = $1 AND active = TRUE',
      [req.auth.userId]
    );
    if (!result.rowCount) return next(new ApiError(401, 'Usuário não encontrado ou inativo.'));
    if (result.rows[0].must_change_password) {
      return next(new ApiError(403, 'A troca da senha inicial é obrigatória antes de acessar esta área.'));
    }
    next();
  } catch (error) {
    next(error);
  }
}