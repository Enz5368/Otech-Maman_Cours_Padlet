UPDATE users
SET password_hash = '$argon2id$v=19$m=65536,t=3,p=2$9NdsV+2TSQmRlBA19cUNCw$qvvrOC2ugzIo3bqsNLo0D54eH1ERv9akCqkR+5bRhyM',
    must_change_password = false,
    status = 'active'
WHERE username_normalized = 'deirdre-annvogt';
