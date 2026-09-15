import '../v2-styles/MediaCard.css';
import { Action } from '../types/button';
import { UploadEntry } from '../types/uploads';
import { getTimeAgo } from '../temp-ai-logic-and-data/time-ago';
import { S3_ROOT } from '../consts';

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
      {isVideo ? (
        <video
          src={mediaUrl}
          className="media-card-image"
          muted
          playsInline
          preload="none"
          onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = 'none'; }}
        />
      ) : (
        <img
          src={mediaUrl}
          alt={uploaderName}
          className="media-card-image"
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = 'none';
            const parent = el.parentElement;
            if (parent && !parent.querySelector('.media-card-broken')) {
              const placeholder = document.createElement('div');
              placeholder.className = 'media-card-broken';
              placeholder.innerHTML = '<i class="fa-solid fa-image-slash"></i>';
              parent.insertBefore(placeholder, el);
            }
          }}
        />
      )}
      {isVideo && !selectable && (
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
