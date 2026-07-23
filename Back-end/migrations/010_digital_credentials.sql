ALTER TABLE associados
  ADD COLUMN IF NOT EXISTS tipo_credencial VARCHAR(20),
  ADD COLUMN IF NOT EXISTS codigo_verificacao_credencial VARCHAR(9),
  ADD COLUMN IF NOT EXISTS status_credencial VARCHAR(20),
  ADD COLUMN IF NOT EXISTS data_emissao_credencial TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validade_credencial DATE;

DO $$ BEGIN
  ALTER TABLE associados ADD CONSTRAINT associados_tipo_credencial_check
    CHECK (tipo_credencial IS NULL OR tipo_credencial IN ('carteira', 'certificado'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE associados ADD CONSTRAINT associados_status_credencial_check
    CHECK (status_credencial IS NULL OR status_credencial IN ('disponivel', 'suspensa', 'vencida'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE associados ADD CONSTRAINT associados_codigo_credencial_format_check
    CHECK (
      codigo_verificacao_credencial IS NULL OR
      codigo_verificacao_credencial ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS associados_codigo_credencial_unique
  ON associados(codigo_verificacao_credencial)
  WHERE codigo_verificacao_credencial IS NOT NULL;
