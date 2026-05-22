import { defaultGuestTheme, GuestTheme } from '../types/guestTheme';
import { fonts } from '../types/fonts';
import { EventPublic, eventQrImageUrl } from '../types/events';
import { S3_ROOT } from '../consts';
import { t } from '../packages/i18n';
import './golden-hour.css';

interface GoldenHourProps {
  event: EventPublic;
  colorsOverride?: GuestTheme;
  fontOverride?: string;
}

const DEFAULT_BANNER = S3_ROOT + "/ui/golden-hour-banner.jpg";
const DEFAULT_QR = S3_ROOT + "/ui/golden-hour-qr.jpg";

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(t('lang_code'), { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric'
  });
};

function GoldenHour({ event, colorsOverride, fontOverride }: GoldenHourProps) {
  const colors = colorsOverride || { ...defaultGuestTheme, ...event.settings?.poster_colors };
  const font = fontOverride || event.settings?.poster_font || fonts[0].id;
  const fontFamily = font ? fonts.find(f => f.id === font)?.fontFamily : undefined;

  const bannerImage = event.image ? S3_ROOT + event.image : DEFAULT_BANNER;
  const qrImage = event.uid ? eventQrImageUrl(event) : DEFAULT_QR;
  
  return (
    <main className="gh-poster" style={{ ...colors, fontFamily: fontFamily }}>
      <section className="gh-hero">
        <img
          alt="Event Banner"
          className="gh-hero-image"
          src={bannerImage}
        />
        <div className="gh-hero-label">Wedding Celebration</div>
      </section>

      <section className="gh-content">
        <div className="gh-event-title">
          <h1 className="gh-headline">{event.name || 'Untitled Event'}</h1>
          <div className="gh-event-meta">
            <span>{formatDate(event.activation_date) || 'Date not set'}</span>
            {event.description && (
              <>
                <span className="gh-dot"></span>
                <span>{event.description}</span>
              </>
            )}
          </div>
        </div>

        <div className="gh-qr-section">
          <div className="gh-qr-border">
            <div className="gh-qr-box">
              <img
                alt="Scan QR Code"
                className="gh-qr-image"
                src={qrImage}
              />
            </div>
          </div>
          <h2 className="gh-qr-title">Scan to share your favorite moments</h2>
          {event.welcome_message && (
            <p className="gh-qr-description">{event.welcome_message}</p>
          )}
        </div>

        <div className="gh-footer">
          <div className="gh-footer-brand">
            <svg className="gh-footer-icon" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
            </svg>
            <span>AddMoments Platform</span>
          </div>
          <p className="gh-footer-note">No app download or registration required for guests</p>
        </div>
      </section>
    </main>
  );
}

export default GoldenHour;
