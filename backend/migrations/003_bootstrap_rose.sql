DO $$
DECLARE
    rose_user_id uuid;
BEGIN
    SELECT id INTO rose_user_id FROM users WHERE username_normalized = 'rose';

    IF rose_user_id IS NULL THEN
        rose_user_id := gen_random_uuid();

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
            rose_user_id,
            'rose',
            'rose',
            '$argon2id$v=19$m=65536,t=3,p=2$YCpoKj6IMHjlFqEJtUiw/A$VJ0zSiNjcYZOURUiKzcWrNV07arKqH3tcNHPwn0yd78',
            'teacher',
            'active',
            false,
            10737418240,
            0
        );
    ELSE
        UPDATE users
        SET password_hash = '$argon2id$v=19$m=65536,t=3,p=2$YCpoKj6IMHjlFqEJtUiw/A$VJ0zSiNjcYZOURUiKzcWrNV07arKqH3tcNHPwn0yd78',
            status = 'active',
            must_change_password = false,
            failed_login_count = 0,
            locked_until = NULL
        WHERE id = rose_user_id;
    END IF;

    INSERT INTO user_settings (user_id, settings_json)
    VALUES (rose_user_id, '{}'::jsonb)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO user_quotas (user_id, max_bytes, max_file_bytes)
    VALUES (rose_user_id, 10737418240, 536870912)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO user_workspaces (user_id, schema_version, revision, content)
    VALUES (rose_user_id, 2, 1, '{}'::jsonb)
    ON CONFLICT (user_id) DO NOTHING;
END $$;
