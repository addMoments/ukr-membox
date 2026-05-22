import { t } from '../packages/i18n';
import '../v2-styles/QRPreviewCard.css';

interface QRPreviewCardProps {
  eventName: string;
  qrCodeUrl: string;
  eventUid: string;
  isActive?: boolean;
  brandUrl?: string;
}

function QRPreviewCard({
  eventName,
  qrCodeUrl,
  eventUid,
  isActive = true,
  brandUrl = 'addmoments.com'
}: QRPreviewCardProps) {
  return (
    <div className="qr-preview-card">
      <h3 className="qr-preview-card-header">
        <i className="fa-solid fa-qrcode" />
        {t('eventHome.qrPreview.title')}
      </h3>
      <div className="qr-preview-card-body">
        <div className="qr-preview-inner">
          <div className="qr-preview-title">
            <p>{t('eventHome.qrPreview.uploadPhotosFor')}</p>
            <h2>{eventName}</h2>
          </div>
          <div className="qr-preview-qr-container">
            <div className="qr-preview-qr-dashed" />
            <div className="qr-preview-qr-box">
              <img src={qrCodeUrl} alt="Event QR Code" />
            </div>
            <div className="qr-preview-camera-icon">
              <i className="fa-solid fa-camera" />
            </div>
          </div>
          <div className="qr-preview-instructions">
            <p>{t('eventHome.qrPreview.scanToShare')}</p>
            <p>{t('eventHome.qrPreview.noAppRequired')}</p>
          </div>
          <div className="qr-preview-footer">
          </div>
        </div>
        <p className="qr-preview-status">
          <span className={`qr-preview-status-dot ${!isActive ? 'inactive' : ''}`} />
          {isActive ? t('eventHome.qrPreview.linkActive') : t('eventHome.qrPreview.linkInactive')}
        </p>
      </div>
    </div>
  );
}

export default QRPreviewCard;
