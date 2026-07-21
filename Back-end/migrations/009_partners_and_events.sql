CREATE TABLE IF NOT EXISTS partners (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  document VARCHAR(14) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  activity VARCHAR(160) NOT NULL,
  city VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT partners_document_format CHECK (document ~ '^[0-9]{11}([0-9]{3})?$'),
  CONSTRAINT partners_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS partners_document_current_unique
  ON partners(document) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS partners_email_current_unique
  ON partners(lower(email)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS partners_member_listing_idx
  ON partners(status, name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  event_date DATE NOT NULL,
  description TEXT NOT NULL,
  producer VARCHAR(160) NOT NULL,
  city VARCHAR(120) NOT NULL,
  registration_status VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT events_registration_status_check
    CHECK (registration_status IN ('registration_open', 'registration_waiting'))
);

CREATE INDEX IF NOT EXISTS events_date_current_idx
  ON events(event_date) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS event_registration_requests (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  associado_id BIGINT NOT NULL REFERENCES associados(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_registration_requests_status_check CHECK (status = 'pending'),
  CONSTRAINT event_registration_requests_unique UNIQUE (event_id, associado_id)
);

CREATE INDEX IF NOT EXISTS event_registration_requests_member_idx
  ON event_registration_requests(associado_id, requested_at DESC);
