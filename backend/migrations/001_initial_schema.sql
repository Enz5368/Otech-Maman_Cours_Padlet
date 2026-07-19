CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username varchar(80) NOT NULL UNIQUE,
    username_normalized varchar(80) NOT NULL UNIQUE,
    password_hash text NOT NULL,
    email varchar(320),
    display_name varchar(160),
    role varchar(30) NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin')),
    status varchar(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'deleted')),
    last_login_at timestamptz,
    must_change_password boolean NOT NULL DEFAULT false,
    storage_quota_bytes bigint NOT NULL DEFAULT 10737418240 CHECK (storage_quota_bytes >= 0),
    storage_used_bytes bigint NOT NULL DEFAULT 0 CHECK (storage_used_bytes >= 0),
    failed_login_count integer NOT NULL DEFAULT 0,
    locked_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash varchar(64) NOT NULL UNIQUE,
    csrf_hash varchar(64) NOT NULL,
    expires_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    ip_address varchar(64),
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_sessions_user_id ON sessions(user_id);
CREATE INDEX ix_sessions_expires_at ON sessions(expires_at);

CREATE TABLE user_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_quotas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    max_bytes bigint NOT NULL,
    max_file_bytes bigint NOT NULL,
    used_images_bytes bigint NOT NULL DEFAULT 0,
    used_videos_bytes bigint NOT NULL DEFAULT 0,
    used_audio_bytes bigint NOT NULL DEFAULT 0,
    used_documents_bytes bigint NOT NULL DEFAULT 0,
    used_backups_bytes bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Document de compatibilité : permet au frontend historique de rester strictement identique.
CREATE TABLE user_workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    schema_version integer NOT NULL DEFAULT 2,
    revision integer NOT NULL DEFAULT 1,
    content jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE levels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    description text NOT NULL DEFAULT '',
    category varchar(120) NOT NULL DEFAULT '',
    position integer NOT NULL DEFAULT 0,
    hidden boolean NOT NULL DEFAULT false,
    legacy_id varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_levels_user_position ON levels(user_id, position);

CREATE TABLE sequences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level_id uuid NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    description text NOT NULL DEFAULT '',
    final_task text NOT NULL DEFAULT '',
    position integer NOT NULL DEFAULT 0,
    hidden boolean NOT NULL DEFAULT false,
    archived boolean NOT NULL DEFAULT false,
    legacy_id varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_sequences_user_level ON sequences(user_id, level_id);

CREATE TABLE lessons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sequence_id uuid NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    description text NOT NULL DEFAULT '',
    position integer NOT NULL DEFAULT 0,
    hidden boolean NOT NULL DEFAULT false,
    legacy_id varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_lessons_user_sequence ON lessons(user_id, sequence_id);

CREATE TABLE activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    description text NOT NULL DEFAULT '',
    objective text NOT NULL DEFAULT '',
    instruction text NOT NULL DEFAULT '',
    estimated_duration varchar(80) NOT NULL DEFAULT '',
    modality varchar(80) NOT NULL DEFAULT '',
    level_label varchar(120) NOT NULL DEFAULT '',
    position integer NOT NULL DEFAULT 0,
    hidden boolean NOT NULL DEFAULT false,
    archived boolean NOT NULL DEFAULT false,
    legacy_id varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_activities_user_lesson ON activities(user_id, lesson_id);

CREATE TABLE presentations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    private_notes text NOT NULL DEFAULT '',
    theme jsonb NOT NULL DEFAULT '{}'::jsonb,
    position integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_presentations_user_activity ON presentations(user_id, activity_id);

CREATE TABLE slides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    presentation_id uuid NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
    position integer NOT NULL DEFAULT 0,
    background jsonb NOT NULL DEFAULT '{}'::jsonb,
    transition jsonb NOT NULL DEFAULT '{}'::jsonb,
    notes text NOT NULL DEFAULT '',
    legacy_id varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_slides_user_presentation ON slides(user_id, presentation_id);

CREATE TABLE slide_elements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slide_id uuid NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
    type varchar(50) NOT NULL,
    x double precision NOT NULL DEFAULT 0,
    y double precision NOT NULL DEFAULT 0,
    width double precision NOT NULL DEFAULT 0,
    height double precision NOT NULL DEFAULT 0,
    rotation double precision NOT NULL DEFAULT 0,
    z_index integer NOT NULL DEFAULT 0,
    locked boolean NOT NULL DEFAULT false,
    hidden boolean NOT NULL DEFAULT false,
    content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    style_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    animation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_slide_elements_user_slide ON slide_elements(user_id, slide_id);

CREATE TABLE files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_name varchar(500) NOT NULL,
    stored_name varchar(120) NOT NULL,
    relative_path varchar(1000) NOT NULL,
    mime_type varchar(255) NOT NULL,
    size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
    checksum varchar(64) NOT NULL,
    category varchar(50) NOT NULL,
    thumbnail_relative_path varchar(1000),
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, relative_path)
);
CREATE INDEX ix_files_user_category ON files(user_id, category);
CREATE INDEX ix_files_user_checksum ON files(user_id, checksum);

CREATE TABLE resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id uuid REFERENCES activities(id) ON DELETE CASCADE,
    file_id uuid REFERENCES files(id) ON DELETE SET NULL,
    name varchar(255) NOT NULL,
    description text NOT NULL DEFAULT '',
    type varchar(50) NOT NULL DEFAULT 'DOCUMENT',
    category varchar(100) NOT NULL DEFAULT 'Documents',
    url text NOT NULL DEFAULT '',
    position integer NOT NULL DEFAULT 0,
    hidden boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_resources_user_activity ON resources(user_id, activity_id);

CREATE TABLE class_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    school_year varchar(30) NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    legacy_id varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_class_groups_user ON class_groups(user_id);

CREATE TABLE students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_group_id uuid NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
    first_name varchar(120) NOT NULL DEFAULT '',
    last_name varchar(120) NOT NULL DEFAULT '',
    display_name varchar(255) NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_students_user_group ON students(user_id, class_group_id);

CREATE TABLE student_absences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    absent_on timestamptz NOT NULL DEFAULT now(),
    reason text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_absences_user_student ON student_absences(user_id, student_id);

CREATE TABLE draw_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_group_id uuid NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
    student_id uuid REFERENCES students(id) ON DELETE SET NULL,
    student_name varchar(255) NOT NULL,
    drawn_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_draw_history_user_group ON draw_history(user_id, class_group_id, drawn_at DESC);

CREATE TABLE timers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL DEFAULT 'Chronomètre',
    state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE search_index (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type varchar(50) NOT NULL,
    entity_id uuid NOT NULL,
    title varchar(500) NOT NULL,
    body text NOT NULL DEFAULT '',
    document tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))) STORED,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_search_index_user ON search_index(user_id, entity_type);
CREATE INDEX ix_search_index_document ON search_index USING gin(document);

CREATE TABLE exports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status varchar(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    file_id uuid REFERENCES files(id) ON DELETE SET NULL,
    manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
    error text,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE imports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status varchar(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    file_id uuid REFERENCES files(id) ON DELETE SET NULL,
    idempotency_key varchar(120) NOT NULL,
    source varchar(80) NOT NULL DEFAULT 'localStorage',
    manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
    error text,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, idempotency_key)
);

CREATE TABLE backups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status varchar(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    file_id uuid REFERENCES files(id) ON DELETE SET NULL,
    cadence varchar(20) NOT NULL DEFAULT 'manual' CHECK (cadence IN ('manual', 'daily', 'weekly', 'monthly')),
    schema_version integer NOT NULL DEFAULT 1,
    checksum varchar(64) NOT NULL DEFAULT '',
    manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
    error text,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action varchar(120) NOT NULL,
    resource_type varchar(80),
    resource_id varchar(255),
    ip_address varchar(64),
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_logs_user_action ON audit_logs(user_id, action, created_at DESC);

CREATE TABLE password_reset_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash varchar(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users','sessions','user_settings','user_quotas','user_workspaces','levels','sequences','lessons',
        'activities','presentations','slides','slide_elements','files','resources','class_groups','students',
        'student_absences','draw_history','timers','search_index','exports','imports','backups','audit_logs',
        'password_reset_tokens'
    ] LOOP
        EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', table_name, table_name);
    END LOOP;
END $$;
