-- Local-only check: simulates a PostgREST authenticated request under RLS.
BEGIN;
SET LOCAL ROLE auth;
SELECT set_config(
    'request.jwt.claims',
    '{"role":"auth","ui":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"}',
    true
);
SELECT uid, name, status, should_show_extend_prompt(events.*) AS extend_prompt
FROM events
WHERE deleted_at IS NULL;
COMMIT;
