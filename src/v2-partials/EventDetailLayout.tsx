import { useCallback, useEffect, useState, ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import V2Header from '../v2-components/V2Header';
import Footer from '../v2-components/Footer';
import EventNavigator from './EventNavigator';
import V2ExtendStorageModal from './V2ExtendStorageModal';
import { Event } from '../types/events';
import { pgREST } from '../client/postgrest';
import { getEventFeatures } from '../client/features';
import { unpackUUID } from '../packages/uuid';
import { t } from '../packages/i18n';
import '../v2-styles/EventDetailLayout.css';
import { S3_ROOT } from '../consts';

interface EventDetailLayoutProps {
  children: (event: Event, features: number[]) => ReactNode;
}

function EventDetailLayout({ children }: EventDetailLayoutProps) {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event>({} as Event);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [features, setFeatures] = useState<number[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [extendModalOpen, setExtendModalOpen] = useState(false);

  // Ne: Host event detayi ve sidebar event listesini PostgREST'ten ceker.
  // Nasil: Mevcut event'i uid ile, event listesini deleted_at=is.null ve created_at.desc siralamasiyla alir; silinmis event acilmissa /events'e yonlendirir.
  // Neden: Soft delete edilen event direkt URL veya eski redirect ile acilmasin, kullanici aktif event secimine geri donsun.
  const fetchData = useCallback(async () => {
    if (!packedUid) return;
    const uid = unpackUUID(packedUid);
    const [eventData, featData, allEventsData] = await Promise.all([
      pgREST(`/events?uid=eq.${uid}&select=*,should_show_extend_prompt`),
      getEventFeatures(packedUid),
      pgREST(`/events?deleted_at=is.null&select=*,should_show_extend_prompt&order=created_at.desc`),
    ]);
    const currentEvent = (eventData && eventData[0]) || ({} as Event);
    const visibleEvents = (allEventsData || []).filter((evt: Event) => !evt.deleted_at);

    if (!currentEvent.uid || currentEvent.deleted_at) {
      navigate('/events');
      return;
    }

    setEvent(currentEvent);
    setFeatures(featData || []);
    setAllEvents(visibleEvents);
  }, [navigate, packedUid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Ne: Backend should_show_extend_prompt=true dondugunde uzatma modal'ini otomatik acar.
  // Nasil: event yuklendiginde alanin true olup olmadigi kontrol edilir; true ise modal ac.
  // Neden: Event sahibinin storage suresi dolmadan once otomatik tetiklenmesi backend kararina dayansin.
  useEffect(() => {
    if (event?.should_show_extend_prompt) {
      setExtendModalOpen(true);
    }
  }, [event?.should_show_extend_prompt]);

  // Ne: Mail/deep link uzerinden gelen ?prompt=extend query parametresine cevap olarak modal'i acar.
  // Nasil: Event yuklendikten sonra (event.uid varken) URL parametresi 'extend' ise modal acilir.
  // Neden: Backend bayragi false donse bile mail butonu link'iyle gelen kullanici icin cift garanti.
  useEffect(() => {
    if (searchParams.get('prompt') === 'extend' && event.uid) {
      setExtendModalOpen(true);
    }
  }, [searchParams, event.uid]);

  useEffect(() => {
    if (!mobileNavOpen) {
      document.body.classList.remove('event-mobile-nav-open');
      return undefined;
    }
    document.body.classList.add('event-mobile-nav-open');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove('event-mobile-nav-open');
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const handleClose = () => setMobileNavOpen(false);
    window.addEventListener('event-nav-close', handleClose);
    return () => window.removeEventListener('event-nav-close', handleClose);
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(t('lang_code'), { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Ne: Uzatma basarili oldugunda lokal event state'ini gunceller.
  // Nasil: Yeni storage_until ile birlikte should_show_extend_prompt'u false yapip ayni event'in modali tekrar acmasini onler.
  // Neden: Backend cevabi sadece storage_until tasiyor; tam refetch yerine lokal merge daha hizli ve kullanici hemen yeni tarihi gorur.
  const handleExtendSuccess = (storageUntil: string) => {
    setEvent((prev) => ({
      ...prev,
      storage_until: storageUntil,
      should_show_extend_prompt: false,
    }));
  };

  // Ne: 409 ALREADY_EXTENDED veya EXTEND_REJECTED durumlarinda butun event verisini tazeler.
  // Nasil: useCallback ile referansi stabil olan fetchData yeniden cagirilir.
  // Neden: Backend ile state senkronu garantilensin (bu durumlar genelde lokal state'in eskidigi anlamina gelir).
  const handleExtendRefetch = () => {
    fetchData();
  };

  // Ne: 410 EVENT_CLOSED durumunda kullaniciyi event listesine yonlendirir.
  // Nasil: navigate('/events') ile redirect; mevcut sayfa zaten kapanmis bir event icin gecerli degil.
  // Neden: Kapali event'te kalmak anlamsiz; kullanici ya baska event'e gecsin ya da services-and-prices'a yonlendirilsin.
  const handleEventClosed = () => {
    navigate('/events');
  };

  return (
    <div className="App">
      <V2Header />

      <div className="event-detail-layout">
        {!mobileNavOpen && (
          <button
            type="button"
            className="event-detail-mobile-nav-toggle"
            aria-label={t('sidebar.menu') || 'Open menu'}
            onClick={() => setMobileNavOpen(true)}
          >
            <i className="fa-solid fa-bars" />
          </button>
        )}

        {mobileNavOpen && (
          <button
            type="button"
            className="event-detail-mobile-nav-backdrop"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        <EventNavigator
          eventUid={event.uid}
          eventTitle={event.name || t('sidebar.untitled')}
          eventDate={formatDate(event.activation_date)}
          eventImageUrl={event.image ? `${S3_ROOT}${event.image}` : ''}
          packedUid={packedUid || ''}
          features={features}
          allEvents={allEvents}
        />
        <main className="event-detail-main">
          {event.uid && children(event, features)}
        </main>
      </div>

      <V2ExtendStorageModal
        open={extendModalOpen}
        packedUid={packedUid || ''}
        onClose={() => setExtendModalOpen(false)}
        onSuccess={handleExtendSuccess}
        onRefetch={handleExtendRefetch}
        onEventClosed={handleEventClosed}
      />

      <Footer />
    </div>
  );
}

export default EventDetailLayout;
