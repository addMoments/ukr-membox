-- Local-only PostgREST roles, grants and RLS. Never run against production.

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'webanon') THEN
        CREATE ROLE webanon LOGIN PASSWORD 'webanon_local_dev';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'auth') THEN
        CREATE ROLE auth NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'adm_admin') THEN
        CREATE ROLE adm_admin NOLOGIN BYPASSRLS;
    END IF;
END $$;

ALTER ROLE webanon LOGIN PASSWORD 'webanon_local_dev';
GRANT auth TO webanon;
GRANT adm_admin TO webanon;

GRANT USAGE ON SCHEMA public TO webanon;
GRANT USAGE ON SCHEMA public TO auth;
GRANT USAGE ON SCHEMA public TO adm_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO auth;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO auth;
GRANT ALL ON ALL TABLES IN SCHEMA public TO adm_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO adm_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO auth;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO auth;

GRANT SELECT, INSERT, UPDATE, DELETE ON uploads TO webanon;
GRANT SELECT, UPDATE ON participants TO webanon;
GRANT SELECT ON events_public TO webanon;
GRANT SELECT ON events_public TO auth;
GRANT SELECT ON products TO webanon;
GRANT SELECT ON products TO auth;

REVOKE ALL ON events FROM webanon;
REVOKE UPDATE ON events FROM auth;
GRANT UPDATE (name, event_type, description, welcome_message, image, settings, activation_date, advertorial_config) ON events TO auth;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text AS $$
    SELECT coalesce(
        current_setting('request.jwt.claim.role', true),
        current_setting('request.jwt.claims', true)::json->>'role'
    );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_event_setting_bool(p_event_uid UUID, p_key TEXT)
RETURNS BOOLEAN AS $$
    SELECT COALESCE((settings->>p_key)::boolean, FALSE)
    FROM events
    WHERE uid = p_event_uid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION current_user_role() TO auth, webanon;
GRANT EXECUTE ON FUNCTION current_user_uid() TO auth, webanon;
GRANT EXECUTE ON FUNCTION get_event_setting_bool(UUID, TEXT) TO auth, webanon;
GRANT EXECUTE ON FUNCTION should_show_extend_prompt(events) TO auth, webanon;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_upload_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_access ON users;
CREATE POLICY users_self_access ON users
    FOR ALL TO auth
    USING (uid = current_user_uid())
    WITH CHECK (uid = current_user_uid());

DROP POLICY IF EXISTS users_co_admin_access ON users;
CREATE POLICY users_co_admin_access ON users
    FOR SELECT TO auth
    USING (
        uid IN (
            SELECT UNNEST(admins) FROM events
            WHERE current_user_uid() = ANY(admins)
        )
    );

DROP POLICY IF EXISTS credentials_self_access ON credentials;
CREATE POLICY credentials_self_access ON credentials
    FOR ALL TO auth
    USING (user_uid = current_user_uid())
    WITH CHECK (user_uid = current_user_uid());

DROP POLICY IF EXISTS events_admin_access ON events;
CREATE POLICY events_admin_access ON events
    FOR ALL TO auth
    USING (current_user_uid() = ANY(admins))
    WITH CHECK (current_user_uid() = ANY(admins));

DROP POLICY IF EXISTS uploads_event_admin_access ON uploads;
CREATE POLICY uploads_event_admin_access ON uploads
    FOR ALL TO auth
    USING (
        event_uid IN (SELECT uid FROM events WHERE current_user_uid() = ANY(admins))
    )
    WITH CHECK (
        event_uid IN (SELECT uid FROM events WHERE current_user_uid() = ANY(admins))
    );

DROP POLICY IF EXISTS uploads_participant_select ON uploads;
CREATE POLICY uploads_participant_select ON uploads
    FOR SELECT TO webanon
    USING (client_uid = current_user_uid());

DROP POLICY IF EXISTS uploads_participant_text_insert ON uploads;
CREATE POLICY uploads_participant_text_insert ON uploads
    FOR INSERT TO webanon
    WITH CHECK (client_uid = current_user_uid() AND upload_type = 'text');

DROP POLICY IF EXISTS uploads_participant_text_update ON uploads;
CREATE POLICY uploads_participant_text_update ON uploads
    FOR UPDATE TO webanon
    USING (client_uid = current_user_uid() AND upload_type = 'text')
    WITH CHECK (client_uid = current_user_uid() AND upload_type = 'text');

DROP POLICY IF EXISTS uploads_participant_delete ON uploads;
CREATE POLICY uploads_participant_delete ON uploads
    FOR DELETE TO webanon
    USING (
        client_uid = current_user_uid()
        AND get_event_setting_bool(event_uid, 'remove_uploads')
    );

DROP POLICY IF EXISTS event_upload_snapshots_admin_access ON event_upload_snapshots;
CREATE POLICY event_upload_snapshots_admin_access ON event_upload_snapshots
    FOR ALL TO auth
    USING (event_uid IN (SELECT uid FROM events WHERE current_user_uid() = ANY(admins)))
    WITH CHECK (event_uid IN (SELECT uid FROM events WHERE current_user_uid() = ANY(admins)));

DROP POLICY IF EXISTS participants_event_admin_access ON participants;
CREATE POLICY participants_event_admin_access ON participants
    FOR ALL TO auth
    USING (event_uid IN (SELECT uid FROM events WHERE current_user_uid() = ANY(admins)))
    WITH CHECK (event_uid IN (SELECT uid FROM events WHERE current_user_uid() = ANY(admins)));

DROP POLICY IF EXISTS participants_self_access ON participants;
CREATE POLICY participants_self_access ON participants
    FOR ALL TO webanon
    USING (uid = current_user_uid())
    WITH CHECK (uid = current_user_uid());

DROP POLICY IF EXISTS purchases_self_access ON purchases;
CREATE POLICY purchases_self_access ON purchases
    FOR ALL TO auth
    USING (buyer_uid = current_user_uid())
    WITH CHECK (buyer_uid = current_user_uid());

DROP POLICY IF EXISTS cart_items_purchase_access ON cart_items;
CREATE POLICY cart_items_purchase_access ON cart_items
    FOR ALL TO auth
    USING (cart_uid IN (SELECT cart_uid FROM purchases WHERE buyer_uid = current_user_uid()))
    WITH CHECK (cart_uid IN (SELECT cart_uid FROM purchases WHERE buyer_uid = current_user_uid()));

DROP POLICY IF EXISTS carts_purchase_access ON carts;
CREATE POLICY carts_purchase_access ON carts
    FOR ALL TO auth
    USING (uid IN (SELECT cart_uid FROM purchases WHERE buyer_uid = current_user_uid()))
    WITH CHECK (uid IN (SELECT cart_uid FROM purchases WHERE buyer_uid = current_user_uid()));

DROP POLICY IF EXISTS global_attributes_authenticated ON global_attributes;
CREATE POLICY global_attributes_authenticated ON global_attributes
    FOR SELECT TO auth USING (true);

DROP POLICY IF EXISTS global_attributes_anonymous ON global_attributes;
CREATE POLICY global_attributes_anonymous ON global_attributes
    FOR SELECT TO webanon USING (is_public = true);

GRANT SELECT ON jobs TO auth;
GRANT INSERT (name, input, user_uid) ON jobs TO auth;

DROP POLICY IF EXISTS jobs_self_select ON jobs;
CREATE POLICY jobs_self_select ON jobs
    FOR SELECT TO auth USING (user_uid = current_user_uid());

DROP POLICY IF EXISTS jobs_self_insert ON jobs;
CREATE POLICY jobs_self_insert ON jobs
    FOR INSERT TO auth WITH CHECK (user_uid = current_user_uid());
