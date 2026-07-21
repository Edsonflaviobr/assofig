import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('unicidade de inadimplências ativas por competência', () => {
  it('remove a constraint absoluta e limita a unicidade a open e proof_sent', async () => {
    const sql = await readFile('migrations/008_allow_new_delinquency_after_resolution.sql', 'utf8');

    expect(sql).toMatch(/DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+inadimplencias_associado_id_reference_month_key/i);
    expect(sql).toMatch(/CREATE\s+UNIQUE\s+INDEX/i);
    expect(sql).toMatch(/ON\s+inadimplencias\s*\(associado_id,\s*reference_month\)/i);
    expect(sql).toMatch(/WHERE\s+status\s+IN\s*\('open',\s*'proof_sent'\)/i);
    expect(sql).not.toMatch(/WHERE[^;]*resolved/i);
  });

  it('usa o mesmo predicado no ON CONFLICT administrativo', async () => {
    const source = await readFile('src/routes/diretoria.ts', 'utf8');
    expect(source).toMatch(/ON CONFLICT \(associado_id, reference_month\) WHERE status IN \('open', 'proof_sent'\)/);
  });
});
