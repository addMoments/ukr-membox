import { useRef } from 'react';
import { Link } from 'react-router-dom';
import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import FileInput from '../components/FileInput';
import '../v2-styles/GuestHome.css';
import { UploadEntry } from '../types/uploads';
// import { S3_ROOT } from '../consts';
import { GuestTheme, defaultGuestTheme } from '../types/guestTheme';
import { fonts } from '../types/fonts';
// import { getTimeAgo } from '../temp-ai-logic-and-data/time-ago';
// import MediaCard from '../v2-components/MediaCard';
import PhotoViewerModal from '../partials/PhotoViewerModal';
import { t } from '../packages/i18n';
import { textOr } from '../utils/admin_i18n';
import { AdvertorialCell, AdvertorialLayout, AdvertorialResponse } from '../types/advertorial';
import { GuestAlbum, albumCoverUrl } from '../types/albums';
import { packUUID as packedAlbumUid } from '../packages/uuid';
import GuestUploadModal, { GuestUploadModalHandle } from './GuestUploadModal';

export interface V2GuestHomeProps {
  bannerImageUrl: string | null;
  eventTitle: string;
  eventType: string;
  eventDate: string;
  eventLocation: string;
  welcomeMessage: string;
  eventInitials: string;
  recentUploads: UploadEntry[];
  packedUid: string;
  onFileSelect: (file: File) => void;
  onUploadComplete?: () => void;
  participantUid?: string;
  initialUploaderName?: string;
  onUploaderNameUpdate?: (name: string) => void;
  theme?: GuestTheme;
  font?: string;
  advertorial?: AdvertorialResponse | null;
  // Misafire gorunur albumler (RLS suzer: public + yukleme acik). Bos liste = yukleme kapali.
  albums?: GuestAlbum[];
  albumsLoaded?: boolean;
}

const ADVERTORIAL_CELL_COUNT: Record<AdvertorialLayout, number> = {
  none: 0,
  single: 1,
  '1x1': 1,
  '2x1': 2,
  '1x2': 2,
  '2x2': 4,
};

// Ne: Guest sayfasinda reklam grid'inin render edilip edilmeyecegini belirler.
// Nasil: Backend enabled, layout none kontrolu, cell sayisi ve image_url dolulugu birlikte degerlendirilir.
// Neden: Reklam kapaliysa veya config eksikse DOM'da bos alan birakmadan hicbir sey gostermemek.
const getRenderableAdvertorialCells = (advertorial?: AdvertorialResponse | null): AdvertorialCell[] => {
  if (!advertorial?.enabled) return [];
  const layout = advertorial.config?.layout;
  if (!layout || layout === 'none') return [];

  const requiredCount = ADVERTORIAL_CELL_COUNT[layout];
  const cells = advertorial.config?.cells || [];
  if (!requiredCount || cells.length !== requiredCount) return [];

  return cells
    .filter((cell) => cell.index >= 0 && cell.index < requiredCount && !!cell.image_url)
    .sort((a, b) => a.index - b.index);
};

function GuestAdvertorialGrid({ advertorial }: { advertorial?: AdvertorialResponse | null }) {
  const cells = getRenderableAdvertorialCells(advertorial);
  const layout = advertorial?.config?.layout;
  if (!layout || cells.length === 0 || cells.length !== ADVERTORIAL_CELL_COUNT[layout]) return null;

  return (
    <div className={`guest-advertorial-grid guest-advertorial-grid-${layout}`}>
      {cells.map((cell) => {
        const image = <img src={cell.image_url} alt="" loading="lazy" />;
        return (
          <div key={cell.index} className="guest-advertorial-cell">
            {cell.link_url ? (
              <a href={cell.link_url} target="_blank" rel="noopener noreferrer">
                {image}
              </a>
            ) : image}
          </div>
        );
      })}
    </div>
  );
}

function V2GuestHome({
  bannerImageUrl,
  eventTitle,
  eventType,
  eventDate,
  welcomeMessage,
  recentUploads,
  packedUid,
  onUploadComplete,
  participantUid,
  initialUploaderName,
  onUploaderNameUpdate,
  theme = defaultGuestTheme,
  font,
  advertorial,
  albums = [],
  albumsLoaded = false,
}: V2GuestHomeProps) {
  // Yukleme modali ayri bilesende (GuestUploadModal); dosyalar ref uzerinden verilir.
  const uploadModalRef = useRef<GuestUploadModalHandle>(null);

  const uploadPhotosAndVideosText = t('guest.uploadPhotosAndVideos');
  const uploadAudioMessageTextRaw = t('guest.uploadAudioMessage');
  const uploadAudioMessageText = uploadAudioMessageTextRaw === 'guest.uploadAudioMessage'
    ? (t('lang_code') === 'uk' ? 'Завантажити аудіо повідомлення' : 'Upload Audio Message')
    : uploadAudioMessageTextRaw;

  // Ne: Gorunur album yoksa (liste yuklendi ve bos) yukleme kapali demektir: General dahil
  //     her album misafire kapatilmis. Buton pasif, aciklama gosterilir.
  // Neden: Karar 12 — yuklemesi kapali album misafire hic gorunmez; hepsi kapaliysa
  //        misafirin yukleyecegi yer kalmaz.
  const uploadsClosed = albumsLoaded && albums.length === 0;
  const showAlbumCards = albums.length > 1;
  const formatAlbumDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr.length <= 10 ? dateStr + 'T00:00:00' : dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(t('lang_code'), { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // const openPhotoViewer = (uploadUid: string) => {
  //   const index = recentUploads.findIndex(u => u.uid === uploadUid);
  //   photoViewerState.items = recentUploads.map(upload => {
  //     const type = upload.upload_type === 'video' ? t('common.video') : t('common.photo');
  //     return {
  //       src: S3_ROOT + upload.value,
  //       title: t('guest.yourUpload'),
  //       tagline: `${type} · ${getTimeAgo(upload.created_at)}`,
  //       id: upload.uid,
  //       isVideo: upload.upload_type === 'video',
  //     };
  //   });
  //   photoViewerState.actions = [];
  //   photoViewerState.currentIndex = index >= 0 ? index : 0;
  //   photoViewerState.open = true;
  // };

  return (
    <div className="guest-home" style={{ ...theme, fontFamily: fonts.find(f => f.id === font)?.fontFamily }}>
      <PhotoViewerModal />

      <GuestUploadModal
        ref={uploadModalRef}
        packedUid={packedUid}
        albums={albums}
        participantUid={participantUid}
        initialUploaderName={initialUploaderName}
        onUploaderNameUpdate={onUploaderNameUpdate}
        onUploadComplete={onUploadComplete}
      />

      <V2Header />

      <main className="guest-home-main">
        {/* Unified Hero + Upload Card */}
        <section className="guest-home-hero guest-home-main-card">
          <div className="guest-home-hero-info-band-wrap">
            <div className="guest-home-hero-info-band">
              <h1 className="guest-home-hero-title">{eventTitle}</h1>
              <div className="guest-home-hero-meta">
                <div className="guest-home-hero-meta-item">
                  <i className="fa-regular fa-calendar" />
                  <span>{eventDate}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="guest-home-hero-image">
            {bannerImageUrl && (
              <img src={bannerImageUrl} alt={t('guest.eventAmbiance')} />
            )}
            <div className="guest-home-hero-image-overlay" />
            <span className="guest-home-hero-badge">{eventType}</span>
            <span className="guest-home-hero-date-badge">
              <i className="fa-regular fa-calendar" />
              <span>{eventDate}</span>
            </span>
          </div>

          <div className="guest-home-main-card-content">
            <section className="guest-home-upload">
              <div className="guest-home-upload-inner" style={{position: 'relative', zIndex: 1}}>

              {uploadsClosed ? (
                <div className="guest-home-uploads-closed" role="status">
                  <i className="fa-solid fa-lock" />
                  <span>{textOr('guest.album.noVisibleAlbums', 'Uploads are closed for this event right now.', 'Завантаження для цієї події зараз закрито.')}</span>
                </div>
              ) : (
                <FileInput onFile={(file) => uploadModalRef.current?.addFiles([file])} multiple accept="image/*,video/*">
                <button style={{marginBottom: '10px'}} className="guest-home-upload-btn">
                  <i className="fa-solid fa-camera-retro" />
                  <span>{uploadPhotosAndVideosText}</span>
                </button>
                </FileInput>
              )}

              <Link style={{textDecoration: 'none'}} to={`/guest/${packedUid}/guestbook`}>
                <button style={{marginBottom: '10px'}} className="guest-home-upload-btn" >
                  <i className="fa-solid fa-microphone-lines" />
                  <span>{uploadAudioMessageText}</span>
                </button>
              </Link>

              <Link style={{textDecoration: 'none'}} to={`/guest/${packedUid}/guestbook`}>
                <button className="guest-home-upload-btn" >
                  <i className="fa-solid fa-book" />
                  <span>{t('guest.signTheGuestbook')}</span>
                </button>
              </Link>

              {showAlbumCards && (
                <section className="guest-home-albums" aria-label={textOr('guest.album.sectionTitle', 'Albums', 'Альбоми')}>
                  <div className="guest-home-albums-header">
                    <h2 className="guest-home-albums-title">
                      <i className="fa-regular fa-folder-open" />
                      {textOr('guest.album.sectionTitle', 'Albums', 'Альбоми')}
                    </h2>
                    <p className="guest-home-albums-hint">
                      {textOr('guest.album.sectionHint', 'Choose an album to share your photos.', 'Оберіть альбом, щоб поділитися фото.')}
                    </p>
                  </div>
                  <div className="guest-home-albums-grid">
                    {albums.map((album) => {
                      const cover = albumCoverUrl(album);
                      const dateText = formatAlbumDate(album.album_date);
                      return (
                        <Link
                          key={album.uid}
                          to={`/guest/${packedUid}/album/${album.uid ? packedAlbumUid(album.uid) : ''}`}
                          className="guest-home-album-card"
                        >
                          <div className="guest-home-album-cover">
                            {cover
                              ? <img src={cover} alt="" loading="lazy" />
                              : <div className="guest-home-album-cover-placeholder"><i className="fa-regular fa-images" /></div>}
                          </div>
                          <div className="guest-home-album-body">
                            <span className="guest-home-album-name">{album.name}</span>
                            {(dateText || album.location) && (
                              <span className="guest-home-album-meta">
                                {dateText}{dateText && album.location ? ' · ' : ''}{album.location || ''}
                              </span>
                            )}
                            {album.description && (
                              <span className="guest-home-album-desc">{album.description}</span>
                            )}
                          </div>
                          <span className="guest-home-album-arrow"><i className="fa-solid fa-chevron-right" /></span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              <GuestAdvertorialGrid advertorial={advertorial} />

              {/* Welcome Message */}
              {welcomeMessage && (
                <div className="guest-home-welcome">
                  <span className="guest-home-welcome-icon">
                    <i className="fa-solid fa-quote-left" />
                  </span>
                  <p className="guest-home-welcome-text">"{welcomeMessage}"</p>
                </div>
              )}

              <div className="guest-home-upload-secure">
                <i className="fa-solid fa-lock" />
                <span>{t('guest.privateSecure')}</span>
              </div>
              </div>
            </section>
          </div>
        </section>

        {/* Latest Memories Section (disabled intentionally)
        <section className="guest-home-gallery">
          <div className="guest-home-gallery-header">
            <h3 className="guest-home-gallery-title">
              {t('guest.latestMemories')}
              <span className="guest-home-gallery-live-badge">
                <span className="guest-home-gallery-live-dot" />
                {t('guest.liveFeed')}
              </span>
            </h3>
            <Link to={`/guest/${packedUid}/uploads`} className="guest-home-gallery-view-all">
              {t('guest.viewAll')}
            </Link>
          </div>

          <div className="guest-home-gallery-grid">
            {recentUploads.length > 0 ? (
              <>
                {recentUploads.map((upload) => (
                  <MediaCard
                    key={upload.uid}
                    uploaderName={t('guest.you')}
                    uploadEntry={upload}
                    onFullscreen={() => openPhotoViewer(upload.uid)}
                  />
                ))}
                {recentUploads.length < 3 && (
                  <div className="guest-home-gallery-placeholder">
                    <div className="guest-home-gallery-placeholder-icon">
                      <i className="fa-solid fa-hourglass-half" />
                    </div>
                    <p className="guest-home-gallery-placeholder-text">
                      {t('guest.waitForMoments')}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="guest-home-gallery-empty">
                <div className="guest-home-gallery-empty-icon">
                  <i className="fa-regular fa-images" />
                </div>
                <p className="guest-home-gallery-empty-text">
                  {t('guest.noMemoriesYet')}
                </p>
              </div>
            )}
          </div>
        </section>
        */}
      </main>

      <V2Footer />
    </div>
  );
}

export default V2GuestHome;
