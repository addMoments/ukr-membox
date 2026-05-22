
CREATE TABLE users (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    mail VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    surname VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TYPE CREDENTIAL_TYPE AS ENUM ('password', 'google');

CREATE TABLE credentials (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uid UUID NOT NULL REFERENCES users(uid),
    type CREDENTIAL_TYPE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE EVENT_STATUS AS ENUM ('unpaid', 'paid', 'suspended');

CREATE TABLE events (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    admins UUID[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activation_date TIMESTAMPTZ NOT NULL,
    active_until TIMESTAMPTZ NOT NULL,
    purchase_uid UUID REFERENCES purchases(uid),
    status EVENT_STATUS NOT NULL DEFAULT 'unpaid',

    name VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    welcome_message TEXT NOT NULL,
    image VARCHAR(255) NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}'
);

CREATE VIEW events_public AS
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
WHERE status = 'paid';

CREATE TYPE FULLFILLMENT_TYPE AS ENUM ('digital', 'physical');

CREATE TABLE products (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price DECIMAL(10, 2) NOT NULL,
    id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    options JSONB NOT NULL DEFAULT '{}',
    priority INT NOT NULL DEFAULT 0,
    fullfillment_type FULLFILLMENT_TYPE NOT NULL
);

CREATE TABLE carts (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE CART_ITEM_STATUS AS ENUM ('cart', 'pending', 'purchased', 'client-action', 'admin-action', 'fulfilled', 'cancelled');

CREATE TABLE cart_items (
    cart_uid UUID NOT NULL REFERENCES carts(uid),
    product_uid UUID NOT NULL REFERENCES products(uid),
    quantity INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note TEXT DEFAULT '',
    status CART_ITEM_STATUS NOT NULL DEFAULT 'cart',
    UNIQUE (cart_uid, product_uid)
);

CREATE TABLE purchases (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id TEXT UNIQUE,
    provider VARCHAR(255) NOT NULL,
    buyer_uid UUID REFERENCES users(uid),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    purchase_info JSONB NOT NULL DEFAULT '{}',
    cart_uid UUID NOT NULL REFERENCES carts(uid)
);

CREATE TABLE participants (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    event_uid UUID REFERENCES events(uid) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, event_uid)
);

CREATE TYPE UPLOAD_TYPE AS ENUM ('photo', 'video', 'voice', 'text');

CREATE TABLE uploads (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_type UPLOAD_TYPE NOT NULL,
    
    client_uid UUID REFERENCES participants(uid) NOT NULL,
    event_uid UUID REFERENCES events(uid) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    value TEXT NOT NULL,
    trashed_at TIMESTAMPTZ
);

CREATE TABLE global_attributes (
    uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TYPE JOB_STATUS AS ENUM ('queued','running','succeeded','failed');
CREATE TYPE DEFINED_JOB_NAMES AS ENUM ('s3_export');

CREATE TABLE jobs (
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