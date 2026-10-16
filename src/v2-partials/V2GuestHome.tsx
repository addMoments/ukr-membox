import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { guestCanUploadTo, guestOpenedAlbumUids } from '../client/albums';
import { packUUID as packedAlbumUid } from '../packages/uuid';
import GuestUploadModal, { GuestUploadModalHandle } from './GuestUploadModal';
import { ArrowRightIcon, CalendarIcon, CameraIcon, CheckIcon, LockFilledIcon, MessageCircleIcon, MicIcon } from '../v2-components/GuestLineIcons';

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
  // Misafire gorunur albumler (RLS suzer: public + protected(kilitli) + linkten acilmis private;
  // yuklemesi kapali VE galerisi gorunmeyen albumler listeye girmez).
  albums?: GuestAlbum[];
  albumsLoaded?: boolean;
  // Etkinligin "Guests can view the gallery" anahtari (events_public.settings.guest_gallery).
  galleryOn?: boolean;
  // Album basina misafirin okuyabildigi medya adedi (RLS suzer); "Moments N" sayaci bundan.
  albumMediaCounts?: Record<string, number> | null;
}

// Misafir ana sayfasinda "Show all albums"a basilmadan gorunen album sayisi.
const ALBUM_PREVIEW_COUNT = 3;

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
    <section className="guest-advertorial">
      <span className="guest-advertorial-label">{textOr('guest.home.sponsored', 'Promotions', 'Промоції')}</span>
      <div className={`guest-advertorial-grid guest-advertorial-grid-${layout}`}>
        {cells.map((cell) => {
          // Hucre tasarimdaki 2:1 sekilde; reklam her zaman butun gorunur. Baska oranda (eski
          // yonergedeki 16:9) yanlarda kalan ince bosluk gorselin kendi sol / sag kenar seridinin
          // uzatilmasiyla dolar; duz zeminli reklamlarda dikis gorunmez.
          const image = (
            <>
              <span className="guest-advertorial-edge left" aria-hidden="true"><img src={cell.image_url} alt="" loading="lazy" /></span>
              <span className="guest-advertorial-edge right" aria-hidden="true"><img src={cell.image_url} alt="" loading="lazy" /></span>
              <img className="guest-advertorial-img" src={cell.image_url} alt="" loading="lazy" />
            </>
          );
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
    </section>
  );
}

// Ne: Hostun karsilama metni; en fazla 3 satir gorunur, tasarsa "Більше" ile acilir.
// Neden: Onayli tasarimda baslik, metin, butonlar, 4 reklam ve albumlerin basi tek ekrana
//        sigmali. Host formu da 3 satiri asan metni kabul etmiyor (WELCOME_MAX_LINES); bu
//        kesme, sinirdan once yazilmis uzun metinler ve daha genis bir yazi tipi icin.
function GuestWelcomeText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (el && !expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    window.addEventListener('resize', measure);
    // Misafir yazi tipi sonradan yuklenince satir sayisi degisebilir.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener('resize', measure);
  }, [text, expanded]);

  return (
    <div className="guest-home-welcome-wrap">
      <p ref={ref} className={`guest-home-welcome${expanded ? '' : ' clamped'}`}>{text}</p>
      {(overflows || expanded) && (
        <button type="button" className="guest-home-welcome-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded
            ? textOr('guest.album.readLess', 'Show less', 'Згорнути')
            : textOr('guest.album.readMore', 'Show more', 'Більше')}
        </button>
      )}
    </div>
  );
}

function V2GuestHome({
  bannerImageUrl,
  eventTitle,
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
  galleryOn = false,
  albumMediaCounts = null,
}: V2GuestHomeProps) {
  // Yukleme modali ayri bilesende (GuestUploadModal); dosyalar ref uzerinden verilir.
  const uploadModalRef = useRef<GuestUploadModalHandle>(null);

  // Ne: Token'daki "al" claim'i — misafirin passcode ile / linkten actigi albumler.
  // Neden: Protected album listede kilitli gorunur; acilmamissa yukleme hedefi olamaz ve
  //        karti kilit ikonuyla cikar. Album listesi degisince (passcode girildi, sayfaya
  //        donuldu) token da degismis olabilir, o yuzden albums'a bagli.
  //        Bagimlilik dizi referansi degil UID listesi: prop verilmediginde varsayilan []
  //        her render'da yeni nesne olur ve effect sonsuz donguye girerdi.
  const [openedAlbums, setOpenedAlbums] = useState<Set<string>>(() => new Set());
  const albumKey = albums.map((album) => album.uid).join(',');
  useEffect(() => {
    let active = true;
    guestOpenedAlbumUids().then((set) => { if (active) setOpenedAlbums(set); });
    return () => { active = false; };
  }, [albumKey]);

  // Ne: Yukleme hedefi olabilecek albumler: yukleme acik + (public | acilmis).
  //     Hic yoksa (liste yuklendi ve bos) yukleme kapali: buton pasif, aciklama gosterilir.
  // Neden: 2026-09-15 v2 — yuklemesi kapali album artik gizlenmiyor (galeri gorunurse
  //        listede kalir), bu yuzden "yukleme kapali" karari listeden degil bu alt kumeden verilir.
  const uploadableAlbums = albums.filter((album) => guestCanUploadTo(album, openedAlbums));
  const uploadsClosed = albumsLoaded && uploadableAlbums.length === 0;
  // Yalnizca General varken kart gizliydi; fotograflari gorulebiliyorsa misafirin galeriye tek yolu bu kart
  // (AM-08: iki anahtar da acikken tek albumlu etkinlikte misafir fotograflara ulasamiyordu).
  const showAlbumCards = albums.length > 1
    || albums.some((album) => !album.is_default)
    || (galleryOn && albums.some((album) => album.guest_view));
  // Ilk 3 album gorunur; fazlasi varsa "Show all albums N" butonu listeyi yerinde acar.
  const [albumsExpanded, setAlbumsExpanded] = useState(false);
  const hasHiddenAlbums = albums.length > ALBUM_PREVIEW_COUNT && !albumsExpanded;
  const visibleAlbums = hasHiddenAlbums ? albums.slice(0, ALBUM_PREVIEW_COUNT) : albums;
  const isLocked = (album: GuestAlbum) => album.privacy === 'protected' && !openedAlbums.has(album.uid);
  // Ne: "Moments N" — misafirin acip bakabildigi albumlerdeki foto + video sayisi.
  // Neden: Galeri kapaliyken misafir yalnizca kendi yuklediklerini okuyabilir; o sayi
  //        etkinligin anlari gibi okunmasin diye sayac hic gosterilmez.
  const momentsCount = galleryOn && albumMediaCounts
    ? albums
      .filter((album) => album.guest_view && !isLocked(album))
      .reduce((sum, album) => sum + (albumMediaCounts[album.uid] || 0), 0)
    : null;
  const formatAlbumDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr.length <= 10 ? dateStr + 'T00:00:00' : dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(t('lang_code'), { year: 'numeric', month: 'short', day: 'numeric' });
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
        albums={uploadableAlbums}
        participantUid={participantUid}
        initialUploaderName={initialUploaderName}
        onUploaderNameUpdate={onUploaderNameUpdate}
        onUploadComplete={onUploadComplete}
      />

      <V2Header />

      <main className="guest-home-main">
        <section className="guest-home-hero">
          <div className="guest-home-hero-image">
            {bannerImageUrl && (
              <img src={bannerImageUrl} alt={t('guest.eventAmbiance')} />
            )}
            <div className="guest-home-hero-image-overlay" />
            {eventDate && (
              <span className="guest-home-hero-date">
                <CalendarIcon size={18} strokeWidth={1.6} />
                <span>{eventDate}</span>
              </span>
            )}
            <h1 className="guest-home-hero-title">{eventTitle}</h1>
          </div>
        </section>

        {welcomeMessage && <GuestWelcomeText text={welcomeMessage} />}

        <section className="guest-home-actions">
          {uploadsClosed ? (
            <div className="guest-home-uploads-closed" role="status">
              <i className="fa-solid fa-lock" />
              <span>{textOr('guest.album.noVisibleAlbums', 'Uploads are closed for this event right now.', 'Завантаження для цієї події зараз закрито.')}</span>
            </div>
          ) : (
            // AM-06 "35 dosyaya kadar" notu onayli tasarimda yok; yukleme penceresinde
            // ("N файлів · до 35 за раз") ve album sayfasinda gorunmeye devam ediyor.
            <FileInput onFile={(file) => uploadModalRef.current?.addFiles([file])} multiple accept="image/*,video/*">
              <button type="button" className="guest-home-upload-btn">
                <CameraIcon size={20} strokeWidth={1.75} className="guest-home-upload-btn-icon" />
                <span className="guest-home-upload-btn-label">
                  {textOr('guest.home.uploadPhotosAndVideos', 'Upload Photos & Videos', 'Завантажити фото та відео')}
                </span>
                <span className="guest-home-btn-arrow"><ArrowRightIcon size={22} strokeWidth={1.75} /></span>
              </button>
            </FileInput>
          )}

          {/* Ses kaydi ve ani defteri ayni sayfada (guestbook); iki giris de oraya gider. */}
          <div className="guest-home-secondary-actions">
            <Link className="guest-home-secondary-btn" to={`/guest/${packedUid}/guestbook`}>
              <MicIcon size={18} strokeWidth={1.75} className="guest-home-secondary-btn-icon" />
              <span className="guest-home-secondary-btn-label">{textOr('guest.home.audio', 'Audio', 'Аудіо')}</span>
              <ArrowRightIcon size={20} strokeWidth={1.75} className="guest-home-secondary-btn-arrow" />
            </Link>
            <Link className="guest-home-secondary-btn guest-home-secondary-btn-guestbook" to={`/guest/${packedUid}/guestbook`}>
              <MessageCircleIcon size={18} strokeWidth={1.75} className="guest-home-secondary-btn-icon" />
              <span className="guest-home-secondary-btn-label">{textOr('guest.home.guestbook', 'Guestbook', 'Побажання')}</span>
              <ArrowRightIcon size={20} strokeWidth={1.75} className="guest-home-secondary-btn-arrow" />
            </Link>
          </div>

          <p className="guest-home-secure">
            <span className="guest-home-secure-check"><CheckIcon size={9} strokeWidth={3.5} /></span>
            <span className="guest-home-secure-lock"><LockFilledIcon size={11} strokeWidth={2.5} /></span>
            <span>{textOr('guest.home.privateSecure', '100% private and secure. No account required.', '100% приватно і безпечно. Без реєстрації.')}</span>
          </p>
        </section>

        <GuestAdvertorialGrid advertorial={advertorial} />

        {showAlbumCards && (
          <section className="guest-home-albums" aria-label={textOr('guest.album.sectionTitle', 'Albums', 'Альбоми')}>
            <div className="guest-home-albums-header">
              <h2 className="guest-home-albums-title">
                {textOr('guest.album.sectionTitle', 'Albums', 'Альбоми')}
              </h2>
              {momentsCount !== null && (
                <span className="guest-home-albums-moments">
                  {textOr('guest.album.moments', 'Moments', 'Моменти')}
                  <strong>{momentsCount}</strong>
                </span>
              )}
            </div>
            <div className="guest-home-albums-grid">
              {visibleAlbums.map((album) => {
                const cover = albumCoverUrl(album);
                const dateText = formatAlbumDate(album.album_date);
                const locked = isLocked(album);
                return (
                  <Link
                    key={album.uid}
                    to={`/guest/${packedUid}/album/${album.uid ? packedAlbumUid(album.uid) : ''}`}
                    className={`guest-home-album-card${locked ? ' locked' : ''}`}
                  >
                    <div className="guest-home-album-cover">
                      {cover
                        ? <img src={cover} alt="" loading="lazy" />
                        : <div className="guest-home-album-cover-placeholder"><i className="fa-regular fa-images" /></div>}
                      {locked && (
                        <span className="guest-home-album-lock" aria-hidden="true"><i className="fa-solid fa-lock" /></span>
                      )}
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
                      {locked ? (
                        <span className="guest-home-album-state">
                          <i className="fa-solid fa-lock" />
                          {textOr('guest.album.passcodeNeeded', 'Passcode required', 'Потрібен пароль')}
                        </span>
                      ) : !album.guest_upload ? (
                        <span className="guest-home-album-state">
                          <i className="fa-solid fa-eye" />
                          {textOr('guest.album.viewOnly', 'View only', 'Лише перегляд')}
                        </span>
                      ) : null}
                    </div>
                    <span className="guest-home-album-arrow"><ArrowRightIcon size={18} strokeWidth={1.75} /></span>
                  </Link>
                );
              })}
            </div>
            {hasHiddenAlbums && (
              <button
                type="button"
                className="guest-home-albums-show-all"
                onClick={() => setAlbumsExpanded(true)}
                aria-expanded={false}
              >
                <i className="fa-solid fa-table-cells-large" />
                <span className="guest-home-albums-show-all-label">
                  {textOr('guest.album.showAllAlbums', 'Show all albums', 'Відобразити усі альбоми')}
                </span>
                <span className="guest-home-albums-show-all-count">{albums.length}</span>
                <span className="guest-home-albums-show-all-arrow"><ArrowRightIcon size={18} strokeWidth={1.75} /></span>
              </button>
            )}
          </section>
        )}

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
