CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('member', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE associado_status AS ENUM ('active', 'late', 'pending'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE inadimplencia_status AS ENUM ('open', 'resolved'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pagamento_status AS ENUM ('pendente', 'pago', 'cancelado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS associados (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  profession VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(30), registry VARCHAR(80), city VARCHAR(120) NOT NULL,
  status associado_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role user_role NOT NULL, name VARCHAR(160) NOT NULL,
  associado_id BIGINT UNIQUE REFERENCES associados(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT member_requires_associado CHECK (role <> 'member' OR associado_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS inadimplencias (
  id BIGSERIAL PRIMARY KEY,
  associado_id BIGINT NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL, due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status inadimplencia_status NOT NULL DEFAULT 'open', notes TEXT, resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (associado_id, reference_month)
);

CREATE TABLE IF NOT EXISTS pagamentos (
  id BIGSERIAL PRIMARY KEY,
  associado_id BIGINT NOT NULL REFERENCES associados(id) ON DELETE RESTRICT,
  inadimplencia_id BIGINT REFERENCES inadimplencias(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0), method VARCHAR(30) NOT NULL,
  status pagamento_status NOT NULL DEFAULT 'pendente', external_reference VARCHAR(160), paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inscricoes (
  id BIGSERIAL PRIMARY KEY, name VARCHAR(160) NOT NULL, profession VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL, phone VARCHAR(30) NOT NULL, registry VARCHAR(80), city VARCHAR(120) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'recebida', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contatos (
  id BIGSERIAL PRIMARY KEY, name VARCHAR(160) NOT NULL, email VARCHAR(255) NOT NULL,
  subject VARCHAR(160) NOT NULL, message TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_associados_status ON associados(status);
CREATE INDEX IF NOT EXISTS idx_inadimplencias_associado_status ON inadimplencias(associado_id, status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_associado ON pagamentos(associado_id, created_at DESC);
