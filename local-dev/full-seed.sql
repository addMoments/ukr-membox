-- Local-only full seed. Fake users/passwords. Product catalog copied from public /api/products.
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

INSERT INTO products (
    uid, id, price, fullfillment_type, is_add_on, is_enabled, granted_features, options, priority,
    display_name_en, display_name_uk, display_description_en, display_description_uk,
    display_bullets_en, display_bullets_uk
) VALUES (
    '6862270f-70fc-4c48-89d3-fac1a1c2d136',
    'advertorial',
    1790,
    'digital',
    true,
    true,
    ARRAY[4]::INT[],
    '{"image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/addon_banner/ed1be5c2-9026-4adf-ab8e-e7b95d10c3c1/0ba2bd1e-e56e-41b5-b474-2829d2176f50.png","mobile_image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/addon_banner/ed1be5c2-9026-4adf-ab8e-e7b95d10c3c1/a29dfa7f-ab3d-4905-8fba-7822402d7d60.png"}'::jsonb,
    90,
    'Digital Ads Zone',
    'Рекламна зона',
    'For Professionals
Promote your business directly on your event page with your own banner, message and link — ideal for wedding planners, photographers, venues and event professionals.',
    '### Для професіоналів

Рекламуйте свій бізнес безпосередньо на сторінці події за допомогою власного банера, повідомлення та посилання — ідеально для весільних організаторів, фотографів, локацій та інших івент-професіоналів.',
    'Guest page banner area',
    'Guest page banner area'
);

INSERT INTO products (
    uid, id, price, fullfillment_type, is_add_on, is_enabled, granted_features, options, priority,
    display_name_en, display_name_uk, display_description_en, display_description_uk,
    display_bullets_en, display_bullets_uk
) VALUES (
    'fbfecb0e-d23e-4443-97f0-e5909fb9a1af',
    'welcome_board',
    1000,
    'physical',
    true,
    true,
    ARRAY[]::INT[],
    '{"config_fields":[{"key":"name_text","label":"Event Title?","maxLength":75,"type":"textarea"},{"key":"event_date","label":"What is your event date?","maxLength":50,"type":"textarea"},{"key":"secondary_text","label":"Welcome Message?","maxLength":100,"type":"textarea"},{"key":"footer_text","label":"Footer Text?","maxLength":100,"type":"textarea"}],"cost":300,"description":"Вітальна дошка","designs":[{"id":"1","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/1.png","label":"Design 1"},{"id":"2","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/2.png","label":"Design 2"},{"id":"3","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/3.png","label":"Design 3"},{"id":"4","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/4.png","label":"Design 4"},{"id":"5","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/5.png","label":"Design 5"},{"id":"6","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/6.png","label":"Design 6"},{"id":"7","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/7.png","label":"Design 7"},{"id":"8","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/8.png","label":"Design 8"},{"id":"9","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/9.png","label":"Design 9"},{"id":"10","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/10.png","label":"Design 10"},{"id":"11","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/11.png","label":"Design 11"},{"id":"12","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/12.png","label":"Design 12"},{"id":"13","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/13.png","label":"Design 13"},{"id":"14","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/14.png","label":"Design 14"},{"id":"15","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/15.png","label":"Design 15"},{"id":"16","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/16.png","label":"Design 16"},{"id":"17","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/17.png","label":"Design 17"},{"id":"18","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/18.png","label":"Design 18"},{"id":"19","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/19.png","label":"Design 19"},{"id":"20","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/20.png","label":"Design 20"},{"id":"21","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/21.png","label":"Design 21"},{"id":"22","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/22.png","label":"Design 22"},{"id":"23","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/23.png","label":"Design 23"},{"id":"24","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/24.png","label":"Design 24"},{"id":"25","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/25.png","label":"Design 25"},{"id":"26","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/26.png","label":"Design 26"},{"id":"27","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/27.png","label":"Design 27"},{"id":"28","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/28.png","label":"Design 28"},{"id":"29","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/29.png","label":"Design 29"},{"id":"30","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/30.png","label":"Design 30"},{"id":"31","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/31.png","label":"Design 31"},{"id":"32","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/welcome_board/32.png","label":"Design 32"}],"height":30,"icon":"fa-solid fa-chalkboard","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/addon_banner/9eae356f-1076-444c-b0de-e99dfd4b9993/5ab2723e-e7f7-42f9-be68-bc57eb76d89e.png","isMulti":true,"length":42,"weight":0.5,"width":5}'::jsonb,
    4,
    'Welcome Board',
    'Вітальний банер',
    'Welcome your guests with a stylish welcome board featuring your event name and QR code, making it easy for everyone to scan and share their photos and videos.
Size: 50 × 70 cm
Material: Forex PVC
Delivery:3–5 business days.',
    'Привітайте своїх гостей стильною вітальною табличкою з назвою вашої події та QR-кодом, щоб кожен міг легко відсканувати його та поділитися своїми фото й відео.
Розмір: 50 × 70 см
Матеріал: Forex PVC
Термін: 3–5 робочих днів',
    '',
    ''
);

INSERT INTO products (
    uid, id, price, fullfillment_type, is_add_on, is_enabled, granted_features, options, priority,
    display_name_en, display_name_uk, display_description_en, display_description_uk,
    display_bullets_en, display_bullets_uk
) VALUES (
    'b1f5ab13-4d0c-45d3-8076-ebab873126b4',
    'printedBanner',
    50,
    'physical',
    true,
    true,
    ARRAY[2]::INT[],
    '{"config_fields":[{"key":"name_text","label":"Event Title","maxLength":75,"type":"textarea"},{"key":"welcome_message","label":"Welcome Message","maxLength":75,"type":"textarea"},{"key":"event_date","label":"Event Date","maxLength":50,"type":"textarea"}],"cost":200,"description":"Листівка","designs":[{"id":"1","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/1.png","label":"Design 1"},{"id":"2","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/2.png","label":"Design 2"},{"id":"3","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/3.png","label":"Design 3"},{"id":"4","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/4.png","label":"Design 4"},{"id":"5","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/5.png","label":"Design 5"},{"id":"6","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/6.png","label":"Design 6"},{"id":"7","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/7.png","label":"Design 7"},{"id":"8","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/8.png","label":"Design 8"},{"id":"9","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/9.png","label":"Design 9"},{"id":"10","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/10.png","label":"Design 10"},{"id":"11","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/11.png","label":"Design 11"},{"id":"12","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/12.png","label":"Design 12"},{"id":"13","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/13.png","label":"Design 13"},{"id":"14","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/14.png","label":"Design 14"},{"id":"15","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/15.png","label":"Design 15"},{"id":"16","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/16.png","label":"Design 16"},{"id":"17","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/17.png","label":"Design 17"},{"id":"18","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/18.png","label":"Design 18"},{"id":"19","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/19.png","label":"Design 19"},{"id":"20","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/20.png","label":"Design 20"},{"id":"21","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/21.png","label":"Design 21"},{"id":"22","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/22.png","label":"Design 22"},{"id":"23","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/23.png","label":"Design 23"},{"id":"24","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/24.png","label":"Design 24"},{"id":"25","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/25.png","label":"Design 25"},{"id":"26","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/26.png","label":"Design 26"},{"id":"27","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/27.png","label":"Design 27"},{"id":"28","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/28.png","label":"Design 28"},{"id":"29","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/29.png","label":"Design 29"},{"id":"30","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/30.png","label":"Design 30"},{"id":"31","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/31.png","label":"Design 31"},{"id":"32","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/templates/32.png","label":"Design 32"}],"height":30,"icon":"fa-solid fa-image","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/addon_banner/2190752f-b208-4dd9-a209-32e1b729af2b/54e481dd-8cbd-4f75-baca-41224d0b5d65.png","isMulti":true,"length":42,"weight":0.5,"width":5}'::jsonb,
    3,
    'QR Card',
    'QR Картка',
    'High-quality 8 × 12 cm printed QR cards with your unique QR code. Place them around your venue so guests can easily scan and share their photos and videos.',
    'Високоякісні друковані QR-картки розміром **8 × 12 см** з вашим унікальним QR-кодом. Розмістіть їх у різних місцях на локації, щоб гості могли легко відсканувати код і поділитися своїми фото та відео.',
    '',
    ''
);

INSERT INTO products (
    uid, id, price, fullfillment_type, is_add_on, is_enabled, granted_features, options, priority,
    display_name_en, display_name_uk, display_description_en, display_description_uk,
    display_bullets_en, display_bullets_uk
) VALUES (
    'ff7a22a1-6468-4c90-b4ba-8d7b82e0d6ce',
    'premium',
    2790,
    'digital',
    false,
    true,
    ARRAY[3,4]::INT[],
    '{"activation_days":31,"corePackage":true,"guest_count":-1,"media_count":-1,"storage_days":180}'::jsonb,
    3,
    'Premium',
    'Преміум',
    'COMPLETE EXPERIENCE',
    'ПОВНИЙ ДОСВІД',
    'Unlimited Pictures / Videos
Voice Messages Included
Sponsored Ad Slot Included
6 Months Storage Access
1 Month Upload Duration',
    'Необмежена кількість фото / відео
Голосові повідомлення включені
Рекламна зона
6 місяців доступу до медіа
1 місяць для завантаження медіа'
);

INSERT INTO products (
    uid, id, price, fullfillment_type, is_add_on, is_enabled, granted_features, options, priority,
    display_name_en, display_name_uk, display_description_en, display_description_uk,
    display_bullets_en, display_bullets_uk
) VALUES (
    'a37bdd8f-b987-44f2-ab84-d619f550f84f',
    'plus',
    1790,
    'digital',
    false,
    true,
    ARRAY[]::INT[],
    '{"activation_days":31,"corePackage":true,"guest_count":100,"media_count":-1,"storage_days":90,"tagText":"Recommended"}'::jsonb,
    2,
    'CLASSIC',
    'КЛАСИЧНИЙ',
    'MOST POPULAR',
    'НАЙПОПУЛЯРНІШИЙ',
    'Unlimited Pictures / Videos
3 Months Storage Access
1 Month Upload Duration',
    'Необмежена кількість фото / відео
3 місяці доступу до медіа
1 місяць для завантаження медіа'
);

INSERT INTO products (
    uid, id, price, fullfillment_type, is_add_on, is_enabled, granted_features, options, priority,
    display_name_en, display_name_uk, display_description_en, display_description_uk,
    display_bullets_en, display_bullets_uk
) VALUES (
    'b67ed649-8c98-48af-a544-f93bf032c8be',
    'audioGuestbook',
    250,
    'digital',
    true,
    true,
    ARRAY[3]::INT[],
    '{"icon":"fa-solid fa-microphone","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/addon_banner/78e3aa0e-355e-4af0-a59e-91d323332b3c/d6fb504b-b2dd-4eee-aaac-fcbca01f6cf1.png"}'::jsonb,
    2,
    'Audio Guestbook',
    'Аудіо гостьова книга',
    'Let your guests record and share personal voice messages and wishes directly through your event page. A simple way to capture memories beyond photos and videos.',
    'Дозвольте вашим гостям записувати та ділитися особистими голосовими повідомленнями й побажаннями безпосередньо на сторінці вашої події. Простий спосіб зберегти спогади не лише у фото та відео.',
    '',
    ''
);

INSERT INTO products (
    uid, id, price, fullfillment_type, is_add_on, is_enabled, granted_features, options, priority,
    display_name_en, display_name_uk, display_description_en, display_description_uk,
    display_bullets_en, display_bullets_uk
) VALUES (
    '6f3bdf60-5cb8-49b4-9eb6-aac6d869faa4',
    'standard',
    790,
    'digital',
    false,
    true,
    ARRAY[]::INT[],
    '{"activation_days":30,"corePackage":true,"guest_count":30,"media_count":500,"name_i18n":{"en":"Standard","uk":"Стандартний"},"storage_days":31}'::jsonb,
    1,
    'MINI',
    'МІНІ',
    'FOR SMALL GATHERINGS',
    'ДЛЯ НЕВЕЛИКИХ ЗУСТРІЧЕЙ',
    '200 Pictures / Videos
1 Months Storage Access
1 Month Upload Duration',
    '200 фото / відео
1 місяць доступу до медіа
1 місяць для завантаження медіа'
);

INSERT INTO products (
    uid, id, price, fullfillment_type, is_add_on, is_enabled, granted_features, options, priority,
    display_name_en, display_name_uk, display_description_en, display_description_uk,
    display_bullets_en, display_bullets_uk
) VALUES (
    '4abf09a6-5076-4998-8716-f29d3c7f7450',
    'aesel',
    1000,
    'physical',
    true,
    true,
    ARRAY[]::INT[],
    '{"cost":100,"icon":"fa-solid fa-image","image":"https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/addon_banner/1a43eece-57c2-4e05-9f39-997e24e55fa7/03ec9ce8-ccdf-45aa-b167-57eaa8ef2dea.png"}'::jsonb,
    1,
    'Easel',
    'Мольберт',
    'An elegant wooden easel for displaying your Welcome Board at the entrance or anywhere around your venue.',
    'Елегантний дерев’яний мольберт для розміщення вашої вітальної таблички біля входу або в будь-якому іншому місці на локації вашого заходу.',
    '',
    ''
);

INSERT INTO users (uid, name, surname, mail, is_active) VALUES
    ('17a81a0e-afa9-4fc3-9d11-dfa48a806c4f', 'Local', 'Admin', 'local@membox.dev', TRUE),
    ('394e9916-3217-40ed-8cd7-b6a82cd53810', 'Mustafa', 'Admin', 'mustafa@nanbis.com', TRUE),
    ('04234ae6-0114-418c-a603-56e45d58e5dd', 'Fatih', 'Admin', 'fatihgurson@hotmail.com', TRUE),
    ('e518cff7-d575-4732-a04c-14c269c80668', 'Solomiia', 'Admin', 'solomiia.mozyl@gmail.com', TRUE),
    ('1c1fc562-1f44-43f3-9679-61a7d12070b6', 'Order', 'Admin', 'orders@membox.dev', TRUE),
    ('e872c67b-b84a-4e2c-a6ff-1e68b82333bb', 'Olena', 'Host', 'host@membox.dev', TRUE);

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
    ('17a81a0e-afa9-4fc3-9d11-dfa48a806c4f', 'super_admin', '17a81a0e-afa9-4fc3-9d11-dfa48a806c4f'),
    ('1c1fc562-1f44-43f3-9679-61a7d12070b6', 'order_admin', '17a81a0e-afa9-4fc3-9d11-dfa48a806c4f');

INSERT INTO partnerships (uid, name, surname, company_name, email, phone, is_active)
VALUES ('8fe014b6-afd2-46cb-8929-4ee8158e15a3', 'Local', 'Partner', 'AddMoments Local', 'partner@membox.dev', '+380000000000', TRUE);

INSERT INTO promo_codes (uid, partnership_uid, code, discount_type, discount_value, usage_limit_total, is_active)
VALUES ('10c36718-9810-4111-bc2b-415b5477d284', '8fe014b6-afd2-46cb-8929-4ee8158e15a3', 'LOCAL10', 'percent', 10, 100, TRUE);

INSERT INTO carts (uid, note) VALUES ('e64b9ae7-052f-4049-9aba-650fbad6ff2a', 'full seed purchase');

INSERT INTO cart_items (cart_uid, product_uid, quantity, unit_price_snapshot, status, buyer_config)
VALUES
    ('e64b9ae7-052f-4049-9aba-650fbad6ff2a', 'ff7a22a1-6468-4c90-b4ba-8d7b82e0d6ce', 1, 2790.00, 'purchased', '{}'::jsonb),
    ('e64b9ae7-052f-4049-9aba-650fbad6ff2a', 'fbfecb0e-d23e-4443-97f0-e5909fb9a1af', 8, 1000.00, 'purchased', '{"name_text":"Olena & Andriy","event_date":"2026-09-12"}'::jsonb),
    ('e64b9ae7-052f-4049-9aba-650fbad6ff2a', 'b1f5ab13-4d0c-45d3-8076-ebab873126b4', 16, 50.00, 'purchased', '{}'::jsonb),
    ('e64b9ae7-052f-4049-9aba-650fbad6ff2a', 'b67ed649-8c98-48af-a544-f93bf032c8be', 8, 250.00, 'purchased', '{}'::jsonb);

INSERT INTO purchases (
    uid, provider_id, provider, buyer_uid, cart_uid, purchase_info,
    promo_code_uid, promo_code_text_snapshot, gross_total, discount_amount, net_total
) VALUES (
    '7ffbce86-009f-4433-8ea2-60e91ee26326',
    'local-full-seed-1',
    'mock_paynet',
    'e872c67b-b84a-4e2c-a6ff-1e68b82333bb',
    'e64b9ae7-052f-4049-9aba-650fbad6ff2a',
    '{"premium":1,"welcome_board":8,"printedBanner":16,"audioGuestbook":8}'::jsonb,
    '10c36718-9810-4111-bc2b-415b5477d284',
    'LOCAL10',
    5440.00,
    279.00,
    5161.00
);

INSERT INTO events (
    uid, admins, activation_date, purchase_uid, status, name, event_type,
    description, welcome_message, settings
) VALUES (
    '83fc0cf0-a3db-477d-90e4-d85f7b1411c3',
    ARRAY['e872c67b-b84a-4e2c-a6ff-1e68b82333bb']::uuid[],
    NOW() - interval '2 days',
    '7ffbce86-009f-4433-8ea2-60e91ee26326',
    'paid',
    'Olena & Andriy Wedding',
    'wedding',
    'Local full-seed event for development.',
    'Welcome. Scan the QR and share your photos.',
    '{"remove_uploads":true}'::jsonb
);

INSERT INTO participants (uid, name, event_uid) VALUES
    ('b0dd38de-0594-49c4-8626-5d08360d8eef', 'Anna', '83fc0cf0-a3db-477d-90e4-d85f7b1411c3'),
    ('4f5e7c64-0e80-4d4d-83dd-f353564400dd', 'Bohdan', '83fc0cf0-a3db-477d-90e4-d85f7b1411c3');

INSERT INTO uploads (upload_type, client_uid, event_uid, value) VALUES
    ('text', 'b0dd38de-0594-49c4-8626-5d08360d8eef', '83fc0cf0-a3db-477d-90e4-d85f7b1411c3', 'Wishing you a lifetime of happiness!'),
    ('text', '4f5e7c64-0e80-4d4d-83dd-f353564400dd', '83fc0cf0-a3db-477d-90e4-d85f7b1411c3', 'Congratulations from the local seed.');

INSERT INTO global_attributes (key, value, is_public) VALUES
    ('site_notice', 'Local development database. Catalog seeded from public product API. Users are fake.', TRUE);

COMMIT;
