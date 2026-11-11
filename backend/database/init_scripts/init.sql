CREATE TABLE IF NOT EXISTS users (
  id            UUID          PRIMARY KEY DEFAULT uuidv4(),
  uwo_email     VARCHAR(320)  NOT NULL,
  created_at    TIMESTAMPTZ   DEFAULT NOW() NOT NULL,
  last_login_at TIMESTAMPTZ   DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_requests (
  id            UUID          PRIMARY KEY DEFAULT uuidv4(),
  user_id       UUID          REFERENCES users(id),
  created_at    TIMESTAMPTZ   NOT NULL,
  expiry_at     TIMESTAMPTZ   NOT NULL
);

