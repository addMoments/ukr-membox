import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import { UploadEntry } from '../types/uploads';
import { Event } from '../types/events';
import { pgREST } from '../client/postgrest';
import { whoAmI } from '../client/auth';
import { unpackUUID } from '../packages/uuid';
import { S3_ROOT } from '../consts';
import { GuestTheme, defaultGuestTheme } from '../types/guestTheme';
import { getTimeAgo } from '../temp-ai-logic-and-data/time-ago';
import MediaCard from '../v2-components/MediaCard';
import PhotoViewerModal, { photoViewerState } from '../partials/PhotoViewerModal';
import '../v2-styles/GuestUploads.css';
import { applyGuestFont } from '../utils/applyGuestFont';
import { t } from '../packages/i18n';
import V2GuestGate from './V2GuestGate';
import GuestAccessErrorScreen from './GuestAccessErrorScreen';
import { getEventClosedMessage, isEventClosedError, isPackageLimitExceededError } from '../utils/guestInitError';

type FilterType = 'all' | 'photo' | 'video';

export interface V2ParticipantUploadsProps {
  theme?: GuestTheme;
}

function V2ParticipantUploads() {
  const { uid: packedUid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const eventUid = unpackUUID(packedUid || "a");

  const PAGE_SIZE = 20;

  const [event, setEvent] = useState<Event>({} as Event);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [participantUid, setParticipantUid] = useState('');
  const [showPackageLimitError, setShowPackageLimitError] = useState(false);
  const [eventClosedMessage, setEventClosedMessage] = useState('');
  const theme = event.settings?.colors || defaultGuestTheme;
  const langCode = t('lang_code');
  const eventClosedTitleRaw = t('guestAccessError.eventClosedTitle');
  const eventClosedActionRaw = t('guestAccessError.eventClosedAction');
  const eventClosedDefaultMessageRaw = t('guestAccessError.eventClosedDefaultMessage');
  const eventClosedTitle = eventClosedTitleRaw === 'guestAccessError.eventClosedTitle'
    ? (langCode === 'uk' ? 'Цю подію закрито' : 'This event is closed')
    : eventClosedTitleRaw;
  const eventClosedAction = eventClosedActionRaw === 'guestAccessError.eventClosedAction'
    ? (langCode === 'uk' ? 'На головну' : 'Go to home')
    : eventClosedActionRaw;
  const eventClosedDefaultMessage = eventClosedDefaultMessageRaw === 'guestAccessError.eventClosedDefaultMessage'
    ? (langCode === 'uk' ? 'Цю подію закрито.' : 'This event is closed.')
    : eventClosedDefaultMessageRaw;

  useEffect(() => {
    (async () => {
      try {
        const uid = await whoAmI().then(x => x.ui);
        setParticipantUid(uid);

        const [eventData, uploadsData] = await Promise.all([
          pgREST(`/events_public?uid=eq.${eventUid}`),
          pgREST(`/uploads?event_uid=eq.${eventUid}&client_uid=eq.${uid}&upload_type=in.(photo,video)&trashed_at=is.null&order=created_at.desc&limit=${PAGE_SIZE}&offset=0`)
        ]);

        setEvent(eventData[0]);
        applyGuestFont(eventData[0].settings?.font);
        setUploads(uploadsData);
        setOffset(PAGE_SIZE);
        setHasMore(uploadsData.length === PAGE_SIZE);
      } catch (err) {
        if (isPackageLimitExceededError(err)) {
          setShowPackageLimitError(true);
          return;
        }
        if (isEventClosedError(err)) {
          setEventClosedMessage(getEventClosedMessage(err) || eventClosedDefaultMessage);
        }
      }
    })();
  }, [eventClosedDefaultMessage, eventUid]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const more = await pgREST(
        `/uploads?event_uid=eq.${eventUid}&client_uid=eq.${participantUid}&upload_type=in.(photo,video)&trashed_at=is.null&order=created_at.desc&limit=${PAGE_SIZE}&offset=${offset}`
      );
      setUploads(prev => [...prev, ...more]);
      setOffset(prev => prev + PAGE_SIZE);
      setHasMore(more.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredUploads = uploads.filter(upload => {
    if (filter === 'all') return true;
    if (filter === 'photo') return upload.upload_type === 'photo';
    if (filter === 'video') return upload.upload_type === 'video';
    return true;
  });

  const openPhotoViewer = (uploadUid: string) => {
    const index = filteredUploads.findIndex(u => u.uid === uploadUid);
    photoViewerState.items = filteredUploads.map(upload => {
      const type = upload.upload_type === 'video' ? t('common.video') : t('common.photo');
      return {
        src: S3_ROOT + upload.value,
        title: t('guest.yourUpload'),
        tagline: `${type} · ${getTimeAgo(upload.created_at)}`,
        id: upload.uid,
        isVideo: upload.upload_type === 'video',
      };
    });
    photoViewerState.actions = [];
    photoViewerState.currentIndex = index >= 0 ? index : 0;
    photoViewerState.open = true;
  };

  if (event.uid && event.activation_date && event.active_until) {
    const now = Date.now();
    const start = new Date(event.activation_date + (event.activation_date.includes('Z') || event.activation_date.includes('+') ? '' : 'Z')).getTime();
    const end   = new Date(event.active_until   + (event.active_until.includes('Z')   || event.active_until.includes('+')   ? '' : 'Z')).getTime();
    if (now < start) return <V2GuestGate state="not-started" event={event} theme={theme} />;
    if (now >= end)  return <V2GuestGate state="ended"       event={event} theme={theme} />;
  }

  if (showPackageLimitError) {
    return (
      <GuestAccessErrorScreen
        title="Package limit exceeded"
        message="You have exceeded your package limit. Please contact help center."
        actionText="Contact help center"
        actionHref="/contact"
        theme={theme}
      />
    );
  }

  if (eventClosedMessage) {
    return (
      <GuestAccessErrorScreen
        title={eventClosedTitle}
        message={eventClosedMessage}
        actionText={eventClosedAction}
        actionHref="/"
        theme={theme}
      />
    );
  }

  return (
    <div className="guest-uploads" style={theme}>
      <PhotoViewerModal />
      <V2Header />

      <header className="guest-uploads-header">
        <div className="guest-uploads-header-container">
          <div className="guest-uploads-header-content">
            <div className="guest-uploads-header-info">
              <div className="guest-uploads-event-badge">
                <i className="fa-solid fa-sparkles"></i>
                <span>{event?.name || t('common.event')}</span>
              </div>
              <h1 className="guest-uploads-title">{t('guestUploads.myUploads')}</h1>
              <p className="guest-uploads-desc">
                {t('guestUploads.uploadsDesc')}
              </p>
            </div>

            <div className="guest-uploads-actions">
              <div className="guest-uploads-stat">
                <i className="fa-solid fa-images"></i>
                <div className="guest-uploads-stat-info">
                  <div className="guest-uploads-stat-value">{uploads.length}</div>
                  <div className="guest-uploads-stat-label">{t('guestUploads.totalItems')}</div>
                </div>
              </div>
              <button 
                className="guest-uploads-upload-btn"
                onClick={() => navigate(`/guest/${packedUid}`)}
              >
                <i className="fa-solid fa-cloud-arrow-up"></i>
                {t('guestUploads.uploadNew')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="guest-uploads-main">
        <div className="guest-uploads-main-container">
          <div className="guest-uploads-filter-bar">
            <div className="guest-uploads-filter-tabs">
              <button 
                className={`guest-uploads-filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                {t('guestUploads.allMedia')}
              </button>
              <button 
                className={`guest-uploads-filter-tab ${filter === 'photo' ? 'active' : ''}`}
                onClick={() => setFilter('photo')}
              >
                {t('guestUploads.photos')}
              </button>
              <button 
                className={`guest-uploads-filter-tab ${filter === 'video' ? 'active' : ''}`}
                onClick={() => setFilter('video')}
              >
                {t('guestUploads.videos')}
              </button>
            </div>
            <div className="guest-uploads-filter-hint">
              <i className="fa-solid fa-hand-pointer"></i>
              <span>{t('guestUploads.selectMoment')}</span>
            </div>
          </div>

          <div className="guest-uploads-grid" style={filteredUploads.length === 0 ? { columnCount: 1 } : {}}>
            {filteredUploads.length === 0 ? (
              <div className="guest-uploads-empty">
                <div className="guest-uploads-empty-icon">
                  <i className="fa-solid fa-images"></i>
                </div>
                <h3 className="guest-uploads-empty-title">{t('guestUploads.noUploadsYet')}</h3>
                <p className="guest-uploads-empty-desc">{t('guestUploads.startSharing')}</p>
              </div>
            ) : (
              filteredUploads.map((upload) => (
                <MediaCard
                  key={upload.uid}
                  uploaderName="guest-you"
                  uploadEntry={upload}
                  onFullscreen={() => openPhotoViewer(upload.uid)}
                />
              ))
            )}
          </div>

          {hasMore && (
            <div className="guest-uploads-load-more">
              <button className="guest-uploads-load-more-btn" onClick={loadMore} disabled={loadingMore}>
                <i className={`fa-solid ${loadingMore ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`}></i>
                {t('guestUploads.loadMoreMemories')}
              </button>
            </div>
          )}
        </div>
      </main>

      <V2Footer />
    </div>
  );
}

export default V2ParticipantUploads;
