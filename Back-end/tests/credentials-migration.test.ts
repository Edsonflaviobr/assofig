import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('migration de credenciais digitais', () => {
  it('adiciona somente campos nullable e restrições não destrutivas em associados', async () => {
    const sql = await readFile(new URL('../migrations/010_digital_credentials.sql', import.meta.url), 'utf8');

    for (const column of [
      'tipo_credencial', 'codigo_verificacao_credencial', 'status_credencial',
      'data_emissao_credencial', 'validade_credencial'
    ]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(sql).not.toMatch(/\bDROP\b|\bDELETE\b|\bUPDATE\s+associados\b/i);
    expect(sql).toContain("IN ('carteira', 'certificado')");
    expect(sql).toContain("IN ('disponivel', 'suspensa', 'vencida')");
  });

  it('protege formato e unicidade do código público', async () => {
    const sql = await readFile(new URL('../migrations/010_digital_credentials.sql', import.meta.url), 'utf8');

    expect(sql).toContain("{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}");
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS associados_codigo_credencial_unique');
  });
});
