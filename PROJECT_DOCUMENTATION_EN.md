# PROJECT DOCUMENTATION - Frontend

## 1. Project Overview

This repository contains the React frontend for the **Add Moments** product. The app lets event owners create digital event albums, collect photos/videos/voice/text entries from guests, share QR/link access, manage event theme/settings, purchase packages and add-ons, and lets admin users manage orders, products, promo codes, and partnerships.

The product domain is media collection for weddings, concerts, parties, and similar events without requiring guests to install an app. Public metadata and header/footer copy position the product as "The easiest way to collect media/photos from your guests."

Main user-facing flows:

- Public purchase flow: choose packages/add-ons on `/events/services-and-prices`, start payment on `/checkout`, redirect to LiqPay, and wait for payment status on `/checkout/pending/:encPackedUID`.
- Auth flow: `/signin`, `/signout`, `/recover`, `/reset-password/:token`, `/signup/:token`.
- Event owner flow: `/events` redirect page, `/event/:uid` and child pages for dashboard, gallery, guestbook, trash, collaborators, settings, theme, QR, and poster management.
- Guest flow: `/guest/:uid`, `/guest/:uid/uploads`, `/guest/:uid/guestbook`; guests open the event page, upload media, and leave guestbook entries.
- Admin flow: `/admin/orders`, `/admin/orders/:uid`, `/admin/products`, `/admin/panel-admins`, `/admin/promos`, `/admin/promos/report`, `/admin/partnerships`.

## 2. Technology Stack

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

## 3. Root Project Structure

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
- `src/styles/`: older common CSS files.
- `src/v2-styles/`: V2 component/page CSS files.
- `src/printables/`: printable poster/golden-hour outputs.
- `src/temp-ai-logic-and-data/`: temporary mock/stub data and helpers.

Standard folders named `app/`, `lib/`, `hooks/`, `services/`, or `assets/` are not explicitly present at root or under `src`. Assets mostly live in `public/assets/`; the service/client layer is `src/client/`.

## 4. Application Startup Flow

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

## 5. Pages and Routes

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
- `/guest/:uid/uploads`: guest's own upload list.
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

## 6. Component Structure

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

## 7. API and Backend Integration

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

## 8. Auth and Authorization

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

## 9. Configuration and Environment Variables

This frontend does not use CRA's `REACT_APP_*` environment variable model. Runtime endpoints and public values are hardcoded in `src/consts.ts`.

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

## 10. Build, Test, and Quality Checks

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

## 11. Deployment

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

## 12. Security and Operations Notes

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

## 13. Developer Quick Map

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
