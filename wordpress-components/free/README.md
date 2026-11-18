# Free paket — WordPress header (18 Kasim 2026)

Musteri istegi (WhatsApp 18 Kasim 11:31, Fatih): header'da "Get Started Free" + her zaman gorunen "Sign in";
"Get started free" kayit sayfasini (`/signup`, React) acar. React header'i `public/index.html` icinde.

- `free-wp.js` — header sablonu widget'inin kayitli html'ini donusturur: `header(html, 'en'|'uk')`.
  Masaustu CTA'nin onune "Sign in", CTA `/signup?lang=en|ua` + "Get started free" / "Почати безкоштовно";
  mobil menunun altina "Sign in" + ayni CTA. Dar masaustu icin CSS (1025-1260 px her iki dil, UK 1025-1420 px).
  Her adim yerini bulamazsa hata atar; ikinci kez calistirmak hata verir.

| Sablon | Post | Widget |
|---|---|---|
| Header EN | 867 (elementor_library) | `c4fae6c` |
| Header UK | 3938 (elementor_library) | `43bae5f` |

Yayin `../demo/README.md` ile ayni (wp-admin oturumu acik tarayici, `?rest_route=/wp/v2/elementor_library/<id>`,
yedek, `_elementor_data` POST, `admin-ajax.php` `action=elementor_clear_cache`).

Olcum (Playwright, canli sayfanin kopyasina donusum uygulanarak): EN/UK 1025-1920 px'te sayfa tasmiyor, orta ve sag
link gruplari arasinda en az 26 px (UK 1025 px'te 44 px); 390 px mobil menude "Sign in" ve CTA.
