import { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import i18n, { change_lang } from './packages/i18n';
import NotFound from './pages/notFound';
import V2Toast from './v2-components/V2Toast';
import RequireAuth from './v2-components/RequireAuth';
import AdminRouteGuard from './v2-components/AdminRouteGuard';
import { is_live } from './consts';
import { trackMetaPageView } from './client/meta-pixel';
import Footer from './components/Footer';

function RouteChangeEmitter() {
  const location = useLocation();
  useEffect(() => {
    // Ne: React route degisimlerinde Meta Pixel PageView event'i yollar.
    // Nasil: Location pathname degistikce helper uzerinden Pixel init ve PageView tetiklenir.
    // Neden: SPA navigasyonlari tam sayfa reload yapmadigi icin Meta raporlarinda sayfa gecisleri eksik kalmasin.
    trackMetaPageView();
    window.dispatchEvent(new Event('routechange'));
  }, [location.pathname]);
  return null;
}

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);
  return null;
}

const SignIn = lazy(() => import('./pages/signin'));
const SignUp = lazy(() => import('./pages/signup'));
const Recover = lazy(() => import('./pages/recover'));
const Events = lazy(() => import('./pages/events'));
const EventDetail = lazy(() => import('./pages/event-detail/index'));
const EventGallery = lazy(() => import('./pages/event-detail/gallery'));
const EventGuestbook = lazy(() => import('./pages/event-detail/guestbook'));
const EventTrash = lazy(() => import('./pages/event-detail/trash'));
const EventCollaborators = lazy(() => import('./pages/event-detail/collaborators'));
const EventSettings = lazy(() => import('./pages/event-detail/settings'));
const EventTheme = lazy(() => import('./pages/event-detail/theme'));
const EventQR = lazy(() => import('./pages/event-detail/qr'));
const EventPoster = lazy(() => import('./pages/event-detail/poster'));
const Participant = lazy(() => import('./pages/participant/index'));
const ParticipantUploads = lazy(() => import('./pages/participant/uploads'));
const ParticipantGuestbook = lazy(() => import('./pages/participant/guestbook'));
const Message = lazy(() => import('./pages/message'));
const EventNew = lazy(() => import('./pages/event-new'));
const EventCheckout = lazy(() => import('./pages/event-checkout'));
const CheckoutPending = lazy(() => import('./pages/checkout-pending'));
const ResetPassword = lazy(() => import('./pages/reset-password'));
const ApiRoute = lazy(() => import('./pages/api'));
const SignOut = lazy(() => import('./pages/signout'));
const AdminOrders = lazy(() => import('./pages/admin/orders'));
const AdminOrderDetail = lazy(() => import('./pages/admin/order-detail'));
const AdminProducts = lazy(() => import('./pages/admin/products'));
const AdminPanelAdmins = lazy(() => import('./pages/admin/panel-admins'));
const AdminPromos = lazy(() => import('./pages/admin/promos'));
const AdminPromoReport = lazy(() => import('./pages/admin/promo-report'));
const AdminPartnerships = lazy(() => import('./pages/admin/partnerships'));
const AdminNoAccess = lazy(() => import('./pages/admin/no-access'));
// TODO: from a json route config.

(()=>{
  const elems = [
    document.querySelector('#langSel'),
    document.querySelector('#langSel2'),
    document.querySelector('#langSelMobile'),
  ]

    elems.forEach(elem=>{
      elem?.addEventListener('change', (e:any)=>{
        change_lang(e.target.value);
      });
    });
})()



function App() {
  const [i18nReady, setI18nReady] = useState(i18n.isInitialized);
  
  useEffect(() => {
    if (!i18n.isInitialized) {
      i18n.on('initialized', () => setI18nReady(true));
    }
  }, []);

  if (!i18nReady) return null;

  return (
    <BrowserRouter>
      <ScrollToTop />
      <RouteChangeEmitter />
      <Suspense>
        <Routes>
          {/* Host event detay ve alt sayfalari icin auth guard:
              login degilse RequireAuth /signin?next=... yonlendirme yapar,
              login olduktan sonra orijinal URL (?prompt=extend gibi query'ler dahil) aynen acilir. */}
          <Route path="/event/:uid" element={<RequireAuth><EventDetail /></RequireAuth>} />
          <Route path="/event/:uid/gallery" element={<RequireAuth><EventGallery /></RequireAuth>} />
          <Route path="/event/:uid/guestbook" element={<RequireAuth><EventGuestbook /></RequireAuth>} />
          <Route path="/event/:uid/trash" element={<RequireAuth><EventTrash /></RequireAuth>} />
          <Route path="/event/:uid/collaborators" element={<RequireAuth><EventCollaborators /></RequireAuth>} />
          <Route path="/event/:uid/settings" element={<RequireAuth><EventSettings /></RequireAuth>} />
          <Route path="/event/:uid/theme" element={<RequireAuth><EventTheme /></RequireAuth>} />
          <Route path="/event/:uid/qr" element={<RequireAuth><EventQR /></RequireAuth>} />
          <Route path="/event/:uid/poster" element={<RequireAuth><EventPoster /></RequireAuth>} />

          <Route path="/events/services-and-prices" element={<EventNew />} />
          <Route path="/events/services-and-prices/" element={<EventNew />} />
          <Route path="/checkout" element={<EventCheckout />} />
          <Route path="/checkout/pending/:encPackedUID" element={<CheckoutPending />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/payment/:token" element={<></>} />

          <Route path="/signin" element={<SignIn />} />
          <Route path="/signin/" element={<SignIn />} />
          <Route path="/signout" element={<SignOut />} />
          <Route path="/recover" element={<Recover />} />
          <Route path="/guest/:uid" element={<Participant />} />
          <Route path="/guest/:uid/uploads" element={<ParticipantUploads />} />
          <Route path="/guest/:uid/guestbook" element={<ParticipantGuestbook />} />
          <Route path="/notice/*" element={<Message />} />


          <Route path="/events" element={<Events />} />

          <Route path="/admin/orders" element={<AdminRouteGuard><AdminOrders /></AdminRouteGuard>} />
          <Route path="/admin/orders/:uid" element={<AdminRouteGuard><AdminOrderDetail /></AdminRouteGuard>} />
          <Route path="/admin/products" element={<AdminRouteGuard requireSuperAdmin><AdminProducts /></AdminRouteGuard>} />
          <Route path="/admin/panel-admins" element={<AdminRouteGuard requireSuperAdmin><AdminPanelAdmins /></AdminRouteGuard>} />
          <Route path="/admin/promos" element={<AdminRouteGuard requireSuperAdmin><AdminPromos /></AdminRouteGuard>} />
          <Route path="/admin/promos/report" element={<AdminRouteGuard requireSuperAdmin><AdminPromoReport /></AdminRouteGuard>} />
          <Route path="/admin/partnerships" element={<AdminRouteGuard requireSuperAdmin><AdminPartnerships /></AdminRouteGuard>} />
          <Route path="/admin/no-access" element={<AdminNoAccess />} />

          <Route path="/signup/:token" element={<SignUp />} />

          {!is_live && <Route path="/api/*" element={<ApiRoute />} />}

          {is_live && <Route path="*" element={<NotFound />} />}
        </Routes>
      </Suspense>
      <V2Toast />
      <Footer />
    </BrowserRouter>
  );
}

export default App;

