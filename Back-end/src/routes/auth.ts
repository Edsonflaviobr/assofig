import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { ApiError } from '../utils/api-error.js';
import { signToken } from '../utils/auth.js';
import { emailSchema } from '../schemas/common.js';
import { requestPasswordReset, resetPassword } from '../services/password-reset.js';
import { authenticate } from '../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6).max(200),
  role: z.enum(['member', 'admin'])
});

const changeInitialPasswordSchema = z.object({
  currentPassword: z.string().min(6).max(200),
  newPassword: z.string().min(6).max(200),
  confirmPassword: z.string().min(6).max(200)
}).refine((input) => input.newPassword === input.confirmPassword, {
  message: 'As senhas não conferem.',
  path: ['confirmPassword']
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
    `SELECT u.id, u.email, u.password_hash, u.role, u.name, u.associado_id, u.must_change_password, a.profession
     FROM users u LEFT JOIN associados a ON a.id = u.associado_id
     WHERE u.email = $1 AND u.active = TRUE`, [input.email]);
  const user = result.rows[0];
  const canUseRole = user && (input.role === 'member' ? user.associado_id !== null : user.role === 'admin');
  if (!user || !canUseRole || !(await bcrypt.compare(input.password, user.password_hash))) {
    throw new ApiError(401, 'E-mail, senha ou perfil inválido.');
  }
  const token = signToken({ userId: user.id, role: input.role, associadoId: user.associado_id });
  res.json({ token, role: input.role, mustChangePassword: Boolean(user.must_change_password), user: { id: user.id, name: user.name, email: user.email, profession: user.profession ?? null } });
});

authRouter.get('/me', authenticate, async (req, res) => {
  const result = await pool.query(
    `SELECT u.must_change_password AS "mustChangePassword", jsonb_build_object(
       'id', u.id, 'name', u.name, 'email', u.email, 'role', u.role, 'active', u.active,
       'mustChangePassword', u.must_change_password
     ) AS "user",
     to_jsonb(a) || jsonb_build_object(
       'inadimplencias', COALESCE(jsonb_agg(jsonb_build_object(
         'id', i.id, 'referenceMonth', i.reference_month, 'dueDate', i.due_date,
         'amount', i.amount::float, 'status', i.status, 'notes', i.notes
       ) ORDER BY i.due_date DESC) FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb)
     ) AS associado
     FROM users u
     JOIN associados a ON a.id = u.associado_id
     LEFT JOIN inadimplencias i ON i.associado_id = a.id
     WHERE u.id = $1 AND u.active = TRUE
     GROUP BY u.id, a.id`,
    [req.auth!.userId]
  );
  if (!result.rowCount) throw new ApiError(404, 'Associado não encontrado.');
  const profile = result.rows[0];
  if (profile.mustChangePassword) {
    const { id, name, email } = profile.associado;
    res.json({ mustChangePassword: true, user: profile.user, associado: { id, name, email } });
    return;
  }
  res.json(profile);
});

authRouter.post('/change-initial-password', authenticate, async (req, res) => {
  const input = changeInitialPasswordSchema.parse(req.body);
  const result = await pool.query(
    'SELECT password_hash, must_change_password FROM users WHERE id = $1 AND active = TRUE',
    [req.auth!.userId]
  );
  const user = result.rows[0];
  if (!user) throw new ApiError(404, 'Usuário não encontrado.');
  if (!user.must_change_password) throw new ApiError(400, 'A troca da senha inicial não é necessária.');
  if (!(await bcrypt.compare(input.currentPassword, user.password_hash))) {
    throw new ApiError(401, 'Senha atual incorreta.');
  }
  if (input.newPassword === input.currentPassword || input.newPassword === process.env.SEED_PASSWORD) {
    throw new ApiError(400, 'A nova senha deve ser diferente da senha inicial.');
  }
  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  const updated = await pool.query(
    `UPDATE users SET password_hash = $2, must_change_password = FALSE, updated_at = NOW()
     WHERE id = $1 AND must_change_password = TRUE RETURNING id`,
    [req.auth!.userId, passwordHash]
  );
  if (!updated.rowCount) throw new ApiError(409, 'Não foi possível concluir a troca da senha inicial.');
  res.json({ message: 'Senha inicial alterada com sucesso.', mustChangePassword: false });
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