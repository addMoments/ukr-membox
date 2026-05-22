import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Event, eventGuestUrl, eventQrImageUrl } from '../types/events';
import { packUUID } from '../packages/uuid';
import { S3_ROOT, SERV_ROOT } from '../consts';
import { fetch as authFetch } from '../client/core';
import { t } from '../packages/i18n';
import AddonModal, { modalState } from './AddonModal';
import QRPreviewCard from '../v2-components/QRPreviewCard';
import GuestAccessCard from '../v2-components/GuestAccessCard';
import ColoredSettingsBox from '../v2-components/ColoredSettingsBox';
import '../styles/EventHomeContent.css';
import ActivityOverviewCard from '../v2-components/ActivityOverviewCard';
import EmptyState from '../v2-components/EmptyState';
import MediaCard from '../v2-components/MediaCard';
import PhotoViewerModal, { photoViewerState } from './PhotoViewerModal';
import { UploadEntry } from '../types/uploads';
import { pgREST } from '../client/postgrest';
import { get_key, set_key } from '../utils/persistence';
import PurchasedAddonsBox from '../v2-components/PurchasedAddonsBox';
import BuyerConfigPanel from '../v2-components/BuyerConfigPanel';
import { Product } from '../types/products';
import { CartItem } from '../types/carts';
import { FEATURE_QR, FEATURE_POSTER } from '../utils/features';

interface EventHomeContentProps {
  event: Event;
}

interface EventStatsResponse {
  contributor_count: number;
  guest_limit: number;
}

function EventHomeContent({
  event,
}: EventHomeContentProps) {
  const DEBUG_PARTICIPANT_EVENT_PACKED_UID = 't0PzNKu6SmGDj4fobcd09w';
  const packedUid = event.uid ? packUUID(event.uid) : '';
  const guestUrl = event.uid ? eventGuestUrl(event) : '';
  const qrUrl = event.uid ? eventQrImageUrl(event) : '';

  const navigate = useNavigate();
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(t('lang_code'), { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const openPhotoViewer = (uploadUid: string, uploads: UploadEntry[]) => {
    const index = uploads.findIndex(u => u.uid === uploadUid);
    photoViewerState.items = uploads.map(upload => {
      const type = upload.upload_type === 'video' ? 'Video' : 'Photo';
      return {
        src: S3_ROOT + upload.value,
        title: type,
        tagline: formatDate(upload.created_at),
        id: upload.uid,
        isVideo: upload.upload_type === 'video',
      };
    });
    photoViewerState.actions = [];
    photoViewerState.currentIndex = index >= 0 ? index : 0;
    photoViewerState.open = true;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(guestUrl);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: event.name,
        url: guestUrl
      });
    } else {
      handleCopyLink();
      
      
    }
  };

  // Ne: Fiziksel add-on icin kullanicinin sectigi tasarimi bulur.
  // Nasil: buyer_config.design_id degerini product.options.designs listesiyle eslestirir.
  // Neden: Statik tasarimli add-on detayinda genel add-on banner'i yerine satin alinan tasarim gosterilmeli.
  const resolveSelectedAddonDesign = (product: Product, cartItem: CartItem) => {
    const designs = product.options?.designs || [];
    return designs.find((design: { id: string }) => design.id === cartItem.buyer_config?.design_id);
  };

  // Ne: buyer_config icindeki kullanici girdilerini okunabilir etiket/deger satirlarina cevirir.
  // Nasil: Once product.options.config_fields sirasi ve label'larini kullanir; config_fields yoksa design_id disindaki ham degerlere duser.
  // Neden: Event add-on detayinda Event Title, Event Date, Welcome Message gibi alanlar net sekilde gorunsun.
  const resolveAddonConfigRows = (product: Product, cartItem: CartItem) => {
    const config = cartItem.buyer_config || {};
    const fields = product.options?.config_fields || [];
    if (fields.length > 0) {
      return fields
        // footer_text bilgisini panel detayinda gecici olarak gizliyoruz.
        .filter((field: { key: string }) => field.key !== 'footer_text')
        .map((field: { key: string; label: string }) => ({
          key: field.key,
          label: field.label,
          value: config[field.key],
        }))
        .filter((row: { value: unknown }) => String(row.value || '').trim());
    }
    return Object.entries(config)
      .filter(([key, value]) => key !== 'design_id' && key !== 'footer_text' && String(value || '').trim())
      .map(([key, value]) => ({ key, label: key, value }));
  };

  // Ne: Fiziksel add-on detay modalinin ozel icerigini render eder.
  // Nasil: Secilen tasarim etiketini, buyer_config satirlarini ve varsa kargo takip bilgisini ayni govdede listeler.
  // Neden: Welcome Board ve QR Card artik gorsel ustu preview degil, secilen tasarim + saklanan form bilgileri olarak takip ediliyor.
  const renderAddonDetailsBody = (product: Product, cartItem: CartItem, trackingText: string) => {
    const selectedDesign = resolveSelectedAddonDesign(product, cartItem);
    const rows = resolveAddonConfigRows(product, cartItem);
    return (
      <div className="addon-modal-config">
        {selectedDesign?.label && (
          <div className="addon-modal-config-row">
            <span className="addon-modal-config-label">Design</span>
            <span className="addon-modal-config-value">{selectedDesign.label}</span>
          </div>
        )}
        {rows.length > 0 ? rows.map((row: { key: string; label: string; value: unknown }) => (
          <div key={row.key} className="addon-modal-config-row">
            <span className="addon-modal-config-label">{row.label}</span>
            <span className="addon-modal-config-value">{String(row.value)}</span>
          </div>
        )) : (
          <p className="addon-modal-desc">No configuration was provided.</p>
        )}
        {trackingText && (
          <div className="addon-modal-config-row">
            <span className="addon-modal-config-label">Status</span>
            <span className="addon-modal-config-value">{trackingText}</span>
          </div>
        )}
      </div>
    );
  };

  const handleRedeemAddon = (product: Product, cartItem: CartItem) => {
    if (product.fullfillment_type === 'digital') {
      const featureToPath: Record<number, string> = {
        [FEATURE_QR]: `/event/${packedUid}/qr`,
        [FEATURE_POSTER]: `/event/${packedUid}/poster`,
      };
      const featureId = product.granted_features?.[0];
      if (featureId && featureToPath[featureId]) {
        navigate(featureToPath[featureId]);
      }
      return;
    }
    if (cartItem.status === 'client-action') {
      setExpandedItemUid(cartItem.uid || null);
      return;
    }
    const display = t('products.' + product.id, { returnObjects: true }) as { name?: string };
    const pendingRaw = t('addons.pendingFulfillment');
    const pendingFallback = t('lang_code') === 'uk' ? 'Очікує виконання' : 'Pending fulfillment';
    const pendingText = pendingRaw && pendingRaw !== 'addons.pendingFulfillment' ? pendingRaw : pendingFallback;
    const trackingText = cartItem.tracking_number
      ? `${cartItem.carrier ? cartItem.carrier + ': ' : ''}${cartItem.tracking_number}`
      : pendingText;
    const selectedDesign = resolveSelectedAddonDesign(product, cartItem);
    modalState.header = display?.name || product.id;
    modalState.description = trackingText;
    modalState.imageUrl = selectedDesign?.image || product.options?.image || '';
    modalState.icon = product.options?.icon || '';
    modalState.renderBody = () => renderAddonDetailsBody(product, cartItem, trackingText);
    modalState.renderInput = false;
    modalState.buttonText = t('addons.close') || 'Close';
    modalState.open = true;
    modalState.onSubmit = () => {
      modalState.open = false;
      modalState.renderBody = null;
    };
  };

  const [latestUploads, setLatestUploads] = useState<UploadEntry[]>([]);
  const [storageSize, setStorageSize] = useState<string>('–');
  const [photoCount, setPhotoCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [fetchedGuestCount, setFetchedGuestCount] = useState(0);
  const [purchasedAddons, setPurchasedAddons] = useState<{ product: Product; cartItem: CartItem }[]>([]);
  const [expandedItemUid, setExpandedItemUid] = useState<string | null>(null);

  useEffect(() => {
    if (!event.uid) return;
    const currentPackedUid = packUUID(event.uid);
    
    pgREST(`/uploads?event_uid=eq.${event.uid}&trashed_at=is.null&upload_type=in.(photo,video)&order=created_at.desc&limit=4`)
      .then((uploads: UploadEntry[]) => {
        setLatestUploads(uploads || []);
      })
      .catch(err => {
        console.error('Failed to load uploads:', err);
      });

    pgREST(`/uploads?event_uid=eq.${event.uid}&upload_type=eq.photo&trashed_at=is.null&select=uid`)
      .then((uploads: any[]) => setPhotoCount(uploads?.length || 0))
      .catch(console.error);

    pgREST(`/uploads?event_uid=eq.${event.uid}&upload_type=eq.video&trashed_at=is.null&select=uid`)
      .then((uploads: any[]) => setVideoCount(uploads?.length || 0))
      .catch(console.error);

    authFetch(`${SERV_ROOT}/api/event/${currentPackedUid}/stats`)
      .then(res => res.json())
      .then((stats: EventStatsResponse) => {
        setFetchedGuestCount(Number(stats?.contributor_count || 0));

        if (currentPackedUid === DEBUG_PARTICIPANT_EVENT_PACKED_UID) {
          console.group('[DEBUG] Event contributor stats');
          console.log('packedUid:', currentPackedUid);
          console.log('contributor_count:', stats?.contributor_count);
          console.log('guest_limit:', stats?.guest_limit);
          console.groupEnd();
        }
      })
      .catch((err) => {
        console.error('Failed to load event stats:', err);
      });

    authFetch(`${SERV_ROOT}/api/event/${packedUid}/order`)
      .then(res => res.json())
      .then((order: any) => setPurchasedAddons(
        (order?.items || []).map((item: any) => ({ product: item.product, cartItem: item }))
      ))
      .catch(() => {});
  }, [event.uid, packedUid]);

  useEffect(() => {
    if (!packedUid) return;

    authFetch(`${SERV_ROOT}/api/calc-size/${packedUid}`)
      .then(res => res.json())
      .then((data: { size_mb: number }) => {
        const mb = data.size_mb;
        setStorageSize(`${mb.toFixed(1)}`);
      })
      .catch(err => {
        console.error('Failed to load storage size:', err);
      });
  }, [packedUid]);

  const [isCloseToStarting, setIsCloseToStarting] = useState(false);
  const [hasEventEnded, setHasEventEnded] = useState(false);

  const startingDismissKey = `event-starting-dismiss-${event.uid}`;
  const endedDismissKey = `event-ended-dismiss-${event.uid}`;

  const isLive = (()=>{
    if (!event.activation_date) return false;
    const activationDate = new Date(event.activation_date);
    const now = new Date();
    const activeUntil = new Date(event.active_until); 
    return now.getTime() >= activationDate.getTime() && now.getTime() < activeUntil.getTime();
  })();

  useEffect(() => {
    if (!event.uid) return;

    const now = new Date();

    const checkCloseToStart = () => {
      if (!event.activation_date) return false;
      const activationDate = new Date(event.activation_date);
      const diff = activationDate.getTime() - now.getTime();
      return diff > 0 && diff < 1000 * 60 * 60 * 24;
    };

    const checkEventEnded = () => {
      if (!event.active_until) return false;
      const activeUntil = new Date(event.active_until);
      return now.getTime() > activeUntil.getTime();
    };

    const closeToStart = checkCloseToStart();
    const eventEnded = checkEventEnded();

    get_key(startingDismissKey).catch(() => false).then((dismissed) => {
      setIsCloseToStarting(closeToStart && !dismissed);
    });

    get_key(endedDismissKey).catch(() => false).then((dismissed) => {
      setHasEventEnded(eventEnded && !dismissed);
    });
  }, [endedDismissKey, event.activation_date, event.active_until, event.uid, startingDismissKey])

  if (!event.uid){
    return null
  }

  // Ne: ACTIVITY OVERVIEW kartindaki "Active Until" ve "Storage Expiration" hucrelerine kisa tarih (gun + ay) yazar.
  // Nasil: ISO timestamp'i Date'e cevirir; girdi yoksa veya parse edilemezse "—" doner. Locale formatlamasi active_until ile birebir ayni tutulur.
  // Neden: storage_until backend'den geliyor ve null olabilir; UI fallback'i tek noktadan yonetilsin, NaN/Invalid Date asla ekrana sizmasin.
  const formatShortDate = (raw?: string | null): string => {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.getDate()} ${d.toLocaleString('default', { month: 'long' })}`;
  };

  return (
    <div className="ehc">
      {/* Main Grid */}
      <div className="ehc-grid">
        {/* Left Column */}
        <div className="ehc-left">
          {/* Hero Card */}
          {!event.name && <ColoredSettingsBox
            title={t('eventHome.welcome.title')}
            descriptionS={[t('eventHome.welcome.description')]}
            color="#3B82F6"
            buttonPropsS={[{ text: t('eventHome.buttons.settings'), onClick: () => {
              navigate(`/event/${packedUid}/settings`);
            } }]}
          />}

          {isCloseToStarting && <ColoredSettingsBox
            title={t('eventHome.eventStartingSoon.title')}
            descriptionS={[t('eventHome.eventStartingSoon.description')]}
            color="#DC2626"
            buttonPropsS={[
              { text: t('eventHome.buttons.settings'), onClick: () => navigate(`/event/${packedUid}/settings`) },
              { text: t('eventHome.buttons.dismiss'), onClick: () => {
                set_key(startingDismissKey, true);
                setIsCloseToStarting(false);
              }}
            ]}
          />}

          {hasEventEnded && <ColoredSettingsBox
            title={t('eventHome.eventEnded.title')}
            descriptionS={[t('eventHome.eventEnded.description')]}
            color="#3B82F6"
            buttonPropsS={[
              { text: t('eventHome.buttons.download'), onClick: () => navigate(`/event/${packedUid}/settings#export`) },
            ]}
          />}

          <div className="ehc-hero-card">
            <div className="ehc-hero-image-wrap">
              <div className="ehc-hero-image">
                {event.image ? (
                  <img src={S3_ROOT + event.image} alt={event.name} />
                ) : (
                  <div className="ehc-hero-image-placeholder">
                    <i className="fa-solid fa-calendar-days" />
                  </div>
                )}
                <div className="ehc-hero-image-badge">{t('eventHome.heroCard.eventCover')}</div>
              </div>
            </div>
            <div className="ehc-hero-content">
              <div className="ehc-hero-meta">
                {isLive && (
                  <span className="ehc-status-badge live">
                    <span className="ehc-status-dot"></span>
                    {t('eventHome.heroCard.liveNow')}
                  </span>
                )}
                <span className="ehc-event-id">{t('eventHome.heroCard.idLabel')} {packedUid}</span>
              </div>
              <h1 className="ehc-hero-title">{event.name || t('eventHome.heroCard.untitledEvent')}</h1>
              <div className="ehc-hero-details">
                <div className="ehc-detail-row">
                  <div className="ehc-detail-icon">
                    <i className="fa-solid fa-calendar-days" />
                  </div>
                  <span>{formatDate(event.activation_date) || t('eventHome.heroCard.dateNotSet')}</span>
                </div>
                {/* <div className="ehc-detail-row">
                  <div className="ehc-detail-icon">
                    <i className="fa-solid fa-location-dot" />
                  </div>
                  <span>{event.description || t('eventHome.heroCard.locationNotSet')}</span>
                </div> */}
                {event.welcome_message && (
                  <div className="ehc-detail-row ehc-detail-message">
                    <div className="ehc-detail-icon">
                      <i className="fa-solid fa-comment-dots" />
                    </div>
                    <p>{event.welcome_message}</p>
                  </div>
                )}
              </div>
              <div className="ehc-hero-actions">
                <Link to={`/guest/${packedUid}`} className="ehc-btn ehc-btn-accent">
                  <i className="fa-solid fa-eye" />
                  {t('eventHome.heroCard.viewGuestPage')}
                </Link>
                <button className="ehc-btn ehc-btn-dark" onClick={handleShare}>
                  <i className="fa-solid fa-share" />
                  {!!navigator.share ? t('eventHome.heroCard.shareEvent') : t('eventHome.heroCard.copyLink')}
                </button>
              </div>
            </div>
          </div>

          {/* Guest Access Card */}
          <GuestAccessCard
            guestUrl={guestUrl}
            eventName={event.name || t('eventHome.heroCard.untitledEvent')}
          />

          
        </div>

        {/* Right Column */}
        <div className="ehc-right">
          <QRPreviewCard
            eventName={event.name || t('eventHome.heroCard.untitledEvent')}
            qrCodeUrl={qrUrl}
            eventUid={`#${packedUid}`}
            isActive={isLive}
          />

          <ActivityOverviewCard
            stats={[
              { value: photoCount, label: t('eventHome.activityOverview.photos') },
              { value: videoCount, label: t('eventHome.activityOverview.videos') },
              { value: fetchedGuestCount, label: t('eventHome.activityOverview.guests') },
              { value: storageSize, label: t('eventHome.activityOverview.megabytes') },
              { value: formatShortDate(event.active_until), label: t('eventHome.activityOverview.activeUntil') },
              { value: formatShortDate(event.storage_until), label: t('eventHome.activityOverview.storageExpiration') },
            ]}
          />
        </div>
      </div>

      {/* Purchased Add-ons */}
      <PurchasedAddonsBox
        addons={purchasedAddons}
        onRedeem={handleRedeemAddon}
      />
      {expandedItemUid && (() => {
        const entry = purchasedAddons.find(a => a.cartItem.uid === expandedItemUid);
        if (!entry) return null;
        return (
          <BuyerConfigPanel
            product={entry.product}
            cartItem={entry.cartItem}
            onSubmit={async (config) => {
              await authFetch(`${SERV_ROOT}/api/event/${packedUid}/order/items/${expandedItemUid}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ buyer_config: config }),
              });
              // Re-fetch order to update status
              authFetch(`${SERV_ROOT}/api/event/${packedUid}/order`)
                .then(res => res.json())
                .then((order: any) => setPurchasedAddons(
                  (order?.items || []).map((item: any) => ({ product: item.product, cartItem: item }))
                ))
                .catch(() => {});
              setExpandedItemUid(null);
            }}
            onClose={() => setExpandedItemUid(null)}
          />
        );
      })()}
      
      {/* <div className="ehc-section">
        <div className="ehc-section-header">
          <h2 className="ehc-section-title">More Add-Ons</h2>
        </div>
        <div className="ehc-tools-grid">
          <AddonBox
            to={`/event/${packedUid}/gallery`}
            iconClass="fa-solid fa-images"
            title="Gallery Manager"
            description="Curate photos, organize albums, and moderate content."
            accent
          />
          <AddonBox
            to={`/event/${packedUid}/guestbook`}
            iconClass="fa-solid fa-book"
            title="Digital Guestbook"
            description="Manage heartfelt messages and wishes left by your guests."
          />
          <AddonBox
            to={`/event/${packedUid}/qr`}
            iconClass="fa-solid fa-qrcode"
            title="QR Code & Print"
            description="Download high-res QR codes and custom print assets."
          />
          <AddonBox
            to={`/guest/${packedUid}`}
            iconClass="fa-solid fa-display"
            title="Live Slideshow"
            description="Launch the real-time photo stream for your event."
          />
        </div>
      </div> */}

      {/* Latest Memories */}
      <div className="ehc-section ehc-section-bordered">
        <div className="ehc-section-header">
          <h2 className="ehc-section-title">{t('eventHome.latestMemories.title')}</h2>
          <Link to={`/event/${packedUid}/gallery`} className="ehc-section-link">{t('eventHome.latestMemories.viewAllGallery')}</Link>
        </div>
        <div className="ehc-memories-grid" style={latestUploads.length === 0 ? {display: "flex", justifyContent: "center", alignItems: "center"} : undefined}>
          {latestUploads.length > 0 ? (
            <>
              {latestUploads.slice(0, 4).map((upload) => (
                <MediaCard key={upload.uid} uploaderName="guest-" uploadEntry={upload} onFullscreen={() => openPhotoViewer(upload.uid, latestUploads)} />
              ))}
  
            </>
          ) : (
            <EmptyState
              title={t('eventHome.latestMemories.noPhotosYet')}
              subtitle={t('eventHome.latestMemories.photosWillAppear')}
              color="#888888"
            />
          )}
        </div>
      </div>

      <AddonModal  />
      <PhotoViewerModal />
    </div>
  );
}

export default EventHomeContent;
