# PROJECT DOCUMENTATION

## Türkçe

### 1. Proje Özeti

Bu repository, **Add Moments** ürünü için geliştirilmiş React tabanlı frontend uygulamasıdır. Uygulama, etkinlik sahiplerinin dijital etkinlik albümü oluşturmasına, misafirlerden fotoğraf/video/ses/metin toplamasına, QR/link paylaşmasına, etkinlik tema ve ayarlarını yönetmesine, paket/add-on satın almasına ve admin kullanıcılarının sipariş/ürün/promo/partnerlik yönetmesine hizmet eder.

Domain olarak ürün; düğün, konser, parti ve benzeri etkinliklerde misafirlerden uygulama indirtmeden medya toplama, guestbook oluşturma ve satın alınabilir ek ürünler sunma akışına odaklanır. Public HTML metadata ve header/footer metinlerinde ürün "The easiest way to collect media/photos from your guests" olarak konumlanır.

Kullanıcıların gördüğü ana akışlar:

- Public / satın alma akışı: `/events/services-and-prices` sayfasında paket ve add-on seçimi, `/checkout` ile ödeme başlatma, LiqPay checkout yönlendirmesi, `/checkout/pending/:encPackedUID` ile ödeme durumunu bekleme.
- Auth akışı: `/signin`, `/signout`, `/recover`, `/reset-password/:token`, `/signup/:token`.
- Etkinlik sahibi akışı: `/events` yönlendirme sayfası, `/event/:uid` ve alt sayfalarda dashboard, galeri, guestbook, trash, collaborators, settings, theme, QR ve poster yönetimi.
- Misafir akışı: `/guest/:uid`, `/guest/:uid/uploads`, `/guest/:uid/guestbook`; misafir etkinlik sayfasını açar, medya yükler ve guestbook mesajı bırakır.
- Admin akışı: `/admin/orders`, `/admin/orders/:uid`, `/admin/products`, `/admin/panel-admins`, `/admin/promos`, `/admin/promos/report`, `/admin/partnerships`.

### 2. Teknoloji Yığını

Framework ve ana paketler `package.json` içinde tanımlıdır:

- React `^19.2.0`
- React DOM `^19.2.0`
- Create React App / `react-scripts` `5.0.1`
- TypeScript `^4.9.5`
- React Router DOM `^7.10.0`
- Valtio `^2.3.0`
- i18next `^23.3.0`
- react-i18next `^14.1.3`
- qrcode `^1.5.4`
- uuid `^13.0.0`
- xlsx `^0.18.5`
- Testing Library paketleri mevcut, fakat repository içinde aktif test dosyası bulunamadı.

Routing yapısı `src/App.tsx` içinde `BrowserRouter`, `Routes`, `Route` ve `lazy()` ile kuruludur. Sayfalar code-splitting için lazy import edilir ve `Suspense` altında render edilir.

State management ağırlıklı olarak lokal React state ile yapılır. Sepet state’i istisna olarak `src/client/cart.ts` içinde Valtio `proxy` ile tutulur. Kalıcı küçük veriler, auth token, guest token, dil seçimi ve cart state için `src/utils/persistence.ts` içindeki IndexedDB tabanlı key-value helper’ları kullanılır.

UI/component library olarak ayrı bir hazır component framework kullanılmıyor. Font Awesome CSS CDN üzerinden `public/index.html` içinde eklenmiş. UI, proje içindeki plain React componentleri ve CSS dosyalarıyla kurulmuş.

Styling yaklaşımı plain CSS’tir:

- Global CSS: `src/index.css`, `src/App.css`
- Eski/common component CSS: `src/styles/`
- V2 component ve page CSS: `src/v2-styles/`
- Public header/footer CSS: `public/assets/header/`, `public/assets/footer/`

API client yaklaşımı:

- `src/client/core.ts` ortak fetch wrapper’dır.
- `src/client/postgrest.ts` PostgREST istekleri için `pgREST` ve `pgErr` helper’larını sağlar.
- Domain client dosyaları `src/client/` altında tutulur: `auth.ts`, `uploads.ts`, `cart.ts`, `admin.ts`, `admin-products.ts`, `promo.ts`, `partnership.ts`, `advertorial.ts`, `features.ts`, `event-storage.ts`, `meta-pixel.ts`.

Form yaklaşımı çoğunlukla uncontrolled input’lardır. Submit sırasında `src/utils/form_event_parse.ts` ile form verisi okunur veya bazı formlarda `document.querySelector` ile input değeri alınır.

Validation:

- Frontend tarafında çoğunlukla HTML `required`, basit email/password kontrolleri, checkout için gerekli alan kontrolleri ve backend response hata mesajları kullanılır.
- Merkezi schema validation kütüphanesi repository içinde tanımlı değil.

Auth:

- JWT token backend tarafından `X-Auth-Token` response header’ında döner.
- Frontend token’ı IndexedDB’ye kaydeder.
- Sonraki isteklerde `Authorization: Bearer <token>` header’ı eklenir.

i18n:

- `src/packages/i18n.ts` i18next kurulumunu yapar.
- Desteklenen diller repository içinde `en` ve `uk` olarak görülüyor.
- Dil JSON dosyaları `public/assets/lang/en.json` ve `public/assets/lang/uk.json` kaynaklarından, production’da S3 `S3_ROOT + "/ui/assets/lang/..."` üzerinden yüklenir.

Analytics:

- Meta Pixel entegrasyonu `src/client/meta-pixel.ts` içindedir.
- `PageView`, `AddToCart`, `CompleteRegistration`, `Purchase` eventleri desteklenir.
- Pixel ID `src/consts.ts` içinde hardcoded olarak tanımlıdır.

Payment:

- Checkout submit’i `POST ${SERV_ROOT}/api/purchase` endpoint’ine gider.
- Backend `liqpay_form` dönerse frontend dinamik form oluşturup `https://www.liqpay.ua/api/3/checkout` adresine POST eder.
- Ödeme sonrası `/checkout/pending/:encPackedUID` backend purchase status endpoint’ini poll eder.

Upload:

- `src/client/uploads.ts` presigned URL akışı kullanır.
- Frontend önce backend’den upload URL’leri alır, sonra dosyaları doğrudan S3/presigned URL’ye `PUT` eder.

### 3. Kök Proje Yapısı

Önemli root dosya ve klasörler:

- `package.json`: npm scriptleri, runtime ve dev dependency listesi.
- `package-lock.json`: npm lock dosyası.
- `tsconfig.json`: TypeScript ayarları. `strict: true`, `jsx: react-jsx`, `include: ["src"]`.
- `public/`: CRA public assetleri, HTML template, header/footer assetleri ve dil JSON dosyaları.
- `src/`: uygulama kaynak kodu.
- `deploy/`: manuel deployment scripti ve deployment env dosyası.
- `postbuild.js`: `npm run build` sonrası build artifact hashlerini değiştirir, sourcemap/license/asset manifest gibi çıktıları temizler.
- `make-wordpress-components.js`: `public/index.html` içinden header/footer HTML parçalarını çıkarıp `wordpress-components/` altına yazar.
- `wordpress-components/`: WordPress tarafında kullanılmak üzere üretilmiş header/footer parçaları.
- `project-docs/`: ürün/page/backend notları. `project-docs/backend-docs/readme.txt` backend entegrasyon özetini içerir.
- `.taskmaster/`: Taskmaster proje dosyaları.
- `.cursor/`: Cursor kuralları ve proje ayarları.
- `build/`: CRA production build çıktısı. Git ignore kapsamındadır.
- `.env`: repository içinde gitignored yerel env dosyası. Frontend CRA runtime config için kullanılmıyor; mevcut içerik Taskmaster/AI API key niteliğinde secret değerler içeriyor.
- `membox-servs-key.pem`: private key dosyası; `.gitignore` `*.pem` dosyalarını ignore ediyor.

`src/` altındaki ana klasörler:

- `src/pages/`: route karşılığı page componentleri.
- `src/components/`: daha eski/ortak küçük componentler (`Button`, `FileInput`, `Footer`, `Mockup2`).
- `src/v2-components/`: yeni UI componentleri, guard’lar, layout parçaları, admin/header/footer/toast/gallery componentleri.
- `src/v2-partials/`: page-level partial’lar ve büyük ekran blokları (`EventDetailLayout`, `V2Checkout`, `V2EventNew`, guest ekranları).
- `src/partials/`: eski veya feature özel partial’lar (`EventHomeContent`, `PhotoViewerModal`, `PasswordRecoveryForm`, addon modal/box).
- `src/client/`: backend/API entegrasyon dosyaları.
- `src/types/`: domain tipleri.
- `src/utils/`: persistence, form parse, download, feature helper, guest error helper gibi yardımcılar.
- `src/packages/`: küçük internal paketler (`i18n`, `uuid`, `audio`).
- `src/styles/`: eski/common CSS dosyaları.
- `src/v2-styles/`: V2 component/page CSS dosyaları.
- `src/printables/`: yazdırılabilir poster/golden-hour çıktıları.
- `src/temp-ai-logic-and-data/`: mock/stub amaçlı geçici data/helper dosyaları.

Repository içinde `app/`, `lib/`, `hooks/`, `services/`, `assets/` isimli standart frontend klasörleri root veya `src` altında açıkça tanımlı değil. Assetlerin çoğu `public/assets/` altında, service/client katmanı ise `src/client/` altında tutuluyor.

### 4. Uygulama Başlangıç Akışı

Entry point `src/index.tsx` dosyasıdır:

1. React ve ReactDOM import edilir.
2. `src/index.css` ve `src/App.css` yüklenir.
3. `document.getElementById("root")` bulunur.
4. `ReactDOM.createRoot(rootElement)` ile root oluşturulur.
5. `<React.StrictMode><App /></React.StrictMode>` render edilir.

HTML template `public/index.html` içindedir. React root `<div id="root"></div>` içine mount edilir. Aynı dosyada public header ve footer markup’ı da yer alır. Header/footer için `public/assets/hfSetup.js`, header/footer CSS dosyaları ve Font Awesome CDN linkleri yüklenir.

Router `src/App.tsx` içinde kuruludur:

- `BrowserRouter` uygulamayı sarar.
- `ScrollToTop` route değişimlerinde sayfayı en üste alır.
- `RouteChangeEmitter` route değişimlerinde `trackMetaPageView()` çağırır ve global `routechange` event’i dispatch eder.
- Page componentleri `lazy()` ile import edilir.
- `V2Toast` router dışında, uygulama seviyesinde render edilir.

Global provider olarak React Query, Redux, theme provider veya auth context repository içinde bulunmuyor. Auth kontrolü context yerine route guard componentleri ve client helper’ları ile yapılıyor.

i18n bootstrap:

- `src/App.tsx`, `i18n.isInitialized` durumunu bekler.
- `src/packages/i18n.ts` import edildiğinde async init başlar.
- Öncelik sırası: URL `?lang=`, IndexedDB `lang_setting`, tarayıcı dili, fallback `en`.
- Geçerli `?lang=` parametresi varsa dil kaydedilir, URL’den parametre silinerek `window.location.replace` yapılır.
- Dil değişimi `change_lang()` ile IndexedDB’ye yazılır ve sayfa reload edilir.

Auth/bootstrap:

- Genel uygulama açılışında merkezi bir `whoami` bootstrap yok.
- Korumalı host event route’ları render olmadan önce `RequireAuth` içinde `whoAmI()` çağrılır.
- Admin route’larında `AdminRouteGuard` `getAdminRole()` ile `/api/admin/check` kontrolü yapar.
- Guest sayfalarında `whoAmI()` guest endpoint’i üzerinden guest identity/token akışını tetikler.

### 5. Sayfa ve Route Yapısı

Route listesi `src/App.tsx` içindedir.

Public / auth / satın alma route’ları:

- `/signin`: email/password login ekranı.
- `/signout`: token temizleme ve çıkış.
- `/recover`: password reset request ekranı.
- `/reset-password/:token`: password reset confirm ekranı.
- `/signup/:token`: token bazlı signup veya mevcut hesaba attach akışı.
- `/events/services-and-prices`: ürün/paket seçimi ve get-started landing akışı.
- `/checkout`: cart ve LiqPay ödeme başlatma ekranı.
- `/checkout/pending/:encPackedUID`: ödeme status polling ekranı.
- `/payment/:token`: placeholder olarak boş element render ediyor.
- `/notice/*`: mesaj/success/failure ekranı.

Host / event owner route’ları, `RequireAuth` ile korunur:

- `/event/:uid`: event dashboard/home.
- `/event/:uid/gallery`: fotoğraf/video galerisi.
- `/event/:uid/guestbook`: voice/text guestbook kayıtları.
- `/event/:uid/trash`: trashed medya.
- `/event/:uid/collaborators`: event admin/collaborator yönetimi.
- `/event/:uid/settings`: genel event ayarları.
- `/event/:uid/theme`: guest page theme ayarları.
- `/event/:uid/qr`: QR ayarları/preview.
- `/event/:uid/poster`: poster/golden-hour çıktıları.

Guest route’ları:

- `/guest/:uid`: public guest home, event bilgisi ve upload entry.
- `/guest/:uid/uploads`: guest’in kendi upload listesi.
- `/guest/:uid/guestbook`: text/voice guestbook ekranı.

Navigation/redirect route:

- `/events`: login/admin/event durumuna göre yönlendirir. Admin ise `/admin/orders`, event yoksa `/events/services-and-prices`, event varsa ilk aktif event `/event/:packedUid`.

Admin route’ları:

- `/admin/orders`: admin/order admin sipariş listesi.
- `/admin/orders/:uid`: sipariş detayı.
- `/admin/products`: super admin ürün yönetimi.
- `/admin/panel-admins`: super admin panel admin yönetimi.
- `/admin/promos`: super admin promo yönetimi.
- `/admin/promos/report`: super admin promo kullanım raporu.
- `/admin/partnerships`: super admin partnerlik yönetimi.
- `/admin/no-access`: özel admin access denied ekranı.

Development-only route:

- `/api/*`: yalnızca `is_live === false` iken tanımlanır. `src/pages/api.tsx` current path’i `SERV_ROOT + window.location.pathname` adresine redirect eder.

Dynamic route parametreleri:

- `:uid`: genelde packed UUID formatında event veya order id temsil eder.
- `:token`: signup/reset/payment tokenlarını temsil eder.
- `:encPackedUID`: ödeme pending status için backend’in beklediği encoded packed purchase/event identifier.

Catch-all:

- Production/live ortamda `path="*"` `NotFound` render eder.
- Development ortamında catch-all route tanımlı değil; sadece `/api/*` dev helper aktiftir.

### 6. Component Yapısı

Ortak componentler:

- `src/components/`: küçük, eski veya genel componentler. Örnekler: `Button`, `FileInput`, `Footer`, `Mockup2`.
- `src/v2-components/`: güncel UI componentleri. Örnekler: `V2Header`, `V2Footer`, `Footer`, `V2Toast`, `EmptyState`, `MediaCard`, `GalleryFilterBar`, `QRPreviewCard`, `FeatureGate`, `AdminPageHeader`, `AdminRouteGuard`, `RequireAuth`, `PurchasedAddonsBox`, `AdvertorialSettings`, `ThemeCustomizer`, `BuyerConfigPanel`.

Feature/page partial’ları:

- `src/v2-partials/EventDetailLayout.tsx`: event owner sayfalarının ortak layout’u; header, event navigator, mobile nav, footer ve extend storage modal içerir.
- `src/v2-partials/EventNavigator.tsx`: event sidebar/navigation.
- `src/partials/EventHomeContent.tsx`: event owner dashboard/home içeriği.
- `src/v2-partials/V2EventNew.tsx`: services/prices ve ürün seçimi akışı.
- `src/v2-partials/V2Checkout.tsx`: checkout, promo, shipping address, buyer configs ve LiqPay form submit akışı.
- `src/v2-partials/V2GuestHome.tsx`: public guest event home ve upload entry.
- `src/v2-partials/V2ParticipantUploads.tsx`: guest upload listesi.
- `src/v2-partials/V2GuestGuestbook.tsx`: guestbook UI.
- `src/v2-partials/V2GuestGate.tsx`: event henüz başlamadı/bitti gibi guest gate ekranları.
- `src/v2-partials/V2ExtendStorageModal.tsx`: event storage uzatma modalı.
- `src/v2-partials/notice.tsx`: generic notice/success/failure ekranı.

Layout/header/footer:

- React içinde `V2Header`, `V2Footer`, `Footer` componentleri kullanılır.
- `public/index.html` içinde ayrıca static header/footer markup bulunur. `make-wordpress-components.js` bu markup’ı WordPress componentleri için çıkarır.

Modal/gallery/upload:

- `src/partials/PhotoViewerModal.tsx`: medya görüntüleme modalı.
- `src/partials/AddonModal.tsx`: add-on detay modalı.
- `src/v2-components/MediaCard.tsx`: galeri medya kartı.
- `src/components/FileInput.tsx` ve guest partial’ları dosya seçme/yükleme akışında kullanılır.
- Upload API helper’ları `src/client/uploads.ts` içinde.

Admin componentleri:

- `AdminRouteGuard`, `AdminPageHeader`, admin page CSS ve admin client dosyaları admin modülünü oluşturur.
- Admin page componentleri `src/pages/admin/` altındadır.

### 7. API ve Backend Entegrasyonu

API base URL’leri `src/consts.ts` içinde hardcoded olarak tanımlıdır:

- `DB_ROOT = "https://db.addmoments.com.ua"`
- `SERV_ROOT = is_live ? "https://serv.addmoments.com.ua" : "http://127.0.0.1:8083"`
- `SITE_ROOT = is_live ? "https://addmoments.com.ua" : "http://127.0.0.1:3000"`
- `S3_ROOT = "https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com"`
- `META_PIXEL_ID = "..."`

`is_live`, hostname `localhost` veya `127.0.0.1` içermiyorsa true olur. Bu nedenle staging gibi localhost olmayan tüm hostlar production endpointlerine gider.

Request helper:

- `src/client/core.ts` içindeki `fetch` wrapper:
  - IndexedDB’den token okur.
  - `Authorization: Bearer <token>` header’ı ekler.
  - Guest route’larında `X-Event` header’ı ekler.
  - Non-OK response için `FetchHttpError` throw eder.
  - Response header `X-Auth-Token` varsa token’ı IndexedDB’ye kaydeder.
  - `201` response body `goto:` ile başlıyorsa, redirect’i otomatik uygular.

PostgREST helper:

- `src/client/postgrest.ts` içindeki `pgREST(query, options, root?)` `${DB_ROOT}${query}` adresine istek atar.
- JSON gibi başlayan response text parse edilir.
- `pgErr` helper’ı `{res, err}` formatı döner.

Auth token taşıma:

- Login/signup response’unda gelen JWT `X-Auth-Token` header’ından alınır.
- Normal kullanıcı token’ı `tkn` key’iyle IndexedDB’ye yazılır.
- Guest token için storage key, mevcut route’un `/guest/:uid` packed event uid değeridir.
- Header formatı `Authorization: Bearer <token>`.

Error handling:

- Core fetch non-OK response’u text olarak okur, JSON parse deneyip `FetchHttpError` oluşturur.
- Page/partial seviyesinde hatalar çoğunlukla `alert`, redirect, local message state veya özel error screen ile gösterilir.
- Guest init sırasında package limit ve event closed hataları `src/utils/guestInitError.ts` üzerinden özel ekrana çevrilir.

Ana backend entegrasyonları:

- Auth:
  - `POST /auth/signin/email`
  - `GET /auth/signup/email/:token`
  - `POST /auth/signup/email/:token`
  - `POST /auth/signup/email/:token/attach`
  - `POST /auth/password-reset/request`
  - `POST /auth/password-reset/confirm`
  - `GET /auth/whoami`
  - `GET /api/guest/whoami`
- PostgREST:
  - `/events`, `/events_public`
  - `/uploads`
  - `/participants`
  - `/users`
  - `/rpc/current_user_uid`
- Upload:
  - `POST /api/upload/event_image`
  - `POST /api/upload/qr_logo`
  - `POST /api/guest/upload/:eventPackedUid/:utype`
- Products/cart/payment:
  - `GET /api/products`
  - `POST /api/purchase`
  - `GET /api/purchase/:encPackedUID/status`
  - Dev-only `POST /api/purchase/:encPackedUID/simulate-success`
- Admin:
  - `GET /api/admin/check`
  - `/api/admin/panel-admins`
  - `/api/admin/products`
  - `/api/admin/promos`
  - `/api/admin/promos/report`
  - `/api/admin/partnerships`
- Event feature/storage/advertorial:
  - `/api/event/:packedUid/features`
  - `/api/event/:packedUid/public-features`
  - `/api/event/:packedUid/extend-storage`
  - `/api/event/:packedUid/advertorial`
  - `/api/event/:packedUid/advertorial-public`
  - `/api/event/:packedUid/advertorial/upload-url`

Backend dokümanına göre backend Go server + PostgREST + S3 presigned upload modelindedir. Frontend bu modele doğrudan bağlıdır.

### 8. Auth ve Yetkilendirme

Login:

- `/signin` sayfası `V2SignInForm` render eder.
- Form submit `signInEmail({ email, password }, { blockRedirects: true })` çağırır.
- Backend token’ı `X-Auth-Token` ile döner.
- Frontend token’ı IndexedDB `tkn` key’iyle saklar.
- Redirect hedefi `resolvePostSignInRedirect()` ile admin rolü ve `?next=` parametresine göre belirlenir.
- `safeNext()` sadece same-origin relative path kabul eder; external URL open redirect engellenir.

Signup:

- `/signup/:token` token bazlı signup/attach akışı için kullanılır.
- Backend token info endpoint’i ile token geçerliliği ve email durumları kontrol edilir.
- Kayıt başarılı olduğunda backend yine token header ve/veya goto davranışı sağlayabilir.

Logout:

- `logout()` `tkn` key’ini IndexedDB’den siler ve `/` adresine yönlendirir.
- `/signout` sayfası bu akışı tetikler.

Session/token storage:

- Storage IndexedDB’dir.
- DB adı `storageDB`, object store `keyValueStore`, key prefix `lsg`.
- Normal auth token key’i `lsgtkn`.
- Guest token key’i packed event UID’ye göre `lsg<packedEventUid>`.

Protected route mantığı:

- Host event route’ları `RequireAuth` ile korunur.
- `RequireAuth`, `whoAmI()` çağrısı başarılı olana kadar null render eder.
- Başarısız olursa `/signin?next=<encoded current path+search+hash>` yönlendirmesi yapar.

Admin yetkilendirme:

- `AdminRouteGuard`, `getAdminRole()` ile `GET /api/admin/check` çağırır.
- `requireSuperAdmin` false ise `role.is_admin`, true ise `role.is_super_admin` gerekir.
- Admin rolü kısa süreli memory cache ile tutulur (`60s` TTL).
- Role shape: `is_admin`, `is_super_admin`, `is_order_admin`, `was_panel_admin`, `has_active_event`.
- Bazı login redirect kararları admin olmayan eski panel admin kullanıcıları için `/admin/no-access` özel durumunu kullanır.

Rol bazlı erişim:

- Order admin: admin sipariş ekranlarına girebilir.
- Super admin: products, panel admins, promos, promo report, partnerships gibi yönetim ekranlarına girebilir.
- Kesin backend enforcement repository içinde frontend kodundan doğrulanamaz; frontend guard sadece UI/route seviyesidir.

### 9. Konfigürasyon ve Environment Variables

Bu frontend uygulamada CRA’nın `REACT_APP_*` environment variable modeli kullanılmıyor. Runtime endpointler ve public değerler `src/consts.ts` içinde hardcoded.

Repository içinde bulunan env dosyaları:

- `.env`: gitignored. Mevcut içerik frontend runtime config değil; Taskmaster/AI API key niteliğinde secret değerler içeriyor.
- `deploy/.env`: deploy script tarafından `source` edilir. AWS ve FTP credentials içerir.

`.gitignore` şu env dosyalarını ignore ediyor:

- `.env`
- `.env.local`
- `.env.development.local`
- `.env.test.local`
- `.env.production.local`

Önemli frontend config sabitleri:

```env
# src/consts.ts içinde hardcoded, CRA env değil
DB_ROOT=https://db.addmoments.com.ua
SERV_ROOT=https://serv.addmoments.com.ua
SERV_ROOT_LOCAL=http://127.0.0.1:8083
SITE_ROOT=https://addmoments.com.ua
SITE_ROOT_LOCAL=http://127.0.0.1:3000
S3_ROOT=https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com
META_PIXEL_ID=<public-meta-pixel-id>
PUBLIC_URL=https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/ui
```

Deploy env değişkenleri:

```env
AWS_ACCESS_KEY_ID=<secret>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_DEFAULT_REGION=eu-north-1
AWS_BUCKET=memboxpub-qo1gff2e
FTP_HOST=<host>
FTP_USERNAME=<secret>
FTP_PASSWORD=<secret>
```

Secret kabul edilmesi gerekenler:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- Root `.env` içindeki API key değerleri
- `*.pem` private key dosyaları

Public kabul edilebilecekler:

- `PUBLIC_URL`
- `S3_ROOT` public bucket root’u
- `DB_ROOT`, `SERV_ROOT`, `SITE_ROOT` domainleri
- `META_PIXEL_ID` teknik olarak public client config içinde görünür, fakat değişiklik ve erişim yönetimi operasyonel olarak dikkat ister.

Yeni env değişkeni eklenecekse şu an repository içinde bunun merkezi bir schema/documentation dosyası yok. CRA ortam değişkeni kullanılacaksa `REACT_APP_` prefix’i gerekir; fakat mevcut kod pattern’i sabitleri `src/consts.ts` içinde tutuyor.

### 10. Build, Test ve Kalite Kontrolleri

Npm scriptleri:

```bash
npm start
npm run build
npm test
npm run deploy
npm run eject
```

Local development:

- `npm install`
- `npm start`
- CRA dev server varsayılan olarak `http://localhost:3000` üzerinde çalışır.
- Local frontend, `src/consts.ts` nedeniyle backend için `http://127.0.0.1:8083` adresini kullanır.

Build:

- `npm run build`
- Script şu komutu çalıştırır:

```bash
PUBLIC_URL=https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/ui react-scripts build && node postbuild.js
```

- Build output `build/` klasörüne üretilir.
- `postbuild.js` static css/js hashlerini kısa random stringlerle değiştirir, `.map`, `.LICENSE.txt` ve `asset-manifest.json` dosyalarını siler.

Preview/start:

- Repository içinde production preview için ayrı bir `preview` veya `serve` script’i yok.
- CRA `npm start` development içindir.

Test:

- `npm test` `react-scripts test` çalıştırır.
- Repository içinde `.test`/`.spec` dosyası veya açık test coverage setup’ı bulunamadı.

Lint/format/typecheck:

- `eslintConfig` `react-app` ve `react-app/jest` extend eder.
- Ayrı `lint`, `format` veya `typecheck` npm script’i tanımlı değil.
- TypeScript check CRA build sürecinde çalışır.
- Prettier config repository içinde açıkça bulunamadı.

CI:

- `.github/workflows` bulunamadı.
- Repository içinde CI/CD pipeline tanımı açıkça yok.

### 11. Deployment

Deployment modeli repository içinde `deploy/deploy.sh`, `package.json` ve `postbuild.js` üzerinden görülebiliyor.

Platform/model:

- Static frontend build dosyaları AWS S3 bucket altındaki `/ui` prefix’ine deploy edilir.
- `index.html` ayrıca FTP ile `ftp.addmoments.com.ua/public_html/reactApp.html` yoluna upload edilir.
- Bu yapı, static assetlerin S3’den, ana React app HTML girişinin ise WordPress veya custom hosting tarafındaki `reactApp.html` üzerinden kullanıldığını düşündürür. Repository içinde bu yorumun ötesinde tam hosting/topology dokümanı yok.

Deploy dosyaları:

- `deploy/deploy.sh`
- `deploy/.env`
- `postbuild.js`
- `package.json` build/deploy scriptleri

Manual deploy akışı:

```bash
npm run build
npm run deploy
```

`npm run deploy` şu scripti çalıştırır:

1. `deploy/.env` dosyasını source eder.
2. `BUILD_DIR="../build"` olarak ayarlar.
3. `build/` altında `.DS_Store` dosyalarını siler.
4. `aws s3 sync "$BUILD_DIR" "s3://$AWS_BUCKET/ui" --delete` ile S3’e sync eder.
5. `curl --user "$FTP_USERNAME:$FTP_PASSWORD" -T "$BUILD_DIR/index.html" "ftp://$FTP_HOST/public_html/reactApp.html"` ile HTML dosyasını FTP’ye yollar.

Auto-deploy:

- Repository içinde main branch push sonrası otomatik deploy tanımı bulunamadı.
- `.github/workflows`, Dockerfile, Netlify/Vercel config dosyası bulunamadı.
- Bu nedenle deployment manuel script tabanlı görünür.

Build output:

- `build/`
- Production asset URL base’i `PUBLIC_URL=https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/ui`.

Production env yönetimi:

- Deploy credentials `deploy/.env` içinde.
- Frontend runtime endpointleri `src/consts.ts` içinde hardcoded.
- AWS/FTP secret değerleri repository içinde commit edilmemeli; `.gitignore` root `.env` için açık, fakat `deploy/.env` ignore kapsamı dosya adına göre root `.env` pattern’iyle her zaman garanti edilmeyebilir. Bu dosyanın git durumunu ayrıca takip etmek gerekir.

Rollback/restart:

- Repository içinde rollback script’i yok.
- Static hosting olduğundan restart akışı yok.
- Pratik rollback, önceki `build/` artifactlerini veya önceki commit’i yeniden build/deploy etmek şeklinde olur; bu repository içinde otomatikleştirilmiş değil.

### 12. Güvenlik ve Operasyon Notları

Secret yönetimi:

- Root `.env`, `deploy/.env` ve `*.pem` dosyaları secret kabul edilmeli.
- Bu dosyalar commit edilmemeli ve secret değerleri dokümana, issue’ya veya PR açıklamasına yazılmamalı.
- Mevcut local dosyalarda AWS/FTP/API key nitelikli değerler bulunduğu için rotasyon ihtiyacı operasyonel olarak değerlendirilmelidir.

Public env ve hardcoded config:

- `src/consts.ts` production endpointlerini hardcoded tutar.
- Staging/prod ayrımı hostname `localhost` kontrolüne bağlıdır. Localhost dışındaki test/staging domainleri production backend’e gider.
- `META_PIXEL_ID` client bundle içinde görünür.

CORS/API domain bağımlılıkları:

- Frontend şu domainlere bağlıdır:
  - `https://serv.addmoments.com.ua`
  - `https://db.addmoments.com.ua`
  - `https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com`
  - LiqPay checkout endpoint’i
  - Meta Pixel script endpoint’i
  - Google Fonts / Font Awesome CDN
- Backend ve PostgREST’in frontend originlerine CORS izinleri vermesi gerekir. CORS config repository içinde frontend tarafında tanımlı değil.

Auth güvenliği:

- Token IndexedDB’de saklanır. XSS durumunda token erişimi risktir.
- Protected route guard frontend seviyesindedir; backend endpointleri mutlaka authorization enforcement yapmalıdır.
- `safeNext()` login redirect’inde open redirect riskini azaltır.

Upload güvenliği:

- Dosyalar presigned URL ile doğrudan S3’e yüklenir.
- File type/size/content validation frontendde sınırlı görünür; asıl kontrol backend presign ve storage policy tarafında olmalıdır.
- Guest upload akışında `X-Event` header ve guest token modeli kullanılır; backend event/participant limitlerini enforce etmelidir.

Payment güvenliği:

- Frontend satın alma hesaplarını sadece gösterim için yapar; gerçek purchase ve promo doğrulama backend tarafındadır.
- LiqPay `data` ve `signature` backend’den gelir ve frontend sadece form post eder.
- `/checkout/pending/:encPackedUID` status polling ile success/failure kararını backend’den alır.

Analytics:

- Meta Pixel PageView SPA route değişimlerinde tetiklenir.
- AddToCart ve Purchase eventleri sessionStorage guard ile duplicate azaltır; bu tam idempotency garantisi değildir.

Operasyonel riskler:

- CI/CD yok; deploy manuel ve credential taşıyan local env dosyasına bağlı.
- `postbuild.js` asset hashlerini randomize ettiği için deterministic artifact üretimi zayıflar.
- `aws s3 sync --delete` yanlış bucket/prefix ile çalışırsa production asset kaybına yol açabilir.
- FTP upload başarısız olurken S3 sync başarılı olabilir; scriptte rollback/transaction yok.
- Hardcoded production endpointleri staging ayrımını zorlaştırır.

### 13. Developer Quick Map

Yeni sayfa eklemek:

1. `src/pages/` altında page component oluştur.
2. Büyük UI blok gerekiyorsa `src/v2-partials/` veya feature’a yakın partial klasörünü kullan.
3. Sayfaya özel CSS gerekiyorsa `src/v2-styles/` veya `src/styles/` altında ayrı CSS dosyası oluştur ve component içinde import et.
4. `src/App.tsx` içinde `lazy(() => import(...))` ekle.
5. `Routes` içine route tanımı ekle.
6. Protected route gerekiyorsa host event için `RequireAuth`, admin için `AdminRouteGuard` kullan.
7. Header/sidebar navigation gerekiyorsa ilgili componentte link ekle.

Yeni API entegrasyonu eklemek:

1. Domain client dosyasını `src/client/` altında oluştur veya mevcut dosyaya ekle.
2. Go server endpointleri için `SERV_ROOT`, PostgREST için `pgREST`/`pgErr` kullan.
3. Auth gereken isteklerde `src/client/core.ts` wrapper’ını kullan; doğrudan `window.fetch` sadece presigned URL gibi auth wrapper istemeyen üçüncü taraf upload/checkout çağrılarında kullanılmalı.
4. Response shape için `src/types/` altında tip tanımla.
5. Error handling’i çağıran page/partial seviyesinde kullanıcıya görünür hale getir.

Yeni component ekleme standardı:

- Küçük tekrar kullanılabilir componentler için `src/v2-components/`.
- Page’e özel büyük bloklar için `src/v2-partials/`.
- Eski alanla uyum gerekiyorsa `src/components/` veya `src/partials/` mevcut pattern’e göre kullanılabilir.
- CSS plain dosya olarak component/page yanında mantıksal klasörde tutulur ve import edilir.
- Form inputlarında mevcut proje kuralı gereği uncontrolled input tercih edilir; submit sırasında form verisi okunur.

Yeni env/config değişkeni eklemek:

1. Değer public runtime config ise mevcut pattern’e göre `src/consts.ts` güncellenir veya CRA env modeline geçilecekse `REACT_APP_*` standardı bilinçli şekilde eklenir.
2. Secret ise frontend bundle’a koyma; backend veya deploy ortamında tut.
3. Deploy secret ise `deploy/.env` örneği ve deploy dokümantasyonu güncellenmeli, gerçek değer commit edilmemeli.
4. Bu dokümandaki "Konfigürasyon ve Environment Variables" bölümü güncellenmeli.

Yeni route guard veya auth davranışı eklemek:

- Host event sayfaları için `RequireAuth` pattern’ini takip et.
- Admin sayfaları için `AdminRouteGuard` ve `getAdminRole()` modelini takip et.
- Sadece frontend guard’a güvenme; backend authorization kontratını da doğrula.

Yeni upload akışı eklemek:

- Backend’den presigned URL al.
- `src/client/uploads.ts` içindeki `uploadFiles` pattern’ini kullan.
- S3’ye doğrudan `window.fetch(..., { method: "PUT" })` ile dosyayı gönder.
- DB kaydı gerekiyorsa backend veya PostgREST kontratını netleştir.

Yeni payment/add-on akışı eklemek:

- Cart state için `src/client/cart.ts` Valtio proxy’sini kullan.
- Ürün display/config tiplerini `src/types/products.ts` ve checkout patternleriyle uyumlu tut.
- Gerçek fiyat, promo ve ödeme doğrulamasını backend’e bırak.
- Başarılı ödeme sonrası analytics gerekiyorsa `src/client/meta-pixel.ts` helper’larını kullan.

---

## English

### 1. Project Overview

This repository contains the React frontend for the **Add Moments** product. The app lets event owners create digital event albums, collect photos/videos/voice/text entries from guests, share QR/link access, manage event theme/settings, purchase packages and add-ons, and lets admin users manage orders, products, promo codes, and partnerships.

The product domain is media collection for weddings, concerts, parties, and similar events without requiring guests to install an app. Public metadata and header/footer copy position the product as "The easiest way to collect media/photos from your guests."

Main user-facing flows:

- Public purchase flow: choose packages/add-ons on `/events/services-and-prices`, start payment on `/checkout`, redirect to LiqPay, and wait for payment status on `/checkout/pending/:encPackedUID`.
- Auth flow: `/signin`, `/signout`, `/recover`, `/reset-password/:token`, `/signup/:token`.
- Event owner flow: `/events` redirect page, `/event/:uid` and child pages for dashboard, gallery, guestbook, trash, collaborators, settings, theme, QR, and poster management.
- Guest flow: `/guest/:uid`, `/guest/:uid/uploads`, `/guest/:uid/guestbook`; guests open the event page, upload media, and leave guestbook entries.
- Admin flow: `/admin/orders`, `/admin/orders/:uid`, `/admin/products`, `/admin/panel-admins`, `/admin/promos`, `/admin/promos/report`, `/admin/partnerships`.

### 2. Technology Stack

Main packages are defined in `package.json`:

- React `^19.2.0`
- React DOM `^19.2.0`
- Create React App / `react-scripts` `5.0.1`
- TypeScript `^4.9.5`
- React Router DOM `^7.10.0`
- Valtio `^2.3.0`
- i18next `^23.3.0`
- react-i18next `^14.1.3`
- qrcode `^1.5.4`
- uuid `^13.0.0`
- xlsx `^0.18.5`
- Testing Library packages are installed, but no active test files were found in the repository.

Routing is configured in `src/App.tsx` with `BrowserRouter`, `Routes`, `Route`, and `lazy()`. Page components are lazy-loaded and rendered under `Suspense`.

State management is mostly local React state. Cart state is the notable exception and is stored in a Valtio `proxy` in `src/client/cart.ts`. Small persistent values such as auth token, guest token, language selection, and cart state are stored through IndexedDB helpers in `src/utils/persistence.ts`.

There is no external UI component framework. Font Awesome CSS is loaded from CDN in `public/index.html`. UI is built from in-repository React components and plain CSS files.

Styling approach:

- Global CSS: `src/index.css`, `src/App.css`
- Older/common component CSS: `src/styles/`
- V2 component and page CSS: `src/v2-styles/`
- Public header/footer CSS: `public/assets/header/`, `public/assets/footer/`

API client approach:

- `src/client/core.ts` is the shared fetch wrapper.
- `src/client/postgrest.ts` provides `pgREST` and `pgErr` for PostgREST calls.
- Domain client modules live in `src/client/`: `auth.ts`, `uploads.ts`, `cart.ts`, `admin.ts`, `admin-products.ts`, `promo.ts`, `partnership.ts`, `advertorial.ts`, `features.ts`, `event-storage.ts`, `meta-pixel.ts`.

Forms mostly use uncontrolled inputs. Submit handlers read form data via `src/utils/form_event_parse.ts` or, in a few places, `document.querySelector`.

Validation:

- Frontend validation is mostly HTML `required`, basic field checks, checkout-specific required field checks, and backend response messages.
- No central schema validation library is defined.

Auth:

- The backend returns JWTs in the `X-Auth-Token` response header.
- The frontend stores the token in IndexedDB.
- Later requests send `Authorization: Bearer <token>`.

i18n:

- `src/packages/i18n.ts` initializes i18next.
- Supported languages seen in the repo are `en` and `uk`.
- Language JSON files live in `public/assets/lang/en.json` and `public/assets/lang/uk.json`; production loads them from `S3_ROOT + "/ui/assets/lang/..."`.

Analytics:

- Meta Pixel integration lives in `src/client/meta-pixel.ts`.
- Supported events include `PageView`, `AddToCart`, `CompleteRegistration`, and `Purchase`.
- Pixel ID is hardcoded in `src/consts.ts`.

Payment:

- Checkout submits to `POST ${SERV_ROOT}/api/purchase`.
- If the backend returns `liqpay_form`, the frontend creates a dynamic form and posts it to `https://www.liqpay.ua/api/3/checkout`.
- After payment, `/checkout/pending/:encPackedUID` polls the backend purchase status endpoint.

Upload:

- `src/client/uploads.ts` uses a presigned URL flow.
- The frontend first requests upload URLs from the backend, then uploads files directly to S3/presigned URLs with `PUT`.

### 3. Root Project Structure

Important root files and folders:

- `package.json`: npm scripts and dependencies.
- `package-lock.json`: npm lockfile.
- `tsconfig.json`: TypeScript configuration. `strict: true`, `jsx: react-jsx`, `include: ["src"]`.
- `public/`: CRA public assets, HTML template, header/footer assets, and language JSON files.
- `src/`: application source code.
- `deploy/`: manual deployment script and deployment env file.
- `postbuild.js`: post-build artifact mutation and cleanup script.
- `make-wordpress-components.js`: extracts header/footer HTML from `public/index.html` into `wordpress-components/`.
- `wordpress-components/`: generated header/footer snippets for WordPress.
- `project-docs/`: product/page/backend notes. `project-docs/backend-docs/readme.txt` contains backend integration notes.
- `.taskmaster/`: Taskmaster project files.
- `.cursor/`: Cursor project rules and settings.
- `build/`: CRA production build output. It is gitignored.
- `.env`: gitignored local env file. It is not used as CRA runtime frontend config; current contents are Taskmaster/AI API key secrets.
- `membox-servs-key.pem`: private key file; `.gitignore` ignores `*.pem`.

Main `src/` folders:

- `src/pages/`: route-level page components.
- `src/components/`: older/shared small components (`Button`, `FileInput`, `Footer`, `Mockup2`).
- `src/v2-components/`: newer UI components, guards, layout pieces, admin/header/footer/toast/gallery components.
- `src/v2-partials/`: page-level partials and larger screen sections (`EventDetailLayout`, `V2Checkout`, `V2EventNew`, guest screens).
- `src/partials/`: older or feature-specific partials (`EventHomeContent`, `PhotoViewerModal`, `PasswordRecoveryForm`, addon modal/box).
- `src/client/`: backend/API integration modules.
- `src/types/`: domain types.
- `src/utils/`: persistence, form parsing, download, feature helpers, guest error helpers.
- `src/packages/`: small internal packages (`i18n`, `uuid`, `audio`).
- `src/styles/`: older/common CSS files.
- `src/v2-styles/`: V2 component/page CSS files.
- `src/printables/`: printable poster/golden-hour outputs.
- `src/temp-ai-logic-and-data/`: temporary mock/stub data and helpers.

Standard folders named `app/`, `lib/`, `hooks/`, `services/`, or `assets/` are not explicitly present at root or under `src`. Assets mostly live in `public/assets/`; the service/client layer is `src/client/`.

### 4. Application Startup Flow

The entry point is `src/index.tsx`:

1. React and ReactDOM are imported.
2. `src/index.css` and `src/App.css` are loaded.
3. `document.getElementById("root")` is resolved.
4. `ReactDOM.createRoot(rootElement)` creates the React root.
5. `<React.StrictMode><App /></React.StrictMode>` is rendered.

The HTML template is `public/index.html`. React mounts into `<div id="root"></div>`. The same file also includes static public header/footer markup, `public/assets/hfSetup.js`, header/footer CSS, and Font Awesome CDN links.

Router setup is in `src/App.tsx`:

- `BrowserRouter` wraps the app.
- `ScrollToTop` scrolls to the top on route changes.
- `RouteChangeEmitter` sends `trackMetaPageView()` and dispatches a global `routechange` event on route changes.
- Page components are imported with `lazy()`.
- `V2Toast` is rendered at app level outside the route switch.

There is no React Query, Redux, theme provider, or auth context in the repository. Auth is handled by route guard components and client helpers.

i18n bootstrap:

- `src/App.tsx` waits for `i18n.isInitialized`.
- Importing `src/packages/i18n.ts` starts async initialization.
- Priority order: URL `?lang=`, IndexedDB `lang_setting`, browser language, fallback `en`.
- A valid `?lang=` value is persisted, removed from the URL, and the page is replaced.
- `change_lang()` writes the selected language to IndexedDB and reloads the page.

Auth/bootstrap:

- There is no single app-wide `whoami` bootstrap.
- Protected event owner routes call `whoAmI()` inside `RequireAuth` before rendering.
- Admin routes call `/api/admin/check` through `AdminRouteGuard`.
- Guest pages call `whoAmI()` through the guest endpoint and token model.

### 5. Pages and Routes

Routes are defined in `src/App.tsx`.

Public / auth / purchase routes:

- `/signin`: email/password login page.
- `/signout`: clears token and signs out.
- `/recover`: password reset request page.
- `/reset-password/:token`: password reset confirmation page.
- `/signup/:token`: token-based signup or attach flow.
- `/events/services-and-prices`: package/product selection and get-started flow.
- `/checkout`: cart and LiqPay payment start page.
- `/checkout/pending/:encPackedUID`: payment status polling page.
- `/payment/:token`: placeholder empty element.
- `/notice/*`: message/success/failure page.

Event owner routes, protected by `RequireAuth`:

- `/event/:uid`: event dashboard/home.
- `/event/:uid/gallery`: photo/video gallery.
- `/event/:uid/guestbook`: voice/text guestbook entries.
- `/event/:uid/trash`: trashed media.
- `/event/:uid/collaborators`: event admin/collaborator management.
- `/event/:uid/settings`: general event settings.
- `/event/:uid/theme`: guest page theme settings.
- `/event/:uid/qr`: QR settings/preview.
- `/event/:uid/poster`: poster/golden-hour output.

Guest routes:

- `/guest/:uid`: public guest home and upload entry.
- `/guest/:uid/uploads`: guest’s own upload list.
- `/guest/:uid/guestbook`: text/voice guestbook page.

Navigation/redirect route:

- `/events`: redirects based on login/admin/event state. Admin users go to `/admin/orders`; users with no event go to `/events/services-and-prices`; users with events go to the first active event `/event/:packedUid`.

Admin routes:

- `/admin/orders`: admin/order admin order list.
- `/admin/orders/:uid`: order detail.
- `/admin/products`: super admin product management.
- `/admin/panel-admins`: super admin panel admin management.
- `/admin/promos`: super admin promo management.
- `/admin/promos/report`: super admin promo usage report.
- `/admin/partnerships`: super admin partnership management.
- `/admin/no-access`: special admin access denied screen.

Development-only route:

- `/api/*`: only defined when `is_live === false`. `src/pages/api.tsx` redirects the current path to `SERV_ROOT + window.location.pathname`.

Dynamic route parameters:

- `:uid`: usually a packed UUID representing event or order id.
- `:token`: signup/reset/payment token.
- `:encPackedUID`: encoded packed identifier expected by the backend for payment pending status.

Catch-all:

- In live/production, `path="*"` renders `NotFound`.
- In development, no catch-all route is defined; only `/api/*` dev helper is active.

### 6. Component Structure

Shared components:

- `src/components/`: small older/general components such as `Button`, `FileInput`, `Footer`, `Mockup2`.
- `src/v2-components/`: current UI components such as `V2Header`, `V2Footer`, `Footer`, `V2Toast`, `EmptyState`, `MediaCard`, `GalleryFilterBar`, `QRPreviewCard`, `FeatureGate`, `AdminPageHeader`, `AdminRouteGuard`, `RequireAuth`, `PurchasedAddonsBox`, `AdvertorialSettings`, `ThemeCustomizer`, `BuyerConfigPanel`.

Feature/page partials:

- `src/v2-partials/EventDetailLayout.tsx`: shared layout for event owner pages with header, event navigator, mobile nav, footer, and extend storage modal.
- `src/v2-partials/EventNavigator.tsx`: event sidebar/navigation.
- `src/partials/EventHomeContent.tsx`: event owner dashboard/home content.
- `src/v2-partials/V2EventNew.tsx`: services/prices and product selection flow.
- `src/v2-partials/V2Checkout.tsx`: checkout, promo, shipping address, buyer configs, and LiqPay form submit flow.
- `src/v2-partials/V2GuestHome.tsx`: public guest event home and upload entry.
- `src/v2-partials/V2ParticipantUploads.tsx`: guest upload list.
- `src/v2-partials/V2GuestGuestbook.tsx`: guestbook UI.
- `src/v2-partials/V2GuestGate.tsx`: guest gates for not-started/ended events.
- `src/v2-partials/V2ExtendStorageModal.tsx`: event storage extension modal.
- `src/v2-partials/notice.tsx`: generic notice/success/failure screen.

Layout/header/footer:

- React pages use `V2Header`, `V2Footer`, and `Footer`.
- `public/index.html` also contains static header/footer markup. `make-wordpress-components.js` extracts this markup for WordPress.

Modal/gallery/upload:

- `src/partials/PhotoViewerModal.tsx`: media viewer modal.
- `src/partials/AddonModal.tsx`: add-on detail modal.
- `src/v2-components/MediaCard.tsx`: gallery media card.
- `src/components/FileInput.tsx` and guest partials participate in file selection/upload flows.
- Upload API helpers live in `src/client/uploads.ts`.

Admin components:

- `AdminRouteGuard`, `AdminPageHeader`, admin page CSS, and admin client modules form the admin area.
- Admin page components live under `src/pages/admin/`.

### 7. API and Backend Integration

API base URLs are hardcoded in `src/consts.ts`:

- `DB_ROOT = "https://db.addmoments.com.ua"`
- `SERV_ROOT = is_live ? "https://serv.addmoments.com.ua" : "http://127.0.0.1:8083"`
- `SITE_ROOT = is_live ? "https://addmoments.com.ua" : "http://127.0.0.1:3000"`
- `S3_ROOT = "https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com"`
- `META_PIXEL_ID = "..."`

`is_live` is true when the hostname does not include `localhost` or `127.0.0.1`. As a result, any non-localhost staging/test host will use production endpoints.

Request helper:

- `src/client/core.ts` exports the shared `fetch` wrapper:
  - Reads token from IndexedDB.
  - Adds `Authorization: Bearer <token>`.
  - Adds `X-Event` on guest routes.
  - Throws `FetchHttpError` for non-OK responses.
  - Stores response `X-Auth-Token` in IndexedDB.
  - Applies automatic redirect for `201` responses whose body starts with `goto:`.

PostgREST helper:

- `src/client/postgrest.ts` sends `pgREST(query, options, root?)` to `${DB_ROOT}${query}`.
- Text responses starting with JSON object/array markers are parsed.
- `pgErr` returns `{res, err}`.

Auth token transport:

- JWTs are read from `X-Auth-Token`.
- Normal user token is stored under the `tkn` key in IndexedDB.
- Guest token storage key is the current `/guest/:uid` packed event uid.
- Header format is `Authorization: Bearer <token>`.

Error handling:

- Core fetch reads non-OK responses as text, attempts JSON parse, and throws `FetchHttpError`.
- Pages/partials show errors through alerts, redirects, local message state, or dedicated error screens.
- Guest init package-limit and event-closed errors are mapped through `src/utils/guestInitError.ts`.

Main backend integrations:

- Auth:
  - `POST /auth/signin/email`
  - `GET /auth/signup/email/:token`
  - `POST /auth/signup/email/:token`
  - `POST /auth/signup/email/:token/attach`
  - `POST /auth/password-reset/request`
  - `POST /auth/password-reset/confirm`
  - `GET /auth/whoami`
  - `GET /api/guest/whoami`
- PostgREST:
  - `/events`, `/events_public`
  - `/uploads`
  - `/participants`
  - `/users`
  - `/rpc/current_user_uid`
- Upload:
  - `POST /api/upload/event_image`
  - `POST /api/upload/qr_logo`
  - `POST /api/guest/upload/:eventPackedUid/:utype`
- Products/cart/payment:
  - `GET /api/products`
  - `POST /api/purchase`
  - `GET /api/purchase/:encPackedUID/status`
  - Dev-only `POST /api/purchase/:encPackedUID/simulate-success`
- Admin:
  - `GET /api/admin/check`
  - `/api/admin/panel-admins`
  - `/api/admin/products`
  - `/api/admin/promos`
  - `/api/admin/promos/report`
  - `/api/admin/partnerships`
- Event feature/storage/advertorial:
  - `/api/event/:packedUid/features`
  - `/api/event/:packedUid/public-features`
  - `/api/event/:packedUid/extend-storage`
  - `/api/event/:packedUid/advertorial`
  - `/api/event/:packedUid/advertorial-public`
  - `/api/event/:packedUid/advertorial/upload-url`

Backend notes in the repo describe a Go server + PostgREST + S3 presigned upload model. This frontend is directly coupled to that model.

### 8. Auth and Authorization

Login:

- `/signin` renders `V2SignInForm`.
- Submit calls `signInEmail({ email, password }, { blockRedirects: true })`.
- The backend returns a token in `X-Auth-Token`.
- The frontend stores it in IndexedDB under `tkn`.
- Redirect target is selected by `resolvePostSignInRedirect()` using admin role and `?next=`.
- `safeNext()` accepts only same-origin relative paths and blocks external open redirects.

Signup:

- `/signup/:token` is used for token-based signup/attach flow.
- The token info endpoint checks validity and email state.
- Successful registration can use backend token header and/or goto behavior.

Logout:

- `logout()` removes `tkn` from IndexedDB and redirects to `/`.
- `/signout` triggers that flow.

Session/token storage:

- Storage is IndexedDB.
- DB name is `storageDB`, object store is `keyValueStore`, key prefix is `lsg`.
- Normal auth token key is `lsgtkn`.
- Guest token key is `lsg<packedEventUid>`.

Protected route logic:

- Event owner routes are wrapped in `RequireAuth`.
- `RequireAuth` calls `whoAmI()` and renders null while loading.
- If unauthenticated, it redirects to `/signin?next=<encoded current path+search+hash>`.

Admin authorization:

- `AdminRouteGuard` calls `GET /api/admin/check` through `getAdminRole()`.
- If `requireSuperAdmin` is false, `role.is_admin` is required.
- If `requireSuperAdmin` is true, `role.is_super_admin` is required.
- Admin role is cached in memory for 60 seconds.
- Role shape: `is_admin`, `is_super_admin`, `is_order_admin`, `was_panel_admin`, `has_active_event`.
- Some login redirect decisions use `/admin/no-access` for former panel admins without active events.

Role-based access:

- Order admin can access admin order pages.
- Super admin can access products, panel admins, promos, promo report, and partnerships.
- Definitive backend enforcement cannot be verified from frontend code; frontend guards are UI/route-level checks only.

### 9. Configuration and Environment Variables

This frontend does not use CRA’s `REACT_APP_*` environment variable model. Runtime endpoints and public values are hardcoded in `src/consts.ts`.

Env files present in the repository:

- `.env`: gitignored. Current contents are not frontend runtime config; they are Taskmaster/AI API key secrets.
- `deploy/.env`: sourced by the deployment script. Contains AWS and FTP credentials.

`.gitignore` ignores:

- `.env`
- `.env.local`
- `.env.development.local`
- `.env.test.local`
- `.env.production.local`

Important frontend config constants:

```env
# Hardcoded in src/consts.ts, not CRA env
DB_ROOT=https://db.addmoments.com.ua
SERV_ROOT=https://serv.addmoments.com.ua
SERV_ROOT_LOCAL=http://127.0.0.1:8083
SITE_ROOT=https://addmoments.com.ua
SITE_ROOT_LOCAL=http://127.0.0.1:3000
S3_ROOT=https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com
META_PIXEL_ID=<public-meta-pixel-id>
PUBLIC_URL=https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/ui
```

Deployment env variables:

```env
AWS_ACCESS_KEY_ID=<secret>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_DEFAULT_REGION=eu-north-1
AWS_BUCKET=memboxpub-qo1gff2e
FTP_HOST=<host>
FTP_USERNAME=<secret>
FTP_PASSWORD=<secret>
```

Values that must be treated as secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- API keys in root `.env`
- `*.pem` private key files

Values that can be public client config:

- `PUBLIC_URL`
- `S3_ROOT` public bucket root
- `DB_ROOT`, `SERV_ROOT`, `SITE_ROOT` domains
- `META_PIXEL_ID` is visible in the client bundle, but ownership and changes should still be managed carefully.

There is no central env schema or env documentation file. If CRA env variables are introduced, they must use the `REACT_APP_` prefix; however, the current pattern is hardcoded constants in `src/consts.ts`.

### 10. Build, Test, and Quality Checks

Npm scripts:

```bash
npm start
npm run build
npm test
npm run deploy
npm run eject
```

Local development:

- `npm install`
- `npm start`
- CRA dev server runs on `http://localhost:3000` by default.
- Local frontend uses `http://127.0.0.1:8083` for the backend because of `src/consts.ts`.

Build:

- `npm run build`
- The script runs:

```bash
PUBLIC_URL=https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/ui react-scripts build && node postbuild.js
```

- Build output is generated in `build/`.
- `postbuild.js` rewrites static css/js hashes to short random strings and removes `.map`, `.LICENSE.txt`, and `asset-manifest.json`.

Preview/start:

- There is no separate production preview or `serve` script.
- CRA `npm start` is for development.

Test:

- `npm test` runs `react-scripts test`.
- No `.test`/`.spec` files or explicit test coverage setup were found.

Lint/format/typecheck:

- `eslintConfig` extends `react-app` and `react-app/jest`.
- No separate `lint`, `format`, or `typecheck` npm script is defined.
- TypeScript checking runs as part of CRA build.
- No Prettier config was found.

CI:

- No `.github/workflows` directory was found.
- No CI/CD pipeline definition is explicitly present in the repository.

### 11. Deployment

The deployment model is visible from `deploy/deploy.sh`, `package.json`, and `postbuild.js`.

Platform/model:

- Static frontend build files are deployed to an AWS S3 bucket under the `/ui` prefix.
- `index.html` is also uploaded over FTP to `ftp.addmoments.com.ua/public_html/reactApp.html`.
- This suggests static assets are served from S3 and the React HTML entry is consumed from a WordPress or custom hosting side as `reactApp.html`. The repository does not contain a fuller hosting/topology document.

Deployment files:

- `deploy/deploy.sh`
- `deploy/.env`
- `postbuild.js`
- `package.json` build/deploy scripts

Manual deploy flow:

```bash
npm run build
npm run deploy
```

`npm run deploy` runs:

1. Source `deploy/.env`.
2. Set `BUILD_DIR="../build"`.
3. Delete `.DS_Store` files under `build/`.
4. Sync to S3 via `aws s3 sync "$BUILD_DIR" "s3://$AWS_BUCKET/ui" --delete`.
5. Upload HTML over FTP with `curl --user "$FTP_USERNAME:$FTP_PASSWORD" -T "$BUILD_DIR/index.html" "ftp://$FTP_HOST/public_html/reactApp.html"`.

Auto-deploy:

- No automatic deployment on main branch changes is defined in the repository.
- No `.github/workflows`, Dockerfile, Netlify config, or Vercel config was found.
- Deployment therefore appears to be manual-script based.

Build output:

- `build/`
- Production asset URL base is `PUBLIC_URL=https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/ui`.

Production env management:

- Deploy credentials are in `deploy/.env`.
- Frontend runtime endpoints are hardcoded in `src/consts.ts`.
- AWS/FTP secrets must not be committed. Root `.env` is explicitly ignored; whether `deploy/.env` is ignored should be verified in git status for that path.

Rollback/restart:

- No rollback script is defined.
- Static hosting has no app restart flow.
- Practical rollback means rebuilding/redeploying a previous commit or previous artifact; this is not automated in the repository.

### 12. Security and Operations Notes

Secret management:

- Root `.env`, `deploy/.env`, and `*.pem` files must be treated as secrets.
- These files must not be committed and secret values must not be pasted into docs, issues, or PR descriptions.
- Local files currently contain AWS/FTP/API-key-like values, so credential rotation should be evaluated operationally.

Public env and hardcoded config:

- `src/consts.ts` hardcodes production endpoints.
- Staging/prod separation depends on a hostname `localhost` check. Any non-localhost test/staging domain will use production backend endpoints.
- `META_PIXEL_ID` is visible in the client bundle.

CORS/API domain dependencies:

- The frontend depends on:
  - `https://serv.addmoments.com.ua`
  - `https://db.addmoments.com.ua`
  - `https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com`
  - LiqPay checkout endpoint
  - Meta Pixel script endpoint
  - Google Fonts / Font Awesome CDN
- Backend and PostgREST must allow the frontend origins via CORS. CORS config is not defined in this frontend repository.

Auth security:

- Tokens are stored in IndexedDB. XSS would risk token exposure.
- Protected route guards are frontend-level checks; backend endpoints must enforce authorization.
- `safeNext()` reduces open redirect risk on login redirects.

Upload security:

- Files are uploaded directly to S3 using presigned URLs.
- File type/size/content validation appears limited on the frontend; backend presign logic and storage policies should enforce limits.
- Guest upload uses `X-Event` and guest token behavior; backend must enforce event and participant limits.

Payment security:

- Frontend calculations are display-only; real purchase and promo validation happen on the backend.
- LiqPay `data` and `signature` come from the backend; the frontend only posts them.
- `/checkout/pending/:encPackedUID` trusts backend status polling for success/failure.

Analytics:

- Meta Pixel PageView is triggered on SPA route changes.
- AddToCart and Purchase events use sessionStorage guards to reduce duplicates; this is not a full idempotency guarantee.

Operational risks:

- There is no CI/CD; deployment is manual and depends on local env credentials.
- `postbuild.js` randomizes asset hashes, reducing deterministic artifact reproducibility.
- `aws s3 sync --delete` can remove production assets if bucket/prefix config is wrong.
- FTP upload can fail after a successful S3 sync; the script has no rollback/transaction behavior.
- Hardcoded production endpoints make staging separation difficult.

### 13. Developer Quick Map

Adding a new page:

1. Create a page component under `src/pages/`.
2. If a large UI block is needed, use `src/v2-partials/` or the nearest feature partial.
3. Add page-specific CSS under `src/v2-styles/` or `src/styles/` and import it in the component.
4. Add a `lazy(() => import(...))` entry in `src/App.tsx`.
5. Add the route to `Routes`.
6. Use `RequireAuth` for event owner pages or `AdminRouteGuard` for admin pages.
7. Update header/sidebar navigation if needed.

Adding a new API integration:

1. Add or update a domain client file under `src/client/`.
2. Use `SERV_ROOT` for Go server endpoints and `pgREST`/`pgErr` for PostgREST.
3. Use the `src/client/core.ts` wrapper for authenticated requests; use direct `window.fetch` only for third-party calls such as presigned uploads or external checkout posts.
4. Add response types under `src/types/`.
5. Surface errors at the calling page/partial level.

Adding a new component:

- Use `src/v2-components/` for small reusable components.
- Use `src/v2-partials/` for large page-specific sections.
- Use `src/components/` or `src/partials/` only when matching an existing older area.
- Keep CSS as plain files in the logical style folder and import them where needed.
- Prefer uncontrolled form inputs and read values on submit, following the existing project rule.

Adding a new env/config value:

1. If the value is public runtime config, follow the current `src/consts.ts` pattern or intentionally introduce CRA `REACT_APP_*`.
2. If it is secret, do not put it in the frontend bundle; keep it on backend or deployment infrastructure.
3. If it is a deploy secret, update deploy env examples/docs but do not commit real values.
4. Update the "Configuration and Environment Variables" section in this document.

Adding route guard or auth behavior:

- Follow `RequireAuth` for event owner pages.
- Follow `AdminRouteGuard` and `getAdminRole()` for admin pages.
- Do not rely only on frontend guards; verify backend authorization too.

Adding a new upload flow:

- Request a presigned URL from the backend.
- Follow the `uploadFiles` pattern in `src/client/uploads.ts`.
- Upload directly to S3 using `window.fetch(..., { method: "PUT" })`.
- Clarify the backend or PostgREST contract if a DB record is needed.

Adding a new payment/add-on flow:

- Use the Valtio cart proxy in `src/client/cart.ts`.
- Keep product display/config data aligned with `src/types/products.ts` and checkout patterns.
- Keep real price, promo, and payment validation on the backend.
- Use `src/client/meta-pixel.ts` helpers if successful payment analytics are needed.
