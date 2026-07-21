import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('migration de parceiros e eventos', () => {
  it('cria as tabelas, exclusão lógica e restrições de domínio', async () => {
    const sql = await readFile(new URL('../migrations/009_partners_and_events.sql', import.meta.url), 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS partners');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS events');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS event_registration_requests');
    expect(sql).toContain("CHECK (status IN ('active', 'inactive'))");
    expect(sql).toContain("CHECK (registration_status IN ('registration_open', 'registration_waiting'))");
    expect(sql).toContain('deleted_at TIMESTAMPTZ');
  });

  it('impede solicitações duplicadas do mesmo associado no mesmo evento', async () => {
    const sql = await readFile(new URL('../migrations/009_partners_and_events.sql', import.meta.url), 'utf8');

    expect(sql).toContain('UNIQUE (event_id, associado_id)');
  });
});
