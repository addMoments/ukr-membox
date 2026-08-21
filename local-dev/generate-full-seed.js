const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'prod-products.json'), 'utf8')
);

function uuidFrom(label) {
  const h = crypto.createHash('sha1').update(`membox-local-seed:${label}`).digest();
  const b = Buffer.from(h);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function sqlStr(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return sqlStr(JSON.stringify(value ?? {})) + '::jsonb';
}

const productUid = Object.fromEntries(products.map((p) => [p.id, uuidFrom(`product:${p.id}`)]));
const userAdmin = uuidFrom('user:local-admin');
const userMustafa = uuidFrom('user:mustafa');
const userFatih = uuidFrom('user:fatih');
const userSolomiia = uuidFrom('user:solomiia');
const userOrder = uuidFrom('user:order-admin');
const userGuest = uuidFrom('user:guest-owner');
const partnerUid = uuidFrom('partnership:local');
const promoUid = uuidFrom('promo:LOCAL10');
const cartUid = uuidFrom('cart:seed-event');
const purchaseUid = uuidFrom('purchase:seed-event');
const eventUid = uuidFrom('event:seed-wedding');
const partAnna = uuidFrom('participant:anna');
const partBohdan = uuidFrom('participant:bohdan');

const productInserts = products.map((p) => {
  const features = Array.isArray(p.granted_features) && p.granted_features.length
    ? `ARRAY[${p.granted_features.join(',')}]::INT[]`
    : 'ARRAY[]::INT[]';
  return `INSERT INTO products (
    uid, id, price, fullfillment_type, is_add_on, is_enabled, granted_features, options, priority,
    display_name_en, display_name_uk, display_description_en, display_description_uk,
    display_bullets_en, display_bullets_uk
) VALUES (
    '${productUid[p.id]}',
    ${sqlStr(p.id)},
    ${Number(p.price)},
    ${sqlStr(p.fullfillment_type)},
    ${p.is_add_on === true},
    ${p.is_enabled !== false},
    ${features},
    ${sqlJson(p.options || {})},
    ${Number(p.priority) || 0},
    ${sqlStr(p.display_name_en)},
    ${sqlStr(p.display_name_uk)},
    ${sqlStr(p.display_description_en)},
    ${sqlStr(p.display_description_uk)},
    ${sqlStr(p.display_bullets_en)},
    ${sqlStr(p.display_bullets_uk)}
);`;
}).join('\n\n');

const sql = `-- Local-only full seed. Fake users/passwords. Product catalog copied from public /api/products.
-- Password for every seeded account: LocalDev123!

BEGIN;

TRUNCATE TABLE
    uploads,
    event_upload_snapshots,
    participants,
    jobs,
    cart_items,
    purchases,
    events,
    carts,
    credentials,
    panel_admins,
    promo_codes,
    partnerships,
    global_attributes,
    users,
    products
RESTART IDENTITY CASCADE;

${productInserts}

INSERT INTO users (uid, name, surname, mail, is_active) VALUES
    ('${userAdmin}', 'Local', 'Admin', 'local@membox.dev', TRUE),
    ('${userMustafa}', 'Mustafa', 'Admin', 'mustafa@nanbis.com', TRUE),
    ('${userFatih}', 'Fatih', 'Admin', 'fatihgurson@hotmail.com', TRUE),
    ('${userSolomiia}', 'Solomiia', 'Admin', 'solomiia.mozyl@gmail.com', TRUE),
    ('${userOrder}', 'Order', 'Admin', 'orders@membox.dev', TRUE),
    ('${userGuest}', 'Olena', 'Host', 'host@membox.dev', TRUE);

INSERT INTO credentials (user_uid, type, value)
SELECT uid, 'password', crypt('LocalDev123!', gen_salt('bf', 8))
FROM users
WHERE mail IN (
    'local@membox.dev',
    'mustafa@nanbis.com',
    'fatihgurson@hotmail.com',
    'solomiia.mozyl@gmail.com',
    'orders@membox.dev',
    'host@membox.dev'
);

INSERT INTO panel_admins (user_uid, role, created_by_uid) VALUES
    ('${userAdmin}', 'super_admin', '${userAdmin}'),
    ('${userOrder}', 'order_admin', '${userAdmin}');

INSERT INTO partnerships (uid, name, surname, company_name, email, phone, is_active)
VALUES ('${partnerUid}', 'Local', 'Partner', 'AddMoments Local', 'partner@membox.dev', '+380000000000', TRUE);

INSERT INTO promo_codes (uid, partnership_uid, code, discount_type, discount_value, usage_limit_total, is_active)
VALUES ('${promoUid}', '${partnerUid}', 'LOCAL10', 'percent', 10, 100, TRUE);

INSERT INTO carts (uid, note) VALUES ('${cartUid}', 'full seed purchase');

INSERT INTO cart_items (cart_uid, product_uid, quantity, unit_price_snapshot, status, buyer_config)
VALUES
    ('${cartUid}', '${productUid.premium}', 1, 2790.00, 'purchased', '{}'::jsonb),
    ('${cartUid}', '${productUid.welcome_board}', 8, 1000.00, 'purchased', '{"name_text":"Olena & Andriy","event_date":"2026-09-12"}'::jsonb),
    ('${cartUid}', '${productUid.printedBanner}', 16, 50.00, 'purchased', '{}'::jsonb),
    ('${cartUid}', '${productUid.audioGuestbook}', 8, 250.00, 'purchased', '{}'::jsonb);

INSERT INTO purchases (
    uid, provider_id, provider, buyer_uid, cart_uid, purchase_info,
    promo_code_uid, promo_code_text_snapshot, gross_total, discount_amount, net_total
) VALUES (
    '${purchaseUid}',
    'local-full-seed-1',
    'mock_paynet',
    '${userGuest}',
    '${cartUid}',
    '{"premium":1,"welcome_board":8,"printedBanner":16,"audioGuestbook":8}'::jsonb,
    '${promoUid}',
    'LOCAL10',
    5440.00,
    279.00,
    5161.00
);

INSERT INTO events (
    uid, admins, activation_date, purchase_uid, status, name, event_type,
    description, welcome_message, settings
) VALUES (
    '${eventUid}',
    ARRAY['${userGuest}']::uuid[],
    NOW() - interval '2 days',
    '${purchaseUid}',
    'paid',
    'Olena & Andriy Wedding',
    'wedding',
    'Local full-seed event for development.',
    'Welcome. Scan the QR and share your photos.',
    '{"remove_uploads":true}'::jsonb
);

INSERT INTO participants (uid, name, event_uid) VALUES
    ('${partAnna}', 'Anna', '${eventUid}'),
    ('${partBohdan}', 'Bohdan', '${eventUid}');

INSERT INTO uploads (upload_type, client_uid, event_uid, value) VALUES
    ('text', '${partAnna}', '${eventUid}', 'Wishing you a lifetime of happiness!'),
    ('text', '${partBohdan}', '${eventUid}', 'Congratulations from the local seed.');

INSERT INTO global_attributes (key, value, is_public) VALUES
    ('site_notice', 'Local development database. Catalog seeded from public product API. Users are fake.', TRUE);

COMMIT;
`;

const out = path.join(__dirname, 'full-seed.sql');
fs.writeFileSync(out, sql);
console.log('wrote', out, 'bytes', Buffer.byteLength(sql));
console.log('products', products.map((p) => p.id).join(', '));
