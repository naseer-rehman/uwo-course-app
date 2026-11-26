CREATE TABLE IF NOT EXISTS users (
  id            UUID          PRIMARY KEY DEFAULT uuidv7(),
  uwo_email     VARCHAR(320)  NOT NULL,
  created_at    TIMESTAMPTZ   DEFAULT NOW() NOT NULL,
  last_login_at TIMESTAMPTZ   DEFAULT NOW() NOT NULL
);

DO $$ 
BEGIN
    CREATE TYPE auth_request_status AS ENUM ('pending', 'verified', 'complete');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS auth_requests (
  id            UUID                PRIMARY KEY DEFAULT uuidv7(),
  uwo_email     VARCHAR(320)        NOT NULL,
  created_at    TIMESTAMPTZ         NOT NULL,
  expiry_at     TIMESTAMPTZ         NOT NULL,
  status        auth_request_status NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS user_emails ON users (uwo_email);

CREATE INDEX IF NOT EXISTS auth_request_emails ON auth_requests (uwo_email);
