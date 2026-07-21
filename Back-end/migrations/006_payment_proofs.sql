ALTER TYPE inadimplencia_status ADD VALUE IF NOT EXISTS 'proof_sent';

ALTER TABLE inadimplencias
  ADD COLUMN IF NOT EXISTS proof_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_email_id TEXT;
