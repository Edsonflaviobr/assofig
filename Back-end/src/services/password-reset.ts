import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { transaction } from '../db/transaction.js';
import { sendPasswordResetEmail } from './email.js';

const TOKEN_VALIDITY_MINUTES = 30;

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function requestPasswordReset(email: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashPasswordResetToken(token);
  const userResult = await pool.query(
    'SELECT id, email, name FROM users WHERE email = $1 AND active = TRUE',
    [email]
  );
  const user = userResult.rows[0] as { id: number; email: string; name: string } | undefined;
  if (!user) return;

  await transaction(async (client) => {
    await client.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [user.id]
    );
    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 minute'))`,
      [user.id, tokenHash, TOKEN_VALIDITY_MINUTES]
    );
  });

  try {
    const delivered = await sendPasswordResetEmail({ to: user.email, name: user.name, token });
    if (!delivered) {
      await pool.query('DELETE FROM password_reset_tokens WHERE token_hash = $1', [tokenHash]);
    }
  } catch {
    await pool.query('DELETE FROM password_reset_tokens WHERE token_hash = $1', [tokenHash]);
    console.error('Falha ao enviar e-mail de recuperação de senha.');
  }
}

export async function resetPassword(token: string, password: string): Promise<boolean> {
  const tokenHash = hashPasswordResetToken(token);
  const passwordHash = await bcrypt.hash(password, 12);

  return transaction(async (client) => {
    const tokenResult = await client.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash]
    );
    const resetToken = tokenResult.rows[0] as { id: number; user_id: number } | undefined;
    if (!resetToken) return false;

    const userResult = await client.query(
      'UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1 AND active = TRUE RETURNING id',
      [resetToken.user_id, passwordHash]
    );
    if (!userResult.rowCount) return false;

    await client.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [resetToken.user_id]
    );
    return true;
  });
}