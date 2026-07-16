import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export type Role = 'member' | 'admin';
export type AuthUser = { userId: number; role: Role; associadoId: number | null };

export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, env.JWT_SECRET) as AuthUser;
}
