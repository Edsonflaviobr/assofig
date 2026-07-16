ALTER TABLE associados ADD COLUMN IF NOT EXISTS document VARCHAR(14);
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS document VARCHAR(14);

DO $$ BEGIN
  ALTER TABLE associados ADD CONSTRAINT associados_document_format
    CHECK (document IS NULL OR document ~ '^[0-9]{11}([0-9]{3})?$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE inscricoes ADD CONSTRAINT inscricoes_document_format
    CHECK (document IS NULL OR document ~ '^[0-9]{11}([0-9]{3})?$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS associados_document_unique
  ON associados(document) WHERE document IS NOT NULL;

CREATE INDEX IF NOT EXISTS inscricoes_document_idx
  ON inscricoes(document) WHERE document IS NOT NULL;

COMMENT ON COLUMN associados.document IS 'CPF (11 dígitos) ou CNPJ (14 dígitos), sem pontuação';
COMMENT ON COLUMN inscricoes.document IS 'CPF (11 dígitos) ou CNPJ (14 dígitos), sem pontuação';
