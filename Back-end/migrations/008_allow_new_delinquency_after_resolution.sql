ALTER TABLE inadimplencias
  DROP CONSTRAINT IF EXISTS inadimplencias_associado_id_reference_month_key;

CREATE UNIQUE INDEX IF NOT EXISTS inadimplencias_active_reference_unique
  ON inadimplencias (associado_id, reference_month)
  WHERE status IN ('open', 'proof_sent');
