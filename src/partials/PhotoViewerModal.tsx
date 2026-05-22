import '../styles/PhotoViewerModal.css';
import { proxy, useSnapshot } from 'valtio';

type PhotoItem = {
  src: string;
  title: string;
  tagline: string;
  id: string;
  isVideo?: boolean;
};

type PhotoAction = {
  icon: string;
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
            {currentItem.isVideo ? (
              <video 
                src={currentItem.src} 
                className="photo-viewer-image" 
                controls 
                autoPlay 
                playsInline
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
                  className="photo-viewer-action-btn"
                  onClick={() => handleActionClick(action as PhotoAction)}
                >
                  <i className={action.icon} />
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
