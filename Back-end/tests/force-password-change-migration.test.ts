import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('migration de troca obrigatória para usuários existentes', () => {
  it('altera somente a flag de usuários ativos com senha local', async () => {
    const sql = await readFile('migrations/007_require_password_change_for_existing_users.sql', 'utf8');
    const setClause = sql.split(/\bWHERE\b/i)[0] ?? '';

    expect(sql).toMatch(/UPDATE\s+users/i);
    expect(setClause).toMatch(/must_change_password\s*=\s*TRUE/i);
    expect(sql).toMatch(/active\s*=\s*TRUE/i);
    expect(sql).toMatch(/password_hash\s+IS\s+NOT\s+NULL/i);
    expect(sql).toMatch(/must_change_password\s*=\s*FALSE/i);
    expect(setClause).not.toMatch(/password_hash\s*=/i);
    expect(setClause).not.toMatch(/\bemail\s*=/i);
    expect(setClause).not.toMatch(/\brole\s*=/i);
    expect(setClause).not.toMatch(/associado_id\s*=/i);
  });
});
