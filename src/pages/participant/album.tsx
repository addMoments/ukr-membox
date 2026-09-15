import { Link, useParams } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import V2Header from '../../v2-components/V2Header';
import V2Footer from '../../v2-components/V2Footer';
import FileInput from '../../components/FileInput';
import MediaCard from '../../v2-components/MediaCard';
import PhotoViewerModal, { photoViewerState } from '../../partials/PhotoViewerModal';
import V2GuestGate from '../../v2-partials/V2GuestGate';
import GuestAccessErrorScreen from '../../v2-partials/GuestAccessErrorScreen';
import GuestUploadModal, { GuestUploadModalHandle } from '../../v2-partials/GuestUploadModal';
import { unpackUUID } from '../../packages/uuid';
import { pgREST } from '../../client/postgrest';
import { whoAmI } from '../../client/auth';
import { Event } from '../../types/events';
import { UploadEntry } from '../../types/uploads';
import { GuestAlbum, albumCoverUrl } from '../../types/albums';
import { getGuestAlbumErrorCode, guestDownloadAlbumZip, guestGetAlbum, guestOpenAlbum } from '../../client/albums';
import { S3_ROOT } from '../../consts';
import { defaultGuestTheme } from '../../types/guestTheme';
import { fonts } from '../../types/fonts';
import { applyGuestFont } from '../../utils/applyGuestFont';
import { saveUrl } from '../../utils/download';
import { t } from '../../packages/i18n';
import { textOr } from '../../utils/admin_i18n';
import { getEventClosedMessage, isEventClosedError, isPackageLimitExceededError } from '../../utils/guestInitError';
import '../../v2-styles/GuestUploads.css';
import '../../v2-styles/GuestAlbum.css';

// Ne: Misafir album sayfasi: /guest/<event>/album/<album>.
// Nasil: Once membox-serv "open" ucu (kapali / passcode / tamam), sonra PostgREST'ten
//        album + event + (iki galeri anahtari aciksa) medya. Yukleme ayni modalla, album kilitli.
// Neden: Album linki/QR'i buraya iner; etkinlik UID'i URL'in ikinci segmentinde kalir ki
//        client/core.ts X-Event basligini oradan alsin.

type FilterType = 'all' | 'photo' | 'video';
type SortType = 'newest' | 'oldest' | 'type';
type PageStatus = 'loading' | 'ready' | 'closed' | 'passcode' | 'failed';
type AlbumUpload = UploadEntry & { participants?: { name?: string } | { name?: string }[] };

const PAGE_SIZE = 24;

const orderFor = (sort: SortType) => {
  if (sort === 'oldest') return 'order=created_at.asc,uid.asc';
  if (sort === 'type') return 'order=upload_type.asc,created_at.desc,uid.desc';
  return 'order=created_at.desc,uid.desc';
};

const typeFor = (filter: FilterType) => {
  if (filter === 'photo') return 'eq.photo';
  if (filter === 'video') return 'eq.video';
  return 'in.(photo,video)';
};

function ParticipantAlbum() {
  const { uid: packedUid, albumUid: packedAlbumUid } = useParams<{ uid: string; albumUid: string }>();
  const eventUid = unpackUUID(packedUid || 'a');
  const albumUid = unpackUUID(packedAlbumUid || 'a');

  const [status, setStatus] = useState<PageStatus>('loading');
  const [event, setEvent] = useState<Event>({} as Event);
  const [album, setAlbum] = useState<GuestAlbum | null>(null);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [uploads, setUploads] = useState<AlbumUpload[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('newest');
  const [participantUid, setParticipantUid] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [passcodeBusy, setPasscodeBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [showPackageLimitError, setShowPackageLimitError] = useState(false);
  const [eventClosedMessage, setEventClosedMessage] = useState('');
  const uploadModalRef = useRef<GuestUploadModalHandle>(null);
  const passcodeRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);

  const theme = event.settings?.colors || defaultGuestTheme;
  const langCode = t('lang_code');
  const isUk = langCode === 'uk';

  const fetchPage = useCallback(async (f: FilterType, s: SortType, offset: number): Promise<AlbumUpload[]> => {
    return pgREST(
      `/uploads?album_uid=eq.${albumUid}&trashed_at=is.null&upload_type=${typeFor(f)}&${orderFor(s)}&limit=${PAGE_SIZE}&offset=${offset}&select=*,participants(name)`
    );
  }, [albumUid]);

  const bootstrap = useCallback(async (passcode?: string) => {
    if (!packedUid || !packedAlbumUid) return;
    try {
      const user = await whoAmI();
      setParticipantUid(user.ui);

      let openResult;
      try {
        openResult = await guestOpenAlbum(albumUid, passcode);
      } catch (err) {
        const code = getGuestAlbumErrorCode(err);
        if (code === 'PASSCODE_REQUIRED') {
          setStatus('passcode');
          return;
        }
        if (code === 'PASSCODE_INVALID') {
          setStatus('passcode');
          setPasscodeError(textOr('guest.album.passcodeWrong', 'That passcode is not correct.', 'Пароль неправильний.'));
          return;
        }
        if (code === 'ALBUM_CLOSED' || code === 'ALBUM_NOT_OPENED') {
          setStatus('closed');
          return;
        }
        throw err;
      }

      const [eventData, albumData, participantData] = await Promise.all([
        pgREST(`/events_public?uid=eq.${eventUid}`),
        guestGetAlbum(albumUid),
        pgREST(`/participants?uid=eq.${user.ui}&select=name`),
      ]);

      if (!eventData || !eventData[0] || !albumData) {
        setStatus('closed');
        return;
      }

      const ev: Event = eventData[0];
      setEvent(ev);
      applyGuestFont(ev.settings?.font);
      setAlbum(albumData);
      const currentName = participantData?.[0]?.name || '';
      if (currentName && !currentName.startsWith('guest-')) {
        setParticipantName(currentName);
      }

      const visible = !!ev.settings?.guest_gallery && !!albumData.guest_view && !!openResult?.guest_view;
      setGalleryVisible(visible);
      if (visible) {
        const requestId = ++requestIdRef.current;
        const first = await fetchPage('all', 'newest', 0);
        if (requestId === requestIdRef.current) {
          setUploads(first);
          setHasMore(first.length === PAGE_SIZE);
        }
      }
      setStatus('ready');
    } catch (err) {
      if (isPackageLimitExceededError(err)) {
        setShowPackageLimitError(true);
        return;
      }
      if (isEventClosedError(err)) {
        setEventClosedMessage(getEventClosedMessage(err) || (isUk ? 'Цю подію закрито.' : 'This event is closed.'));
        return;
      }
      console.error('[guest-album] bootstrap failed', err);
      setStatus('failed');
    }
  }, [albumUid, eventUid, fetchPage, isUk, packedAlbumUid, packedUid]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Filtre / siralama degisince ilk sayfayi yeniden cek.
  const reload = useCallback(async (f: FilterType, s: SortType) => {
    if (!galleryVisible) return;
    const requestId = ++requestIdRef.current;
    const first = await fetchPage(f, s, 0);
    if (requestId !== requestIdRef.current) return;
    setUploads(first);
    setHasMore(first.length === PAGE_SIZE);
  }, [fetchPage, galleryVisible]);

  const changeFilter = (f: FilterType) => { setFilter(f); reload(f, sort); };
  const changeSort = (s: SortType) => { setSort(s); reload(filter, s); };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const more = await fetchPage(filter, sort, uploads.length);
      setUploads(prev => {
        const seen = new Set(prev.map(u => u.uid));
        return [...prev, ...more.filter(u => !seen.has(u.uid))];
      });
      setHasMore(more.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleUploadComplete = () => {
    reload(filter, sort);
  };

  const handlePasscodeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = passcodeRef.current?.value?.trim() || '';
    if (!value) return;
    setPasscodeError('');
    setPasscodeBusy(true);
    try {
      await bootstrap(value);
    } finally {
      setPasscodeBusy(false);
    }
  };

  const uploaderName = (upload: AlbumUpload) => {
    const p = Array.isArray(upload.participants) ? upload.participants[0] : upload.participants;
    return p?.name?.trim() || 'guest-';
  };

  const downloadOne = (upload: AlbumUpload) => {
    const url = S3_ROOT + upload.value;
    const filename = upload.value.split('/').pop() || 'download';
    saveUrl(url, filename).catch(() => window.open(url, '_blank'));
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(langCode, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatAlbumDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr.length <= 10 ? dateStr + 'T00:00:00' : dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(langCode, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const openPhotoViewer = (uploadUid: string) => {
    const index = uploads.findIndex(u => u.uid === uploadUid);
    photoViewerState.items = uploads.map(upload => {
      const name = uploaderName(upload);
      const type = upload.upload_type === 'video' ? t('common.video') : t('common.photo');
      return {
        src: S3_ROOT + upload.value,
        title: name.startsWith('guest-') ? t('common.unknown') : name,
        tagline: `${type} · ${formatDate(upload.created_at)}`,
        id: upload.uid,
        isVideo: upload.upload_type === 'video',
      };
    });
    photoViewerState.actions = [
      { icon: 'fa-solid fa-download', onClick: (id) => { const u = uploads.find(x => x.uid === id); if (u) downloadOne(u); } },
    ];
    photoViewerState.currentIndex = index >= 0 ? index : 0;
    photoViewerState.open = true;
  };

  const handleDownloadAll = async () => {
    if (!album || downloading) return;
    setDownloading(true);
    setDownloadError('');
    try {
      await guestDownloadAlbumZip(album.uid, `${album.name || 'album'}.zip`);
    } catch (err) {
      console.error('[guest-album] zip failed', err);
      setDownloadError(textOr('guest.album.downloadFailed', 'Download failed. Please try again.', 'Не вдалося завантажити. Спробуйте ще раз.'));
    } finally {
      setDownloading(false);
    }
  };

  // --- Etkinlik kapisi (participant/index.tsx ile ayni kurallar)
  if (event.uid && (!event.activation_date || !event.active_until)) {
    return <V2GuestGate state="not-started" event={event} theme={theme} />;
  }
  if (event.uid && event.activation_date && event.active_until) {
    const now = Date.now();
    const start = new Date(event.activation_date + (event.activation_date.includes('Z') || event.activation_date.includes('+') ? '' : 'Z')).getTime();
    const end = new Date(event.active_until + (event.active_until.includes('Z') || event.active_until.includes('+') ? '' : 'Z')).getTime();
    if (now < start) return <V2GuestGate state="not-started" event={event} theme={theme} />;
    if (now >= end) return <V2GuestGate state="ended" event={event} theme={theme} />;
  }

  if (showPackageLimitError) {
    return (
      <GuestAccessErrorScreen
        title={textOr('guest.limitReachedTitle', 'Participant limit reached', 'Ліміт учасників вичерпано')}
        message={textOr('guest.limitReachedDescription', 'This event has reached the new participant limit.', 'Для цієї події вичерпано ліміт нових учасників.')}
        actionText={isUk ? 'Звʼязатися з підтримкою' : 'Contact help center'}
        actionHref="/contact"
        theme={theme}
      />
    );
  }

  if (eventClosedMessage) {
    return (
      <GuestAccessErrorScreen
        title={textOr('guestAccessError.eventClosedTitle', 'This event is closed', 'Цю подію закрито')}
        message={eventClosedMessage}
        actionText={textOr('guestAccessError.eventClosedAction', 'Go to home', 'На головну')}
        actionHref="/"
        theme={theme}
      />
    );
  }

  if (status === 'closed') {
    return (
      <GuestAccessErrorScreen
        title={textOr('guest.album.closedTitle', 'This album is not available', 'Цей альбом недоступний')}
        message={textOr('guest.album.closedMessage', 'The host has closed this album.', 'Організатор закрив цей альбом.')}
        actionText={textOr('guest.album.backToEvent', 'Back to event', 'Назад до події')}
        actionHref={`/guest/${packedUid}`}
        theme={theme}
      />
    );
  }

  if (status === 'failed') {
    return (
      <GuestAccessErrorScreen
        title={textOr('guestAccessError.loadFailedTitle', 'Could not load the event', 'Не вдалося завантажити подію')}
        message={textOr('guestAccessError.loadFailedMessage', 'Something went wrong while loading this page. Please check your connection and try again.', 'Під час завантаження сторінки сталася помилка. Перевірте зʼєднання та спробуйте ще раз.')}
        actionText={textOr('guestAccessError.loadFailedAction', 'Try again', 'Спробувати ще раз')}
        onActionClick={() => { setStatus('loading'); bootstrap(); }}
        theme={theme}
      />
    );
  }

  if (status === 'passcode') {
    return (
      <div className="guest-album-lock" style={theme}>
        <V2Header />
        <main className="guest-album-lock-main">
          <form className="guest-album-lock-card" onSubmit={handlePasscodeSubmit}>
            <div className="guest-album-lock-icon"><i className="fa-solid fa-lock" /></div>
            <h1 className="guest-album-lock-title">{textOr('guest.album.passcodeTitle', 'Enter passcode', 'Введіть пароль')}</h1>
            <p className="guest-album-lock-text">{textOr('guest.album.passcodeMessage', 'This album is protected. Ask the host for the passcode.', 'Цей альбом захищено. Запитайте пароль у організатора.')}</p>
            <input
              ref={passcodeRef}
              type="text"
              className="guest-album-lock-input"
              placeholder={textOr('guest.album.passcodePlaceholder', 'Passcode', 'Пароль')}
              autoComplete="off"
              autoFocus
              maxLength={32}
              disabled={passcodeBusy}
            />
            {passcodeError && <p className="guest-album-lock-error">{passcodeError}</p>}
            <button type="submit" className="guest-album-btn primary" disabled={passcodeBusy} style={{ justifyContent: 'center' }}>
              <i className="fa-solid fa-unlock" />
              {textOr('guest.album.passcodeSubmit', 'Open album', 'Відкрити альбом')}
            </button>
            <Link to={`/guest/${packedUid}`} className="guest-album-back" style={{ margin: '0 auto' }}>
              <i className="fa-solid fa-arrow-left" />
              {textOr('guest.album.backToEvent', 'Back to event', 'Назад до події')}
            </Link>
          </form>
        </main>
        <V2Footer />
      </div>
    );
  }

  if (status === 'loading' || !album) {
    return <div className="guest-uploads" style={defaultGuestTheme}><V2Header /></div>;
  }

  const cover = albumCoverUrl(album);
  const albumDate = formatAlbumDate(album.album_date);
  const canDownloadAll = galleryVisible && album.guest_download_all;

  return (
    <div className="guest-uploads" style={{ ...theme, fontFamily: fonts.find(f => f.id === event.settings?.font)?.fontFamily }}>
      <PhotoViewerModal />
      <GuestUploadModal
        ref={uploadModalRef}
        packedUid={packedUid || ''}
        albums={[album]}
        initialAlbumUid={album.uid}
        lockAlbum
        participantUid={participantUid}
        initialUploaderName={participantName}
        onUploaderNameUpdate={setParticipantName}
        onUploadComplete={handleUploadComplete}
      />
      <V2Header />

      <header className="guest-album-header">
        <div className="guest-album-header-container">
          <Link to={`/guest/${packedUid}`} className="guest-album-back">
            <i className="fa-solid fa-arrow-left" />
            {event.name || textOr('guest.album.backToEvent', 'Back to event', 'Назад до події')}
          </Link>

          <div className="guest-album-hero">
            <div className="guest-album-cover">
              {cover
                ? <img src={cover} alt={album.name} />
                : <div className="guest-album-cover-placeholder"><i className="fa-regular fa-images" /></div>}
            </div>
            <div className="guest-album-info">
              <h1 className="guest-album-title">{album.name}</h1>
              {(albumDate || album.location) && (
                <div className="guest-album-meta">
                  {albumDate && <span><i className="fa-regular fa-calendar" />{albumDate}</span>}
                  {album.location && <span><i className="fa-solid fa-location-dot" />{album.location}</span>}
                </div>
              )}
              {album.description && <p className="guest-album-desc">{album.description}</p>}

              <div className="guest-album-actions">
                <FileInput onFile={(file) => uploadModalRef.current?.addFiles([file])} multiple accept="image/*,video/*">
                  <button type="button" className="guest-album-btn primary">
                    <i className="fa-solid fa-camera-retro" />
                    {textOr('guest.album.uploadHere', 'Upload to this album', 'Завантажити в цей альбом')}
                  </button>
                </FileInput>
                {canDownloadAll && (
                  <button type="button" className="guest-album-btn secondary" onClick={handleDownloadAll} disabled={downloading}>
                    <i className={`fa-solid ${downloading ? 'fa-spinner fa-spin' : 'fa-file-zipper'}`} />
                    {downloading
                      ? textOr('guest.album.downloading', 'Preparing your download…', 'Готуємо завантаження…')
                      : textOr('guest.album.downloadAll', 'Download all', 'Завантажити все')}
                  </button>
                )}
              </div>
              {downloadError && <p className="guest-album-lock-error">{downloadError}</p>}
              {!galleryVisible && (
                <p className="guest-album-note">
                  <i className="fa-solid fa-eye-slash" />
                  {textOr('guest.album.viewOnlyHost', 'Photos in this album are visible only to the host.', 'Фото в цьому альбомі бачить лише організатор.')}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {galleryVisible && (
        <main className="guest-uploads-main">
          <div className="guest-uploads-main-container">
            <div className="guest-uploads-filter-bar">
              <div className="guest-uploads-filter-tabs">
                <button className={`guest-uploads-filter-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => changeFilter('all')}>
                  {t('guestUploads.allMedia')}
                </button>
                <button className={`guest-uploads-filter-tab ${filter === 'photo' ? 'active' : ''}`} onClick={() => changeFilter('photo')}>
                  {t('guestUploads.photos')}
                </button>
                <button className={`guest-uploads-filter-tab ${filter === 'video' ? 'active' : ''}`} onClick={() => changeFilter('video')}>
                  {t('guestUploads.videos')}
                </button>
              </div>
              <div className="guest-album-sort">
                <button type="button" className={sort === 'newest' ? 'active' : ''} onClick={() => changeSort('newest')}>
                  {textOr('guest.album.sortNewest', 'Newest', 'Найновіші')}
                </button>
                <button type="button" className={sort === 'oldest' ? 'active' : ''} onClick={() => changeSort('oldest')}>
                  {textOr('guest.album.sortOldest', 'Oldest', 'Найстаріші')}
                </button>
                <button type="button" className={sort === 'type' ? 'active' : ''} onClick={() => changeSort('type')}>
                  {textOr('guest.album.sortByType', 'Photos first', 'Спочатку фото')}
                </button>
              </div>
            </div>

            <div className="guest-uploads-grid" style={uploads.length === 0 ? { columnCount: 1 } : {}}>
              {uploads.length === 0 ? (
                <div className="guest-uploads-empty">
                  <div className="guest-uploads-empty-icon"><i className="fa-solid fa-images" /></div>
                  <h3 className="guest-uploads-empty-title">{textOr('guest.album.empty', 'No photos yet. Be the first to share!', 'Ще немає фото. Будьте першим!')}</h3>
                </div>
              ) : (
                uploads.map((upload) => (
                  <MediaCard
                    key={upload.uid}
                    uploaderName={uploaderName(upload)}
                    uploadEntry={upload}
                    onFullscreen={() => openPhotoViewer(upload.uid)}
                    actions={[
                      { variant: 'icontext', text: '', icon: 'fa-solid fa-download', title: textOr('guest.album.download', 'Download', 'Завантажити'), onClick: () => downloadOne(upload) },
                    ]}
                  />
                ))
              )}
            </div>

            {hasMore && (
              <div className="guest-uploads-load-more">
                <button className="guest-uploads-load-more-btn" onClick={loadMore} disabled={loadingMore}>
                  <i className={`fa-solid ${loadingMore ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`} />
                  {t('guestUploads.loadMoreMemories')}
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      <V2Footer />
    </div>
  );
}

export default ParticipantAlbum;
