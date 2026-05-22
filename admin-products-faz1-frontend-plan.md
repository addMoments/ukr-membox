# Admin Products Faz 1 - Frontend Uygulama Plani

Bu dokuman, backend tarafinda tanimlanan Faz 1 API sozlesmesine gore frontend implementasyon adimlarini listeler.

## Hedef

- Super admin icin package/add-on urunlerini listelemek
- Package ve add-on urunlerini edit etmek
- Faz 1 validation kurallarini frontend seviyesinde de uygulamak
- Modern, okunabilir, responsive bir admin arayuzu sunmak

## API Sozlesmesi Ozeti

### Listeleme

- `GET /api/admin/products`
- Yetki: Super admin

### Guncelleme

- `PATCH /api/admin/products/{productUID}`
- Yetki: Super admin

### Standart request alanlari

- `name`
- `price`
- `guest_count`
- `media_count`
- `activation_period_days`
- `storage_period_days`
- `voice_included`

### Alias (geriye donuk uyumluluk)

- `package_name`, `add_on_name`
- `package_price`, `add_on_price`
- `activation_days`, `storage_days`

### Validation kurallari

- `price >= 0`
- `guest_count >= -1`
- `media_count >= -1`
- `activation_period_days > 0`
- `storage_period_days > 0`
- `voice_included` boolean

---

## Uygulama TODO Listesi

- [x] Adim 1 - API client + type + normalize katmani
- [x] Adim 2 - Admin Products sayfa iskeleti
- [x] Adim 3 - Modern UI (kart/bolum tabanli)
- [x] Adim 4 - Form state + frontend validation
- [x] Adim 5 - PATCH kaydetme akisi
- [ ] Adim 6 - UX polish (loading/success/error/403)
- [ ] Adim 7 - Route entegrasyonu + lint kontrolu

---

## Adim Detaylari (Ne / Nasil / Neden)

### Adim 1 - API client + type + normalize katmani

**Ne**
- Admin products endpointleri icin merkezi client yazilacak.
- Product modelinde options alanlari typed hale getirilecek.

**Nasil**
- `src/client/admin-products.ts` olusturulacak.
- `getAdminProducts()` ve `updateAdminProduct(productUID, payload)` fonksiyonlari eklenecek.
- API response icin normalize katmani yazilacak:
  - `price` ve `priority` string gelebilecegi icin number'a cevrilecek.
  - `options` alani eksikse guvenli default uygulanacak.

**Neden**
- UI katmani backend response formatina bagimli kalmaz.
- Tip guvenligi ve bakim kolayligi artar.
- Validation ve payload olusturma daha temiz olur.

---

### Adim 2 - Admin Products sayfa iskeleti

**Ne**
- Yeni admin sayfasi olusturulacak: urun listesi + edit alanlari.

**Nasil**
- `src/pages/admin/products.tsx` eklenecek.
- Ilk render'da products cekilecek.
- `is_add_on` ile Package ve Add-on bolumleri ayrilacak.

**Neden**
- Faz 1 ihtiyacina odakli tek bir ekran olusur.
- Sonraki adimlardaki UI/validation/save logic'i tek yerde toplanir.

---

### Adim 3 - Modern UI

**Ne**
- Modern, sade, responsive gorunum.

**Nasil**
- `src/v2-styles/AdminProducts.css` olusturulacak.
- Kart tabanli duzen:
  - Package kartlari (genis alan)
  - Add-on kartlari (kompakt alan)
- Durum badge'leri, temiz spacing, soft shadow, net tipografi.

**Neden**
- Admin panelde kullanilabilirlik artar.
- Mevcut v2 tasarim diliyle tutarlilik korunur.

---

### Adim 4 - Form state + frontend validation

**Ne**
- Her urun kartinin editable state'i ve validation kurallari.

**Nasil**
- Package kartlarinda:
  - `name`, `price`, `guest_count`, `media_count`, `activation_period_days`, `storage_period_days`, `voice_included`
- Add-on kartlarinda:
  - `name`, `price`
- Kaydetmeden once validation calistirilacak ve hata mesaji gosterilecek.

**Neden**
- Yanlis input erken asamada yakalanir.
- Backend'e gereksiz hatali istek azalir.

---

### Adim 5 - PATCH kaydetme akisi

**Ne**
- Guncellenen alanlar endpoint'e gonderilecek.

**Nasil**
- `PATCH /api/admin/products/{productUID}`
- Payload standart alan adlariyla kurulacak.
- Add-on icin sadece `name` ve `price` gonderilecek.
- Kaydetme sirasinda ilgili kartta loading durumu gosterilecek.

**Neden**
- Net ve kontrollu bir guncelleme akisi saglanir.
- Faz 1 sozlesmesine birebir uyum elde edilir.

---

### Adim 6 - UX polish

**Ne**
- Kullaniciya net durum geri bildirimi.

**Nasil**
- Sayfa loading state
- Kart bazli save loading state
- Basarili kayit mesaji
- Hata durumunda anlasilir metin
- 403 icin "Super admin degilsiniz" gorunumu

**Neden**
- Admin deneyimi guvenilir ve takip edilebilir olur.

---

### Adim 7 - Route + kalite kontrol

**Ne**
- Sayfayi route'a baglamak ve kalite kontrollerini tamamlamak.

**Nasil**
- `src/App.tsx` icine `/admin/products` route eklenecek.
- Son duzenlemelerden sonra lint hatalari kontrol edilip giderilecek.

**Neden**
- Ozellik erisilebilir hale gelir.
- Teknik borc birikmeden teslim edilir.

---

## Kod Yorum Satiri Prensibi

Bu implementasyonda yorumlar su noktalara eklenecek:

- Normalize edilen alanlarin gerekcesi (string -> number donusumu vb.)
- Package/Add-on alan ayriminin nedeni
- Payload olusturma ve alias uyumlulugu
- Validation'da kritik sinir degerleri

Not: Gereksiz aciklama yerine, sadece kritik karar noktalarinda kisa ve teknik yorum kullanilacak.

---

## Onayli Ilerleme Sekli

Her adim su sekilde ilerleyecek:

1. Adim uygulanir
2. "Ne yapildi / nasil yapildi / neden bu yontem secildi" raporlanir
3. Onay alinir
4. Bir sonraki adima gecilir

