# Canli demo — WordPress parcasi (17 Kasim 2026)

Musteri istegi (WhatsApp 17 Kasim): ana sayfada demo QR'i + "Try the live demo" dugmesi, hero gorselindeki eski QR
kalkar, header'da "Live demo". React tarafi (React header'i ve Services & Prices bandi) `public/assets/hfSetup.js`,
`src/utils/demo.ts`, `src/v2-partials/V2EventNew.tsx` icinde.

- `demo-wp.js` — Elementor HTML widget'larinin kayitli html'ini donusturur: `hero(html, 'en'|'uk')`, `header(html, 'en'|'uk')`.
  Her adim yerini bulamazsa hata atar; ikinci kez calistirmak hata verir (eski QR yok).
- `demo-qr.svg` — `https://addmoments.com.ua/l/qdfKM38bpSv-KvP1rDjMvzA` (qrcode npm, ECC M). `demo-wp.js` icine gomulu.

| Sayfa | Post | Widget |
|---|---|---|
| Ana sayfa EN | 46 | hero `1c4d882` |
| Ana sayfa UK (`/uk/home-ua/`) | 3824 | hero `00f0c81` |
| Header sablonu EN | 867 (elementor_library) | `c4fae6c` |
| Header sablonu UK | 3938 (elementor_library) | `43bae5f` |

Yayin (wp-admin oturumu acik tarayicida; kategori sayfasiyla ayni yontem, `../categories/README.md`):
1. `admin-ajax.php?action=rest-nonce` ile nonce al.
2. `?rest_route=/wp/v2/pages/46&context=edit` (sablonlar `/wp/v2/elementor_library/867`) ile `meta._elementor_data`'yi oku,
   yedegini `db-backups/wp-2026-11-17/` altina kaydet.
3. JSON'da widget'i id ile bul, `settings.html`'i `demo-wp.js`'ten gecir, `meta._elementor_data`'yi POST et
   (`?rest_route=...`, `/wp-json/` degil: .htaccess POST'u GET'e cevirir).
4. Elementor onbellegini temizle (Elementor > Tools > Clear Files & Data) ve sayfayi ziyaretci olarak kontrol et.

Geri alma: yedekteki `_elementor_data`'yi ayni yolla geri yaz.
