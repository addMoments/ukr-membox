-- Local-only schema + fake seed. Never run against production.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    mail VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    surname VARCHAR(255) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS panel_admins (
    user_uid UUID PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('order_admin', 'super_admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_uid UUID NULL REFERENCES users(uid) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by_uid UUID NULL REFERENCES users(uid) ON DELETE SET NULL
);

DO $$ BEGIN
    CREATE TYPE CREDENTIAL_TYPE AS ENUM ('password', 'google');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS credentials (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uid UUID NOT NULL REFERENCES users(uid),
    type CREDENTIAL_TYPE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
    CREATE TYPE FULLFILLMENT_TYPE AS ENUM ('digital', 'physical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS products (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price DECIMAL(10, 2) NOT NULL,
    id TEXT NOT NULL UNIQUE,
    display_name_en TEXT NOT NULL DEFAULT '',
    display_name_uk TEXT NOT NULL DEFAULT '',
    display_description_en TEXT NOT NULL DEFAULT '',
    display_description_uk TEXT NOT NULL DEFAULT '',
    display_bullets_en TEXT NOT NULL DEFAULT '',
    display_bullets_uk TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    options JSONB NOT NULL DEFAULT '{}',
    priority INT NOT NULL DEFAULT 0,
    fullfillment_type FULLFILLMENT_TYPE NOT NULL,
    is_add_on BOOLEAN NOT NULL DEFAULT FALSE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    granted_features INT[] NOT NULL DEFAULT ARRAY[]::INT[]
);

CREATE TABLE IF NOT EXISTS carts (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
    CREATE TYPE CART_ITEM_STATUS AS ENUM ('cart', 'pending', 'purchased', 'client-action', 'admin-action', 'fulfilled', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cart_items (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_uid UUID NOT NULL REFERENCES carts(uid),
    product_uid UUID NOT NULL REFERENCES products(uid),
    quantity INT NOT NULL,
    unit_price_snapshot DECIMAL(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note TEXT DEFAULT '',
    status CART_ITEM_STATUS NOT NULL DEFAULT 'cart',
    buyer_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (cart_uid, product_uid)
);

CREATE TABLE IF NOT EXISTS partnerships (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS promo_codes (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partnership_uid UUID REFERENCES partnerships(uid),
    code TEXT NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'percent',
    discount_value DECIMAL(10, 2) NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMPTZ,
    usage_limit_total INT,
    usage_count INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deactivated_at TIMESTAMPTZ,
    deactivated_reason TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_upper_code_unique ON promo_codes (UPPER(BTRIM(code)));

CREATE TABLE IF NOT EXISTS purchases (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id TEXT UNIQUE,
    provider VARCHAR(255) NOT NULL,
    buyer_uid UUID REFERENCES users(uid),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    purchase_info JSONB NOT NULL DEFAULT '{}',
    cart_uid UUID REFERENCES carts(uid),
    promo_code_uid UUID REFERENCES promo_codes(uid),
    promo_code_text_snapshot TEXT,
    promo_partnership_uid UUID REFERENCES partnerships(uid),
    promo_partnership_snapshot JSONB,
    gross_total DECIMAL(10, 2),
    discount_amount DECIMAL(10, 2),
    net_total DECIMAL(10, 2)
);

DO $$ BEGIN
    CREATE TYPE EVENT_STATUS AS ENUM ('unpaid', 'paid', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS events (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admins UUID[],
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    activation_date TIMESTAMPTZ,
    active_until TIMESTAMPTZ,
    purchase_uid UUID REFERENCES purchases(uid),
    status EVENT_STATUS NOT NULL DEFAULT 'unpaid',
    name VARCHAR(255),
    event_type VARCHAR(255),
    description TEXT,
    welcome_message TEXT,
    image VARCHAR(255),
    settings JSONB DEFAULT '{}',
    advertorial_config JSONB NOT NULL DEFAULT '{}',
    storage_until TIMESTAMPTZ,
    storage_warning_mail_sent_at TIMESTAMPTZ,
    storage_extended_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE OR REPLACE VIEW events_public AS
SELECT
    uid,
    name,
    event_type,
    activation_date,
    active_until,
    description,
    welcome_message,
    image,
    settings
FROM events
WHERE status = 'paid' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS participants (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    event_uid UUID REFERENCES events(uid) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, event_uid)
);

DO $$ BEGIN
    CREATE TYPE UPLOAD_TYPE AS ENUM ('photo', 'video', 'voice', 'text');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS uploads (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_type UPLOAD_TYPE NOT NULL,
    client_uid UUID REFERENCES participants(uid) NOT NULL,
    event_uid UUID REFERENCES events(uid) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    value TEXT NOT NULL,
    trashed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS event_upload_snapshots (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_uid UUID REFERENCES events(uid) NOT NULL UNIQUE,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL CHECK (reason IN ('manual_delete', 'storage_expired')),
    guest_count INT NOT NULL DEFAULT 0,
    contributor_count INT NOT NULL DEFAULT 0,
    upload_count_total INT NOT NULL DEFAULT 0,
    photo_count INT NOT NULL DEFAULT 0,
    video_count INT NOT NULL DEFAULT 0,
    voice_count INT NOT NULL DEFAULT 0,
    text_count INT NOT NULL DEFAULT 0,
    total_upload_size_mb DECIMAL(12, 2),
    first_upload_at TIMESTAMPTZ,
    last_upload_at TIMESTAMPTZ,
    media_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
    purge_started_at TIMESTAMPTZ,
    purge_finished_at TIMESTAMPTZ,
    purge_error TEXT
);

CREATE TABLE IF NOT EXISTS global_attributes (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN NOT NULL DEFAULT FALSE
);

DO $$ BEGIN
    CREATE TYPE JOB_STATUS AS ENUM ('queued','running','succeeded','failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE DEFINED_JOB_NAMES AS ENUM ('s3_export');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS jobs (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name DEFINED_JOB_NAMES NOT NULL,
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB NOT NULL DEFAULT '{}',
    user_uid UUID REFERENCES users(uid) NOT NULL,
    status JOB_STATUS NOT NULL DEFAULT 'queued',
    locked_at TIMESTAMPTZ,
    locked_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION get_purchase_activation_days(p_purchase_uid UUID)
RETURNS INT AS $$
DECLARE
    v_activation_days INT;
BEGIN
    SELECT COALESCE(NULLIF(p.options->>'activation_days', '')::INT, 14)
    INTO v_activation_days
    FROM purchases pu
    JOIN carts c ON c.uid = pu.cart_uid
    JOIN cart_items ci ON ci.cart_uid = c.uid
    JOIN products p ON p.uid = ci.product_uid
    WHERE pu.uid = p_purchase_uid
      AND p.is_add_on = FALSE
    ORDER BY ci.created_at ASC
    LIMIT 1;
    RETURN COALESCE(v_activation_days, 14);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_purchase_storage_days(p_purchase_uid UUID)
RETURNS INT AS $$
DECLARE
    v_storage_days INT;
BEGIN
    SELECT COALESCE(NULLIF(p.options->>'storage_days', '')::INT, 14)
    INTO v_storage_days
    FROM purchases pu
    JOIN carts c ON c.uid = pu.cart_uid
    JOIN cart_items ci ON ci.cart_uid = c.uid
    JOIN products p ON p.uid = ci.product_uid
    WHERE pu.uid = p_purchase_uid
      AND p.is_add_on = FALSE
    ORDER BY ci.created_at ASC
    LIMIT 1;
    RETURN COALESCE(v_storage_days, 14);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION enforce_event_dates()
RETURNS TRIGGER AS $$
DECLARE
    v_activation_days INT;
    v_storage_days INT;
BEGIN
    IF OLD.activation_date <= NOW() THEN
        IF NEW.activation_date IS DISTINCT FROM OLD.activation_date THEN
            RAISE EXCEPTION 'Cannot modify activation_date after the event has been activated';
        END IF;
    END IF;
    IF NEW.activation_date IS DISTINCT FROM OLD.activation_date THEN
        v_activation_days := get_purchase_activation_days(NEW.purchase_uid);
        NEW.active_until := NEW.activation_date + make_interval(days => v_activation_days);
        v_storage_days := get_purchase_storage_days(NEW.purchase_uid);
        NEW.storage_until := NEW.active_until + make_interval(days => v_storage_days);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_enforce_dates ON events;
CREATE TRIGGER events_enforce_dates
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION enforce_event_dates();

CREATE OR REPLACE FUNCTION enforce_event_dates_on_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_activation_days INT;
    v_storage_days INT;
BEGIN
    v_activation_days := get_purchase_activation_days(NEW.purchase_uid);
    NEW.active_until := NEW.activation_date + make_interval(days => v_activation_days);
    v_storage_days := get_purchase_storage_days(NEW.purchase_uid);
    NEW.storage_until := NEW.active_until + make_interval(days => v_storage_days);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_enforce_dates_insert ON events;
CREATE TRIGGER events_enforce_dates_insert
    BEFORE INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION enforce_event_dates_on_insert();

CREATE OR REPLACE FUNCTION should_show_extend_prompt(events)
RETURNS boolean AS $$
    SELECT $1.deleted_at IS NULL
       AND $1.storage_extended_at IS NULL
       AND $1.storage_until IS NOT NULL
       AND $1.storage_until > NOW()
       AND ($1.storage_until - interval '14 days') <= NOW();
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_uid()
RETURNS uuid AS $$
    SELECT coalesce(
        current_setting('request.jwt.claim.ui', true),
        current_setting('request.jwt.claims', true)::json->>'ui'
    )::uuid;
$$ LANGUAGE sql STABLE;

INSERT INTO products (
    uid, id, price, fullfillment_type, is_add_on, is_enabled, granted_features, options, priority,
    display_name_en, display_name_uk, display_description_en, display_description_uk,
    display_bullets_en, display_bullets_uk
) VALUES
(
    '11111111-1111-4111-8111-111111111111',
    'standard',
    1500.00,
    'digital',
    FALSE,
    TRUE,
    ARRAY[]::INT[],
    '{"activation_days":14,"storage_days":30,"guest_count":20,"media_count":500}'::jsonb,
    10,
    'Standard',
    'Стандарт',
    'Perfect for intimate gatherings and private parties.',
    'Ідеально для невеликих зустрічей.',
    E'20 Guests\n500 Pictures / Videos\n1 Month Storage\n2 Weeks Activation',
    E'20 гостей\n500 фото / відео\n1 місяць зберігання\n2 тижні активації'
),
(
    '22222222-2222-4222-8222-222222222222',
    'plus',
    2500.00,
    'digital',
    FALSE,
    TRUE,
    ARRAY[]::INT[],
    '{"activation_days":14,"storage_days":90,"guest_count":100,"media_count":-1}'::jsonb,
    20,
    'Plus',
    'Плюс',
    'The ideal choice for weddings and larger celebrations.',
    'Ідеальний вибір для весіль.',
    E'100 Guests\nUnlimited Pictures / Videos\n3 Months Storage\n2 Weeks Activation',
    E'100 гостей\nБезліміт фото / відео\n3 місяці зберігання\n2 тижні активації'
),
(
    '33333333-3333-4333-8333-333333333333',
    'premium',
    4000.00,
    'digital',
    FALSE,
    TRUE,
    ARRAY[3,4]::INT[],
    '{"activation_days":14,"storage_days":180,"guest_count":-1,"media_count":-1}'::jsonb,
    30,
    'Premium',
    'Преміум',
    'Premium experience for corporate events and gala dinners.',
    'Преміум досвід для корпоративів.',
    E'Unlimited Guests\nUnlimited Pictures / Videos\nVoice Messages Included\nAdvertising Area Included\n6 Months Storage\n2 Weeks Activation',
    E'Безліміт гостей\nБезліміт фото / відео\nГолосові повідомлення\nРекламна зона\n6 місяців зберігання\n2 тижні активації'
),
(
    '44444444-4444-4444-8444-444444444444',
    'advertorial',
    300.00,
    'digital',
    TRUE,
    TRUE,
    ARRAY[4]::INT[],
    '{}'::jsonb,
    90,
    'Advertising Area',
    'Рекламна зона',
    'Show promotional banners on the guest page.',
    'Показуйте банери на гостьовій сторінці.',
    E'Guest page banner area',
    E'Банерна зона для гостей'
),
(
    '55555555-5555-4555-8555-555555555555',
    'printedBanner',
    800.00,
    'physical',
    TRUE,
    TRUE,
    ARRAY[]::INT[],
    '{}'::jsonb,
    80,
    'QR Card',
    'QR картка',
    'High-quality 10x15cm QR cards linked to your event.',
    'QR-картки 10x15 см для вашої події.',
    E'10x15cm printed cards',
    E'Друковані картки 10x15 см'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (uid, name, surname, mail, is_active) VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Local', 'Dev', 'local@membox.dev', TRUE)
ON CONFLICT (mail) DO NOTHING;

INSERT INTO credentials (user_uid, type, value)
SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'password', crypt('LocalDev123!', gen_salt('bf', 8))
WHERE NOT EXISTS (
    SELECT 1 FROM credentials
    WHERE user_uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' AND type = 'password'
);

INSERT INTO panel_admins (user_uid, role)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'super_admin')
ON CONFLICT (user_uid) DO NOTHING;

INSERT INTO partnerships (uid, name, surname, company_name, email, is_active)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Local', 'Partner', 'Local Partner LLC', 'partner@membox.dev', TRUE)
ON CONFLICT (uid) DO NOTHING;

INSERT INTO promo_codes (uid, partnership_uid, code, discount_type, discount_value, usage_limit_total, is_active)
VALUES ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'LOCAL10', 'percent', 10, 100, TRUE)
ON CONFLICT (uid) DO NOTHING;

INSERT INTO carts (uid, note)
VALUES ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'local seed cart')
ON CONFLICT (uid) DO NOTHING;

INSERT INTO cart_items (cart_uid, product_uid, quantity, unit_price_snapshot, status)
VALUES (
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    '33333333-3333-4333-8333-333333333333',
    1,
    4000.00,
    'purchased'
)
ON CONFLICT (cart_uid, product_uid) DO NOTHING;

INSERT INTO purchases (
    uid, provider_id, provider, buyer_uid, cart_uid, purchase_info, gross_total, discount_amount, net_total
) VALUES (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    'local-seed-purchase-1',
    'mock_paynet',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    '{"premium":1}'::jsonb,
    4000.00,
    0,
    4000.00
)
ON CONFLICT (uid) DO NOTHING;

INSERT INTO events (
    uid, admins, activation_date, purchase_uid, status, name, event_type,
    description, welcome_message, settings
) VALUES (
    'ffffffff-ffff-4fff-8fff-fffffffffff1',
    ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1']::uuid[],
    NOW() - interval '1 day',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    'paid',
    'Local Seed Wedding',
    'wedding',
    'Fake local event for development. Not from production.',
    'Welcome to the local seed event.',
    '{"remove_uploads":true}'::jsonb
)
ON CONFLICT (uid) DO NOTHING;

INSERT INTO participants (uid, name, event_uid)
VALUES
    ('99999999-9999-4999-8999-999999999991', 'Guest Anna', 'ffffffff-ffff-4fff-8fff-fffffffffff1'),
    ('99999999-9999-4999-8999-999999999992', 'Guest Bohdan', 'ffffffff-ffff-4fff-8fff-fffffffffff1')
ON CONFLICT (name, event_uid) DO NOTHING;

INSERT INTO uploads (upload_type, client_uid, event_uid, value)
SELECT 'text', '99999999-9999-4999-8999-999999999991', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'Congratulations from local seed data!'
WHERE NOT EXISTS (
    SELECT 1 FROM uploads WHERE event_uid = 'ffffffff-ffff-4fff-8fff-fffffffffff1' AND upload_type = 'text'
);

INSERT INTO global_attributes (key, value, is_public)
SELECT 'site_notice', 'Local development database (seeded, not production).', TRUE
WHERE NOT EXISTS (SELECT 1 FROM global_attributes WHERE key = 'site_notice');
