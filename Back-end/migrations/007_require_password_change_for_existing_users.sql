UPDATE users
SET must_change_password = TRUE,
    updated_at = NOW()
WHERE active = TRUE
  AND password_hash IS NOT NULL
  AND BTRIM(password_hash) <> ''
  AND must_change_password = FALSE;
