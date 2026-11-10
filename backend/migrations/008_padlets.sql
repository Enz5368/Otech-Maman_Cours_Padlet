CREATE TABLE padlets (
    id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title varchar(200) NOT NULL, slug varchar(100) NOT NULL UNIQUE,
    description text NOT NULL DEFAULT '', layout varchar(20) NOT NULL DEFAULT 'vertical',
    visibility varchar(20) NOT NULL DEFAULT 'public', password_hash text,
    background varchar(30) NOT NULL DEFAULT 'paper', is_published boolean NOT NULL DEFAULT false,
    is_archived boolean NOT NULL DEFAULT false, lesson_id varchar(255),
    revision integer NOT NULL DEFAULT 1, access_version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_padlets_user_id ON padlets(user_id);
CREATE INDEX ix_padlets_slug ON padlets(slug);
CREATE TABLE padlet_posts (
    id uuid PRIMARY KEY, padlet_id uuid NOT NULL REFERENCES padlets(id) ON DELETE CASCADE,
    type varchar(20) NOT NULL, title varchar(200) NOT NULL,
    description text NOT NULL DEFAULT '', instruction text NOT NULL DEFAULT '', body text NOT NULL DEFAULT '',
    external_url varchar(2000) NOT NULL DEFAULT '', file_id uuid REFERENCES files(id) ON DELETE SET NULL,
    sort_order integer NOT NULL DEFAULT 0, is_visible boolean NOT NULL DEFAULT true,
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_padlet_posts_padlet_id ON padlet_posts(padlet_id);
CREATE TABLE padlet_grants (
    id uuid PRIMARY KEY, padlet_id uuid NOT NULL REFERENCES padlets(id) ON DELETE CASCADE,
    token_hash varchar(64) NOT NULL UNIQUE, access_version integer NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_padlet_grants_padlet_id ON padlet_grants(padlet_id);
CREATE INDEX ix_padlet_grants_expires_at ON padlet_grants(expires_at);
CREATE TABLE padlet_attempts (
    key varchar(64) PRIMARY KEY, count integer NOT NULL DEFAULT 0, started_at timestamptz NOT NULL
);
