# Kategori sayfası (Arde madde 5)

WordPress'teki `/categories/` (EN) ve `/uk/categories-addmoments/` (UK) sayfalarının içeriği.
Ana sayfa gibi Elementor'da **HTML widget'larından** oluşur; her `dist/<dil>/NN-*.html` dosyası
bir widget'a olduğu gibi yapıştırılır. Header ve footer Elementor Theme Builder'dan
(doküman 867 / 874) kendiliğinden gelir, bu bloklarda yoktur.

Tasarım: https://www.figma.com/design/3nux77bvnTis7FLqRQChTp/Categories
Metinlerin okunur hali (müşteriye gösterilecek): `addmoments-com-ua/KATEGORI-SAYFALARI-METIN.md`

## Dosyalar

| Yol | Ne |
|---|---|
| `copy.json` | Bütün metinler, bağlantılar ve görseller, EN + UK. **Metin değişikliği yalnızca burada yapılır.** |
| `sections/*.html` | Bölüm şablonları (`{{x}}` metin, `{{#liste}}…{{/liste}}` döngü). |
| `css/new.css` | Yeni bölümlerin (hero, intro, events) ortak tabanı; her widget kendi kök sınıfıyla gömer. |
| `css/{steps,testimonials,faq,cta}.css` | Ana sayfa widget'larından alınan CSS (başlık fontu dile göre değişkene bağlandı). Sayfaya özgü farklar şablondaki ek `<style>` kurallarında. |
| `build.py` | `dist/` üretir. |
| `dist/en`, `dist/uk` | Elementor'a yapıştırılacak 7'şer blok. Repoda tutulmaz (`.gitignore`), `python3 build.py` ile üretilir. |

## Build ve önizleme

```sh
python3 build.py
# önizleme: o dilde kaydedilmiş bir canlı sayfa verilir, header/footer ondan alınır
curl -s https://addmoments.com.ua/ -o /tmp/home.html
curl -s https://addmoments.com.ua/uk/home-ua/ -o /tmp/home-ua.html
python3 build.py --shell en=/tmp/home.html --shell uk=/tmp/home-ua.html   # dist/preview-*.html
```

Önizleme dosyası göreli adresler (`/events/...`, sitenin CSS'i) içerdiği için `file://` ile açılınca
eksik görünür. 12 Ekim'de Playwright'ta `https://addmoments.com.ua/__amc_preview/` isteği yakalanıp
bu dosyayla cevaplanarak açıldı (siteye yazma yok); 1440 ve 390 px, EN ve UK, sekme/klavye/hash,
SSS, adımlar ve yorum kaydırma denendi, JS hatası ve yatay taşma yok.

## Dile göre farklar

- **Başlık fontu:** Archivo Black ve Anton'da Kiril harfi yok. Ukraynaca ana sayfa gibi UK blokları
  başlıkta `'Helvetica Neue', … Arial` 900 kullanır (`copy.json` → `font_heading`, `heading_weight`).
- **Bağlantılar:** UK sayfaları `-addmoments` sonekli (`/uk/faq-addmoments/`), fiyat sayfası `lang=ua`.

## Canlıda (12 Ekim 2026)

| | Sayfa | Adres |
|---|---|---|
| EN | 6962 | https://addmoments.com.ua/categories/ |
| UK | 6964 (Polylang'de 6962'nin çevirisi) | https://addmoments.com.ua/uk/categories-addmoments/ |

Nasıl konuldu (güncellerken de aynı yol):

- **Elementor verisi REST ile yazıldı.** `_elementor_data`, `_elementor_edit_mode`, `_elementor_template_type`
  ve `_elementor_page_settings` REST'te açık. `dist/` bloklarından ana sayfayla aynı yapı kurulup
  (her blok tam genişlik, margin/padding 0 bir container içinde tek HTML widget)
  `POST https://addmoments.com.ua/?rest_route=/wp/v2/pages/<id>` ile `meta` olarak gönderildi.
  **`/wp-json/...` yolu kullanılmaz:** `.htaccess`'in sona `/` ekleyen yönlendirmesi POST'u GET'e
  çeviriyor ve istek sessizce liste döndürüyor. Yazdıktan sonra veri geri okunup karşılaştırıldı.
- **Yayın Elementor editöründen** (`$e.run('document/save/publish')`): Elementor kendi sürüm/CSS
  kaydını yazsın diye. Editör tam yüklenmeden çağrılırsa `container.settings` tanımsız hatası verir;
  önce `elementor.documents.getCurrent().container.settings` beklenir.
- **UK sayfası** Pages listesindeki Polylang "Add a translation in Українська" bağlantısıyla
  (klasik editör) açılıp kaydedildi, sonra verisi REST ile yazıldı.
- **Yoast** klasik editörde `wp.data.dispatch('yoast-seo/editor').updateData({title, description})`
  + "Update" ile.

## WordPress'e kurulum (elle yapılacaksa)

Her iki dil için aynı adımlar:

1. **Sayfa:** Pages → Add New. Başlık `Categories` / `Категорії`. Slug EN `categories`,
   UK `categories-addmoments`. UK sayfası Polylang'de EN sayfasının çevirisi olarak bağlanır.
   Şablon ana sayfayla (sayfa 46 / 3824) aynı: varsayılan şablon + Elementor.
2. **Elementor:** sayfa ayarlarında başlığı gizle. Tek bir tam genişlik container, iç boşluk ve
   gap 0 (ana sayfadaki container ile aynı). İçine sırayla 7 HTML widget:
   `01-hero` → `02-intro` → `03-events` → `04-steps` → `05-testimonials` → `06-faq` → `07-cta`.
3. **Yoast SEO:**

   | | EN | UK |
   |---|---|---|
   | SEO title | Event Categories – QR Photo Sharing for Any Occasion \| AddMoments | Категорії подій – обмін фото через QR-код \| AddMoments |
   | Meta description | Weddings, birthdays, concerts, corporate events, graduations and more: collect guests' photos and videos in one private album through a single QR code. | Весілля, дні народження, концерти, корпоративи, випускні та інші події: збирайте фото й відео гостей в одному приватному альбомі через один QR-код. |

4. **Kontrol:** sayfa açılıyor, `/categories/#birthdays` doğrudan o sekmeyi açıyor, hero'daki
   "Choose your event" sekmelere iniyor, telefonda sekmeler yatay kayıyor, dil seçici EN↔UK
   sayfaları arasında geçiyor.

## Sekme bağlantıları

Her sekmenin sabit bir adresi var, başka sayfalardan doğrudan açılabilir:
`weddings`, `concerts`, `birthdays`, `holidays`, `sport`, `education`, `business`, `travel`,
`memorials`, `special` → örn. `/categories/#memorials`, `/uk/categories-addmoments/#memorials`.
