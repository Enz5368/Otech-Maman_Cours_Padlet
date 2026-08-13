DO $$
DECLARE
    account_user_id uuid;
BEGIN
    SELECT id INTO account_user_id FROM users WHERE username_normalized = 'deirdre-annvogt';
    IF account_user_id IS NULL THEN
        account_user_id := gen_random_uuid();
        INSERT INTO users (id, username, username_normalized, password_hash, role, status, must_change_password, storage_quota_bytes, storage_used_bytes)
        VALUES (account_user_id, 'Deirdre-Ann Vogt', 'deirdre-annvogt', '$argon2id$v=19$m=65536,t=3,p=2$FAhHWqqzY48AUEYbjsZn2g$ENMuKNkIpdRpIIPCpv36BN+s3LVBAdzug5SthA/tLAg', 'teacher', 'active', false, 10737418240, 0);
        INSERT INTO user_settings (user_id, settings_json) VALUES (account_user_id, '{}'::jsonb);
        INSERT INTO user_quotas (user_id, max_bytes, max_file_bytes) VALUES (account_user_id, 10737418240, 536870912);
        INSERT INTO user_workspaces (user_id, schema_version, revision, content) VALUES (account_user_id, 2, 1, '{}'::jsonb);
    END IF;
END $$;
