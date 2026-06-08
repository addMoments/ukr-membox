import { Link } from 'react-router-dom';
import '../v2-styles/AuthForm.css';
import { FormState, parse_submit_event } from '../utils/form_event_parse';
import { S3_ROOT } from '../consts';
import { t } from '../packages/i18n';

interface V2SignInFormProps {
  onSubmit: (formData: FormState) => void;
  compact?: boolean;
  prefillEmail?: string;
  emailReadOnly?: boolean;
}

function V2SignInForm({ onSubmit, compact = false, prefillEmail, emailReadOnly }: V2SignInFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = parse_submit_event(e);
    onSubmit(formData);
  };

  return (
    <div className={`v2-auth-page${compact ? ' v2-auth-page-compact' : ''}`}>
      {/* Background blurs */}
      <div className="v2-auth-bg-blur-1" />
      <div className="v2-auth-bg-blur-2" />

      {/* Main Content */}
      <main className="v2-auth-main">
        <div className="v2-auth-card">
          <div className="v2-auth-hero">
            <img
              src={S3_ROOT+"/ui/assets/concert.webp"}
              alt={t('auth.eventMemories')}
            />
            <div className="v2-auth-hero-gradient" />
          </div>

          <div className="v2-auth-body">
            <h2 className="v2-auth-title">{t('auth.welcomeBack')}</h2>
            <p className="v2-auth-subtitle">{t('auth.welcomeBackSubtitle')}</p>

            <form className="v2-auth-form" onSubmit={handleSubmit}>
              <div className="v2-auth-fields">
                <div className="v2-auth-field-group">
                  <label htmlFor="email" className="v2-auth-label">
                    {t('auth.emailOrUsername')}
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="v2-auth-input"
                    placeholder={t('auth.emailPlaceholder')}
                    autoComplete="email"
                    defaultValue={prefillEmail}
                    readOnly={emailReadOnly}
                    required
                  />
                </div>

                <div className="v2-auth-field-group">
                  <div className="v2-auth-label-row">
                    <label htmlFor="password" className="v2-auth-label">
                      {t('auth.password')}
                    </label>
                    <Link to="/recover" className="v2-auth-forgot-link">
                      {t('auth.forgot')}
                    </Link>
                  </div>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    className="v2-auth-input"
                    placeholder={t('auth.passwordPlaceholder')}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <div className="v2-auth-remember">
                <input
                  type="checkbox"
                  id="rememberMe"
                  name="rememberMe"
                  className="v2-auth-checkbox"
                />
                <label htmlFor="rememberMe" className="v2-auth-checkbox-label">
                  {t('auth.keepMeSignedIn')}
                </label>
              </div>

              <button type="submit" className="v2-auth-submit">
                {t('auth.signInBtn')}
              </button>
            </form>

            {!compact && (
              <div className="v2-auth-link-section">
                {t('auth.newHere')}
                <Link to="/events/services-and-prices/" className="v2-auth-link">
                  {t('auth.createAnAccount')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default V2SignInForm;
