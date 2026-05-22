import { t } from '../packages/i18n';
import '../v2-styles/GuestAccessCard.css';

interface GuestAccessCardProps {
  guestUrl: string;
  eventName: string;
}

const ShareBtn = ({
  icon = "fa-solid fa-copy",
  text = "Copy Link",
  ...rest
}) => (<a
  {...rest}
  className="guest-access-share-btn"
>
  <i className={icon} />
  {text}
</a>)

function GuestAccessCard({ guestUrl, eventName }: GuestAccessCardProps) {
  const handleCopyLink = () => {
    navigator.clipboard.writeText(guestUrl);
  };

  const msg = encodeURIComponent(`${t('eventHome.guestAccess.inviteMessage')} ${guestUrl}`);

  return (
    <div className="guest-access-card">
      <h3 className="guest-access-title">
        <i className="fa-solid fa-link" />
        {t('eventHome.guestAccess.title')}
      </h3>
      <p className="guest-access-desc">{t('eventHome.guestAccess.description')}</p>
      <div className="guest-access-link-row">
        <div className="guest-access-link-input">{guestUrl || t('eventHome.guestAccess.loading')}</div>
        <button className="guest-access-copy-btn" onClick={handleCopyLink}>
          <i className="fa-solid fa-copy" />
          {t('eventHome.guestAccess.copyLink')}
        </button>
      </div>
      <div className="guest-access-share-row">
        <ShareBtn 
          icon="fa-brands fa-whatsapp" 
          text={t('eventHome.guestAccess.whatsapp')} 
          rel="noopener noreferrer"
          href={`https://wa.me/?text=${msg}`}
        />
        <ShareBtn 
          icon="fa-solid fa-envelope" 
          text={t('eventHome.guestAccess.email')} 
          href={`mailto:?subject=${encodeURIComponent(eventName || t('eventHome.guestAccess.emailSubject'))}&body=${msg}`}
        />
        <ShareBtn 
          icon="fa-brands fa-telegram" 
          text={t('eventHome.guestAccess.telegram')} 
          href={`https://t.me/share/url?url=${encodeURIComponent(guestUrl)}&text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
        />
      </div>
    </div>
  );
}

export default GuestAccessCard;
