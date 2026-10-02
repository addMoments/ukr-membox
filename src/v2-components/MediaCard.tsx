import { useEffect, useRef, useState } from 'react';
import '../v2-styles/MediaCard.css';
import { Action } from '../types/button';
import { UploadEntry } from '../types/uploads';
import { getTimeAgo } from '../temp-ai-logic-and-data/time-ago';
import { S3_ROOT } from '../consts';
import { textOr } from '../utils/admin_i18n';

type IconTextAction = Action & { variant: 'icontext'; title?: string };

interface MediaCardProps {
  uploaderName: string;
  actions?: IconTextAction[];
  uploadEntry: UploadEntry;
  onFullscreen: () => void;
  // Sol ustte kucuk etiket (album adi gibi). Bos ise cizilmez.
  badge?: string;
  // Coklu secim modu: kart tiklaninca tam ekran yerine secim degisir.
  selectable?: boolean;
  selected?: boolean;
  onSelectToggle?: () => void;
}

// Ne: Kartin medya durumu (AM-03 / AM-02).
//   loading — iskelet gorunur, dosya yukleniyor (fotograf ekrana yaklasinca yuklenir)
//   ready   — fotograf / videonun ilk karesi gorunur
//   error   — dosya acilamadi: "tekrar dene"li ayri bir durum; video icin "oynatilamiyor"
// Neden: Galeri yuklenirken kartlar sifir yukseklikle baslayip ziplayarak "bozuk" gorunuyordu;
//        acilamayan video oynatilabilir gibi duruyor, tiklayan misafir bos bir oynaticiyla kaliyordu.
type MediaState = 'loading' | 'ready' | 'error';

// Video bu surede ust bilgisini de getiremezse "oynatilamiyor" sayilir; sonsuz yukleniyor gibi kalmasin.
const VIDEO_TIMEOUT_MS = 60000;

const formatDuration = (seconds: number) => {
  if (!isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

function MediaCard({
  uploaderName = "guest-",
  actions = [],
  uploadEntry,
  onFullscreen,
  badge,
  selectable = false,
  selected = false,
  onSelectToggle,
}: MediaCardProps) {
  const isVideo = uploadEntry.upload_type === 'video';
  const mediaUrl = S3_ROOT + uploadEntry.value;
  const [state, setState] = useState<MediaState>('loading');
  // Tekrar denemede <img>/<video> yeniden kurulur (key), istek yeniden gider.
  const [attempt, setAttempt] = useState(0);
  const [duration, setDuration] = useState('');
  // Video ust bilgisi yalnizca kart ekrana yaklasinca istenir (fotograflarda bunu loading="lazy" yapar).
  const [inView, setInView] = useState(!isVideo);
  const mediaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVideo || inView) return undefined;
    const el = mediaRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setInView(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isVideo, inView]);

  useEffect(() => {
    if (!isVideo || !inView || state !== 'loading') return undefined;
    const timer = setTimeout(() => setState('error'), VIDEO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isVideo, inView, state, attempt]);

  const retry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState('loading');
    setAttempt(a => a + 1);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const initials = getInitials(uploaderName);

  const isAnon = uploaderName.startsWith("guest-");

  const handleOverlayClick = () => {
    if (selectable) {
      onSelectToggle?.();
      return;
    }
    onFullscreen();
  };

  return (
    <div className={`media-card${selectable ? ' media-card--selectable' : ''}${selected ? ' media-card--selected' : ''}`}>
      {isVideo && (
        <div className="media-card-video-badge">
          <i className="fa-solid fa-video"></i>
        </div>
      )}
      {badge && (
        <div className="media-card-badge" title={badge}>
          <i className="fa-regular fa-folder-open"></i>
          <span>{badge}</span>
        </div>
      )}
      {selectable && (
        <button
          type="button"
          className={`media-card-select${selected ? ' is-selected' : ''}`}
          onClick={(e) => { e.stopPropagation(); onSelectToggle?.(); }}
          aria-pressed={selected}
        >
          <i className={`fa-solid ${selected ? 'fa-circle-check' : 'fa-circle'}`}></i>
        </button>
      )}
      {actions.length > 0 && !selectable && (
        <div className="media-card-actions">
          {actions.map((action, idx) => (
            <button key={idx} className="media-card-action-btn" onClick={action.onClick} title={action.title}>
              <i className={action.icon}></i>
            </button>
          ))}
        </div>
      )}
      <div ref={mediaRef} className={`media-card-media${state === 'loading' ? ' is-loading' : ''}`}>
        {state === 'error' ? (
          <div className="media-card-error" role="status">
            <i className={`fa-solid ${isVideo ? 'fa-video-slash' : 'fa-image'}`}></i>
            <span>{isVideo
              ? textOr('media.videoUnplayable', "This video can't be played here", 'Це відео тут не відтворюється')
              : textOr('media.couldNotLoad', "Couldn't load", 'Не вдалося завантажити')}</span>
            <button type="button" className="media-card-retry" onClick={retry}>
              {textOr('media.retry', 'Retry', 'Повторити')}
            </button>
          </div>
        ) : isVideo ? (
          <video
            key={attempt}
            // #t=0.1: Safari / iOS ilk kareyi ancak bir zaman verilince onizleme olarak cizer.
            src={inView ? `${mediaUrl}#t=0.1` : undefined}
            className="media-card-image"
            muted
            playsInline
            preload={inView ? 'metadata' : 'none'}
            onLoadedMetadata={(e) => {
              setDuration(formatDuration(e.currentTarget.duration));
              setState('ready');
            }}
            onError={() => setState('error')}
          />
        ) : (
          <img
            key={attempt}
            src={mediaUrl}
            alt={uploaderName}
            className="media-card-image"
            loading="lazy"
            decoding="async"
            onLoad={() => setState('ready')}
            onError={() => setState('error')}
          />
        )}
        {state === 'loading' && <div className="media-card-skeleton" aria-hidden="true" />}
      </div>
      {isVideo && state === 'ready' && duration && <span className="media-card-duration">{duration}</span>}
      {isVideo && state === 'ready' && !selectable && (
        <button className="media-card-play-btn">
          <i className="fa-solid fa-play"></i>
        </button>
      )}
      <div onClick={handleOverlayClick} className="media-card-overlay">
        <div className="media-card-footer">
          <div className="media-card-user">
            <div className="media-card-avatar">
              {!isAnon ? initials : <i className="fa-solid fa-mask"></i>}
            </div>
            <span className="media-card-name">{isAnon ? getTimeAgo(uploadEntry?.created_at || "") : uploaderName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MediaCard;
