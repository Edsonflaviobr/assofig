import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { ApiError } from '../utils/api-error.js';
import { signToken } from '../utils/auth.js';
import { emailSchema } from '../schemas/common.js';
import { requestPasswordReset, resetPassword } from '../services/password-reset.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6).max(200),
  role: z.enum(['member', 'admin'])
});

const forgotPasswordSchema = z.object({ email: emailSchema });
const resetPasswordSchema = z.object({
  token: z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/),
  password: z.string().min(6).max(200),
  passwordConfirmation: z.string().min(6).max(200)
}).refine((input) => input.password === input.passwordConfirmation, {
  message: 'As senhas não conferem.',
  path: ['passwordConfirmation']
});

export const FORGOT_PASSWORD_RESPONSE = 'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.';

authRouter.post('/login', async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.role, u.name, u.associado_id, a.profession
     FROM users u LEFT JOIN associados a ON a.id = u.associado_id
     WHERE u.email = $1 AND u.active = TRUE`, [input.email]);
  const user = result.rows[0];
  const canUseRole = user && (input.role === 'member' ? user.associado_id !== null : user.role === 'admin');
  if (!user || !canUseRole || !(await bcrypt.compare(input.password, user.password_hash))) {
    throw new ApiError(401, 'E-mail, senha ou perfil inválido.');
  }
  const token = signToken({ userId: user.id, role: input.role, associadoId: user.associado_id });
  res.json({ token, role: input.role, user: { id: user.id, name: user.name, email: user.email, profession: user.profession ?? null } });
});
authRouter.post('/forgot-password', async (req, res) => {
  const input = forgotPasswordSchema.parse(req.body);
  await requestPasswordReset(input.email);
  res.json({ message: FORGOT_PASSWORD_RESPONSE });
});

authRouter.post('/reset-password', async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  if (!(await resetPassword(input.token, input.password))) {
    throw new ApiError(400, 'Token inválido ou expirado.');
  }
  res.json({ message: 'Senha redefinida com sucesso.' });
});