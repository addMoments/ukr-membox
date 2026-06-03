# Meta Pixel Entegrasyon Analizi

Bu doküman, Add Moments projesine Meta/Facebook Pixel eklenmesi talebini proje özelinde açıklar. Amaç, SEO/marketing ekibinin istediği event'leri doğru kullanıcı aksiyonlarında tetiklemek ve özellikle satın alma/kayıt gibi kritik dönüşümlerde yanlış veya çift sayım riskini azaltmaktır.

## Müşteri Talebi

Müşteri siteye Meta Pixel eklenmesini istiyor. Paylaştıkları örnek event komutları:

```js
fbq('track', 'Lead');
fbq('track', 'Purchase', { value: 0.00, currency: 'USD' });
fbq('track', 'AddToCart');
fbq('track', 'CompleteRegistration');
```

Talepte özellikle iki aksiyonun öncelikli olduğu belirtilmiş:

- Registration button: kullanıcı kayıt aksiyonu.
- Thank You page after finalising the purchase: ödeme başarıyla tamamlandıktan sonraki teşekkür/başarı ekranı.

Sonradan kapsamı genişleterek `AddToCart` event'inin de isteneceği netleşti.

## Bu Projede İlgili Akışlar

Bu repo React tabanlı bir frontend uygulaması. Routing `react-router-dom` üzerinden `src/App.tsx` içinde tanımlı.

Pixel event'leri için önemli ekranlar ve dosyalar:

- `public/index.html`
  - Global Meta Pixel base script'i eklemek için uygun yer.
  - Alternatif olarak React tarafında küçük bir tracking helper ile de yüklenebilir.

- `src/pages/event-checkout.tsx`
  - `/checkout` route'u.
  - Sadece `V2Checkout` partial'ını render ediyor.

- `src/v2-partials/V2Checkout.tsx`
  - Checkout ekranının ana mantığı burada.
  - `handleCompleteOrder` fonksiyonu ödeme oluşturma isteğini başlatıyor.
  - Bu noktada kullanıcı ödeme sürecine gönderiliyor, ama ödeme henüz başarılı değil.
  - Bu yüzden burada `Purchase` event'i tetiklenmemeli.

- `src/pages/checkout-pending.tsx`
  - `/checkout/pending/:encPackedUID` route'u.
  - Ödeme sonrası backend status polling burada yapılıyor.
  - `data.status === 'success'` olduğunda ödeme başarıyla doğrulanmış oluyor.
  - `Purchase` event'i için en doğru frontend noktası burası.

- `src/types/mesage-screen.ts`
  - `sendToMsg(...)` helper'ı kullanıcıyı `/notice/...` ekranına yönlendiriyor.

- `src/pages/message.tsx`
  - `/notice/*` route'u.
  - Base64 encoded message okuyup Notice ekranını render ediyor.

- `src/v2-partials/notice.tsx`
  - Başarı/hata/bilgi gibi genel notice ekranı.
  - Sadece ödeme başarısı için kullanılmıyor; bu yüzden burada her yüklemede `Purchase` tetiklemek yanlış olur.

- `src/pages/signup.tsx`
  - `/signup/:token` route'u.
  - Token bazlı kayıt akışı burada.
  - `signUpEmailWithToken(...)` başarılı dönerse kayıt tamamlanmış sayılır.
  - `CompleteRegistration` için doğru yer burasıdır.

- `src/v2-partials/V2SignUpForm.tsx`
  - Kayıt formu ve submit butonu burada.
  - Butona basıldığı an event atılabilir, ancak daha doğru ölçüm kayıt API'si başarılı döndükten sonra yapılmalıdır.

- `src/client/cart.ts`
  - Cart state ve `setCartQty(...)` burada.
  - Teknik olarak ürün miktarı sepete burada yazılıyor.
  - Ancak bu projede kullanıcı ürünleri seçip daha sonra checkout'a geçiyor; sepet ayrı bir modal/ekran olarak anlık gösterilmiyor.

## Event Kararları

### 1. AddToCart

Müşteri `AddToCart` event'ini de istiyor.

Bu projede iki olası yorum var:

1. Teknik yorum: ürün quantity'si cart state'e ilk kez yazıldığında `AddToCart` atılır.
2. UX/marketing yorumu: kullanıcı paketleri seçip checkout'a geçtiğinde artık sepete gitmiş sayılır.

Bu proje için önerilen yorum ikinci seçenektir:

Kullanıcı ürün/paket seçimini tamamlayıp checkout'a geçtiğinde `AddToCart` tetiklenmelidir.

Sebep:

- Kullanıcı ürünü seçtiği anda ayrı bir sepet ekranı görmüyor.
- Checkout ekranı sepet/ödeme deneyiminin başladığı yer.
- Marketing tarafında "kullanıcı sepete ilerledi" anlamı checkout'a geçişte daha net.

Uygulamada dikkat edilmesi gerekenler:

- Checkout sayfası refresh edilirse `AddToCart` tekrar atılmamalı.
- Aynı cart için bir kez tetiklenmeli.
- Cart boşsa event atılmamalı.
- Bunun için `sessionStorage` tabanlı bir guard kullanılabilir.

Alternatif daha gelişmiş kurgu:

- Ürün/paket seçildiğinde: `AddToCart`
- Checkout'a geçildiğinde: `InitiateCheckout`
- Ödeme başarıyla tamamlandığında: `Purchase`

Ancak müşteri özel olarak `AddToCart` istediği için ilk implementasyonda checkout'a geçişte `AddToCart` yeterlidir.

### 2. CompleteRegistration

Kayıt event'i için iki seçenek var:

1. Kullanıcı kayıt butonuna bastığında event atmak.
2. Kayıt API'si başarılı olduktan sonra event atmak.

Önerilen yaklaşım:

`CompleteRegistration` sadece `signUpEmailWithToken(...)` başarılı döndükten sonra tetiklenmelidir.

Sebep:

- Butona basmak kayıt tamamlandı anlamına gelmez.
- Form validation veya API hatası olabilir.
- Meta dönüşüm raporlarında gerçek kayıt sayısını görmek daha değerlidir.

İlgili dosya:

- `src/pages/signup.tsx`

İlgili fonksiyon:

- `handleTokenSignUp`

Akış:

1. Kullanıcı `/signup/:token` sayfasını açar.
2. `V2SignUpForm` form submit olur.
3. `handleTokenSignUp` çalışır.
4. `signUpEmailWithToken(...)` başarılı olursa `fbq('track', 'CompleteRegistration')` tetiklenir.

Müşteri özellikle "button click" olarak ölçmek isterse ayrıca `Lead` event'i buton submit anında atılabilir. Fakat önerilen ana dönüşüm event'i `CompleteRegistration` olmalıdır.

### 3. Purchase

`Purchase` event'i ödeme başarıyla finalize olduktan sonra tetiklenmelidir.

Bu projede ödeme başlatma ve ödeme başarısı farklı noktalarda gerçekleşiyor:

- `src/v2-partials/V2Checkout.tsx`
  - `handleCompleteOrder` ödeme isteğini başlatır.
  - Kullanıcı LiqPay veya ödeme provider akışına yönlendirilir.
  - Bu noktada ödeme henüz başarılı değildir.

- `src/pages/checkout-pending.tsx`
  - Backend'e `/api/purchase/:encPackedUID/status` polling yapılır.
  - `data.status === 'success'` dönerse ödeme başarılı kabul edilir.
  - `Purchase` event'i burada tetiklenmelidir.

Uygulamada dikkat edilmesi gerekenler:

- `Purchase` event'i ödeme success olmadan atılmamalı.
- Pending veya failed durumda event atılmamalı.
- Sayfa refresh veya polling tekrarında çift event atılmamalı.
- `encPackedUID` bazlı `sessionStorage` guard kullanılmalı.

Örnek guard mantığı:

```js
const key = `meta_purchase_tracked_${encPackedUID}`;
if (!sessionStorage.getItem(key)) {
  fbq('track', 'Purchase', { value, currency });
  sessionStorage.setItem(key, '1');
}
```

## Pixel Base Script

Meta Pixel'in çalışması için önce base script eklenmelidir.

SEO/marketing ekibinden alınacak Pixel ID ile standart Meta Pixel script'i siteye eklenir.

Olası yer:

- `public/index.html`

Avantaj:

- Tüm uygulamada global çalışır.
- Meta'nın önerdiği klasik kurulum biçimine yakındır.

Alternatif:

- `src/client/meta-pixel.ts` gibi küçük bir helper yazılıp React tarafında init edilebilir.

Bu projede temiz kullanım için helper önerilir:

- `trackMetaEvent(...)`
- `trackAddToCart(...)`
- `trackCompleteRegistration(...)`
- `trackPurchase(...)`

Helper'ın görevi:

- `window.fbq` yoksa uygulamayı kırmamak.
- Event parametrelerini tek noktadan standardize etmek.
- Duplicate guard'ları daha okunabilir hale getirmek.

## Gerekli Bilgiler

SEO/marketing ekibinden şu bilgiler alınmalı:

1. Meta Pixel ID
   - Zorunlu.
   - Örnek: `123456789012345`

2. Purchase currency
   - Talepte örnek olarak `USD` verilmiş.
   - Ancak sitede fiyatlar `₴` olarak görünüyor.
   - Büyük ihtimalle doğru currency `UAH`.
   - Netleştirilmeden hardcode edilmemeli.

3. Purchase value
   - Gerçek ödeme tutarı mı gönderilecek?
   - Yoksa örnekteki gibi `0.00` mı kalacak?
   - Reklam optimizasyonu için gerçek tutar daha değerlidir.

4. Event mapping onayı
   - `AddToCart`: checkout'a geçişte.
   - `CompleteRegistration`: kayıt API'si başarılı olduktan sonra.
   - `Purchase`: ödeme status `success` olduktan sonra.

5. Test doğrulaması
   - Meta Events Manager'da Test Events ekranından doğrulama yapacaklar mı?
   - Gerekirse bize test erişimi sağlayacaklar mı?

## Önerilen Uygulama Planı

### Aşama 1: Tracking Helper

Yeni bir küçük helper eklenir.

Önerilen dosya:

- `src/client/meta-pixel.ts`

İçerik sorumlulukları:

- `fbq` için TypeScript global tanımı.
- Güvenli track fonksiyonu.
- Event-specific wrapper fonksiyonlar.
- Gerekiyorsa sessionStorage guard helper'ı.

Örnek API:

```ts
trackMetaAddToCart(params?);
trackMetaCompleteRegistration(params?);
trackMetaPurchase({ value, currency, eventId? });
```

### Aşama 2: Base Pixel Kurulumu

Pixel ID alındıktan sonra base script eklenir.

Olası dosya:

- `public/index.html`

Eklenmesi gereken temel davranış:

- Pixel init.
- İlk `PageView`.
- SPA route değişimlerinde gerekiyorsa ek `PageView`.

Not:

Bu proje SPA olduğu için sadece ilk HTML load'da `PageView` atmak yeterli olmayabilir. Route değişimlerinde de `PageView` istenirse `src/App.tsx` içindeki mevcut `RouteChangeEmitter` veya `useLocation` mantığı üzerinden takip eklenebilir.

### Aşama 3: AddToCart Event'i

Önerilen trigger:

- Kullanıcı checkout'a geçtiğinde veya checkout sayfası cart dolu şekilde ilk açıldığında.

İlgili dosya:

- `src/v2-partials/V2Checkout.tsx`

Mantık:

- Cart init olduktan sonra cart boş değilse event at.
- Aynı cart için tekrar atma.
- `sessionStorage` guard kullan.

Guard için cart içeriğinden basit bir signature üretilebilir:

```js
cart.cartItems
  .filter(item => item.quantity > 0)
  .map(item => `${item.product_uid}:${item.quantity}`)
  .sort()
  .join('|')
```

Bu signature ile `AddToCart` aynı checkout oturumunda tekrar sayılmaz.

### Aşama 4: CompleteRegistration Event'i

İlgili dosya:

- `src/pages/signup.tsx`

Mantık:

- `signUpEmailWithToken(...)` başarılı olursa event at.
- Catch bloğunda event atma.
- Aynı token için duplicate riski düşük ama yine de basit guard eklenebilir.

Önerilen event:

```js
fbq('track', 'CompleteRegistration');
```

İstenirse parametre:

```js
fbq('track', 'CompleteRegistration', {
  content_name: 'signup_with_token'
});
```

### Aşama 5: Purchase Event'i

İlgili dosya:

- `src/pages/checkout-pending.tsx`

Mantık:

- `data.status === 'success'` olduğunda event at.
- `data.status === 'failed'` veya `pending` durumunda atma.
- `encPackedUID` bazlı `sessionStorage` guard kullan.

Önerilen event:

```js
fbq('track', 'Purchase', {
  value: purchaseValue,
  currency: purchaseCurrency
});
```

Eğer backend response gerçek tutar dönmüyorsa ilk aşamada:

```js
fbq('track', 'Purchase', {
  value: 0.00,
  currency: 'UAH'
});
```

veya SEO ekibi `USD` isterse:

```js
fbq('track', 'Purchase', {
  value: 0.00,
  currency: 'USD'
});
```

Ancak doğru reklam optimizasyonu için uzun vadede gerçek satın alma tutarı kullanılmalıdır.

## Riskler ve Dikkat Noktaları

### Çift Sayım

SPA uygulamalarda sayfa refresh, geri/ileri navigasyon veya polling tekrarları event'lerin birden fazla atılmasına yol açabilir.

Önlem:

- `Purchase` için `encPackedUID` bazlı guard.
- `AddToCart` için cart signature bazlı guard.
- `CompleteRegistration` için token veya submit success bazlı guard.

### Yanlış Purchase Zamanı

`handleCompleteOrder` içinde `Purchase` atmak yanlış olur.

Sebep:

- Kullanıcı ödeme sağlayıcısına yönlendirilmiş olabilir.
- Ödeme başarısız olabilir.
- Kullanıcı ödeme ekranını kapatabilir.

Doğru nokta:

- `src/pages/checkout-pending.tsx` içinde `data.status === 'success'`.

### Notice Ekranında Yanlış Event

`/notice/*` ekranı sadece satın alma başarısı için kullanılmıyor. Hata veya başka bilgi mesajları da aynı ekranı kullanabilir.

Bu yüzden `src/v2-partials/notice.tsx` içinde genel olarak `Purchase` atmak doğru değildir.

### Currency Belirsizliği

Müşteri örneğinde `USD` var ama sitede fiyat formatı `₴`.

Netleştirilmesi gereken karar:

- `UAH` mı?
- `USD` mi?
- Fiyatlar hangi currency ile backend'e kaydediliyor?

### Value Belirsizliği

`value: 0.00` teknik olarak çalışır ama reklam optimizasyonu açısından zayıftır.

Tercih:

- İlk hızlı kurulumda `0.00`.
- Daha doğru kurulumda gerçek ödeme tutarı.

### Ad Blocker / Consent

Kullanıcıda ad blocker varsa Pixel çalışmayabilir. Bu normaldir.

Ek olarak, lokasyona ve hukuki gerekliliklere göre cookie consent veya privacy policy güncellemesi gerekebilir. Bu teknik implementasyonun dışında, iş/hukuk tarafında değerlendirilmelidir.

## Test Planı

1. Meta Pixel Helper browser extension ile base Pixel yükleniyor mu kontrol edilir.
2. Site açıldığında `PageView` gidiyor mu kontrol edilir.
3. Ürün seçilip checkout'a gidildiğinde `AddToCart` gidiyor mu kontrol edilir.
4. Checkout sayfası refresh edildiğinde aynı cart için tekrar `AddToCart` gidiyor mu kontrol edilir. Gitmemesi beklenir.
5. Signup token ile başarılı kayıt yapıldığında `CompleteRegistration` gidiyor mu kontrol edilir.
6. Hatalı kayıt denemesinde `CompleteRegistration` gitmediği doğrulanır.
7. Ödeme success simülasyonu veya test ödeme ile `Purchase` gidiyor mu kontrol edilir.
8. Failed/pending ödeme durumunda `Purchase` gitmediği doğrulanır.
9. Aynı `/checkout/pending/:encPackedUID` refresh edilirse `Purchase` tekrar gitmiyor mu kontrol edilir.
10. Meta Events Manager > Test Events ekranında event'lerin göründüğü müşteri/SEO ekibi tarafından doğrulanır.

## Süre Tahmini

Pixel ID ve currency/value kararları hazırsa:

- Basic entegrasyon: 1-2 saat.
- Daha temiz ve guard'lı entegrasyon: yarım gün.
- Gerçek purchase value, ürün detayları, gelişmiş parametreler ve test senaryoları dahil: yarım gün ile 1 gün arası.

Bu proje için teknik zorluk düşük-orta seviyededir. Zor olan kısım koddan çok event'lerin doğru iş anlamına bağlanmasıdır.

## Müşteriye Sorulacak Net Sorular

Müşteriye veya SEO ekibine şu sorular gönderilebilir:

```text
Meta Pixel entegrasyonu için Pixel ID'yi paylaşabilir misiniz?

Purchase event'i için currency ne olmalı: UAH mı USD mi?

Purchase event'inde value olarak gerçek ödeme tutarını mı göndermemizi istersiniz, yoksa örnekteki gibi 0.00 yeterli mi?

Event mapping'i şu şekilde kurmamızı onaylıyor musunuz?
- AddToCart: kullanıcı seçtiği ürünlerle checkout'a geçtiğinde
- CompleteRegistration: kayıt başarıyla tamamlandığında
- Purchase: ödeme backend tarafından success olarak doğrulandığında

Test için Meta Events Manager'da event'lerin düştüğünü siz mi doğrulayacaksınız, yoksa bize test erişimi sağlayacak mısınız?
```

## Önerilen Final Kapsam

İlk implementasyon için önerilen kapsam:

- Meta Pixel base script kurulumu.
- `AddToCart` event'i: checkout'a geçiş/cart dolu checkout açılışı.
- `CompleteRegistration` event'i: başarılı signup sonrası.
- `Purchase` event'i: başarılı ödeme status sonrası.
- `sessionStorage` ile duplicate event guard.
- Meta Pixel Helper ve Events Manager ile test.

Bu kapsam, müşteri talebindeki öncelikleri karşılar ve yanlış dönüşüm sayımı riskini makul seviyede azaltır.
