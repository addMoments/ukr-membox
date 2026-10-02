import { useState } from 'react';
import '../styles/PhotoViewerModal.css';
import { proxy, useSnapshot } from 'valtio';
import { textOr } from '../utils/admin_i18n';

type PhotoItem = {
  src: string;
  title: string;
  tagline: string;
  id: string;
  isVideo?: boolean;
};

type PhotoAction = {
  icon: string;
  // Verilirse dugme simge + metin olarak cizilir (misafir albumu: "Зберегти у Фото", AM-16).
  label?: string;
  onClick: (id: string) => void;
};

const photoViewerState = proxy({
  open: false,
  items: [] as PhotoItem[],
  actions: [] as PhotoAction[],
  currentIndex: 0,
});

function PhotoViewerModal() {
  const snap = useSnapshot(photoViewerState);
  // AM-02: oynatilamayan videonun id'si; bos oynatici yerine aciklama gosterilir.
  const [failedVideoId, setFailedVideoId] = useState<string | null>(null);

  if (!snap.open || snap.items.length === 0) return null;

  const currentItem = snap.items[snap.currentIndex];
  const hasPrev = snap.currentIndex > 0;
  const hasNext = snap.currentIndex < snap.items.length - 1;

  const handleClose = () => {
    photoViewerState.open = false;
  };

  const handleBackdropClick = () => {
    photoViewerState.open = false;
  };

  const handlePrev = () => {
    if (hasPrev) {
      photoViewerState.currentIndex--;
    }
  };

  const handleNext = () => {
    if (hasNext) {
      photoViewerState.currentIndex++;
    }
  };

  const handleActionClick = (action: PhotoAction) => {
    action.onClick(currentItem.id);
  };

  return (
    <div className="photo-viewer-overlay">
      <div className="photo-viewer-backdrop" onClick={handleBackdropClick} />
      
      <div className="photo-viewer-container">
        <button className="photo-viewer-close" onClick={handleClose}>
          <i className="fa-solid fa-xmark" />
        </button>

        <div className="photo-viewer-main">
        <button style={{opacity: hasPrev ? 1 : 0.2}} disabled={!hasPrev} className="photo-viewer-nav photo-viewer-prev" onClick={handlePrev}>
              <i className="fa-solid fa-chevron-left" />
        </button>


          <div className="photo-viewer-content">
            {currentItem.isVideo && failedVideoId === currentItem.id ? (
              <div className="photo-viewer-video-error" role="status">
                <i className="fa-solid fa-video-slash" />
                <span>{textOr('media.videoUnplayableViewer', "This video can't be played in the browser. You can still save it to your device.", 'Це відео не відтворюється в браузері. Його все одно можна зберегти на пристрій.')}</span>
              </div>
            ) : currentItem.isVideo ? (
              <video 
                key={currentItem.id}
                src={currentItem.src} 
                className="photo-viewer-image" 
                controls 
                autoPlay 
                playsInline
                onError={() => setFailedVideoId(currentItem.id)}
              />
            ) : (
              <img src={currentItem.src} alt={currentItem.title} className="photo-viewer-image" />
            )}
            
            <div className="photo-viewer-info">
              <h3 className="photo-viewer-title">{currentItem.title}</h3>
              <p className="photo-viewer-tagline">{currentItem.tagline}</p>
            </div>

            <div className="photo-viewer-actions">
              {snap.actions.map((action, idx) => (
                <button 
                  key={idx} 
                  className={`photo-viewer-action-btn${action.label ? ' labeled' : ''}`}
                  onClick={() => handleActionClick(action as PhotoAction)}
                  aria-label={action.label}
                  title={action.label}
                >
                  <i className={action.icon} />
                  {action.label && <span>{action.label}</span>}
                </button>
              ))}
            </div>
          </div>

          <button disabled={!hasNext} style={{opacity: hasNext ? 1 : 0.2}} className="photo-viewer-nav photo-viewer-next" onClick={handleNext}>
              <i className="fa-solid fa-chevron-right" />
            </button>
        </div>

        <div className="photo-viewer-counter">
          {snap.currentIndex + 1} / {snap.items.length}
        </div>
      </div>
    </div>
  );
}

export default PhotoViewerModal;
export { photoViewerState };
