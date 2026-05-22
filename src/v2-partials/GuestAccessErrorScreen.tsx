import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import { GuestTheme, defaultGuestTheme } from '../types/guestTheme';
import { t } from '../packages/i18n';
import '../v2-styles/GuestAccessErrorScreen.css';

interface GuestAccessErrorScreenProps {
  title: string;
  message: string;
  actionText: string;
  actionHref?: string;
  onActionClick?: () => void;
  isActionDisabled?: boolean;
  theme?: GuestTheme;
}

function GuestAccessErrorScreen({
  title,
  message,
  actionText,
  actionHref,
  onActionClick,
  isActionDisabled = false,
  theme = defaultGuestTheme,
}: GuestAccessErrorScreenProps) {
  const langCode = t('lang_code');
  const localizedContactHref = langCode === 'uk'
    ? 'https://addmoments.com.ua/uk/contact-addmoments/'
    : 'https://addmoments.com.ua/contact-us/';
  const resolvedActionHref = actionHref === '/contact'
    ? localizedContactHref
    : actionHref;

  return (
    <div className="guest-access-error-screen" style={theme}>
      <V2Header />
      <main className="guest-access-error-main">
        <section className="guest-access-error-card">
          <h1 className="guest-access-error-title">{title}</h1>
          <p className="guest-access-error-message">{message}</p>
          <div className="guest-access-error-action">
            {resolvedActionHref && !onActionClick
              ? (
                <a className="guest-access-error-btn" href={resolvedActionHref}>
                  {actionText}
                </a>
                )
              : (
                <button
                  type="button"
                  className="guest-access-error-btn"
                  onClick={onActionClick}
                  disabled={isActionDisabled}
                >
                  {actionText}
                </button>
                )}
          </div>
        </section>
      </main>
      <V2Footer />
    </div>
  );
}

export default GuestAccessErrorScreen;

