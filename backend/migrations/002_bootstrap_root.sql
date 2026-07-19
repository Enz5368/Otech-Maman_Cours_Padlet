DO $$
DECLARE
    root_user_id uuid;
BEGIN
    SELECT id INTO root_user_id FROM users WHERE username_normalized = 'root';

    IF root_user_id IS NULL THEN
        root_user_id := gen_random_uuid();

        INSERT INTO users (
            id,
            username,
            username_normalized,
            password_hash,
            role,
            status,
            must_change_password,
            storage_quota_bytes,
            storage_used_bytes
        ) VALUES (
            root_user_id,
            'root',
            'root',
            '$argon2id$v=19$m=65536,t=3,p=2$x+hkhg0ETGS8htHvPGiQ5w$5cssRtSq4KIiiKz60xeRuI48Nw3KlsiFEyYifOOZ4go',
            'admin',
            'active',
            true,
            10737418240,
            0
        );

        INSERT INTO user_settings (user_id, settings_json)
        VALUES (root_user_id, '{}'::jsonb);

        INSERT INTO user_quotas (user_id, max_bytes, max_file_bytes)
        VALUES (root_user_id, 10737418240, 536870912);

        INSERT INTO user_workspaces (user_id, schema_version, revision, content)
        VALUES (root_user_id, 2, 1, '{}'::jsonb);
    END IF;
END $$;

