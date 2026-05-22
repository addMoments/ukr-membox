import { Link } from 'react-router-dom';
import '../v2-styles/AuthForm.css';
import { FormState, parse_submit_event } from '../utils/form_event_parse';
import { S3_ROOT } from '../consts';
import { t } from '../packages/i18n';

interface V2SignUpFormProps {
  onSubmit: (formData: FormState) => void;
  prefillEmail?: string;
  emailReadOnly?: boolean;
  hideGoogleButton?: boolean;
}

function V2SignUpForm({ onSubmit, prefillEmail, emailReadOnly, hideGoogleButton }: V2SignUpFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = parse_submit_event(e);
    
    if (formData.password !== formData.confirmPassword) {
      alert(t('auth.passwordsDoNotMatch'));
      return;
    }

    if (!formData.agreed) {
      alert(t('auth.mustAgreeToTerms'));
      return;
    }

    onSubmit(formData);
  };

  const handleGoogleSignUp = () => {
  };

  const handleFacebookSignUp = () => {
  };

  return (
    <div className="v2-auth-page">
      {/* Background blurs */}
      <div className="v2-auth-bg-blur-1" />
      <div className="v2-auth-bg-blur-2" />

      {/* Main Content */}
      <main className="v2-auth-main">
        <div className="v2-auth-card">
          <div className="v2-auth-hero">
            <img
              src={S3_ROOT + "/ui/assets/concert.webp"}
              alt={t('auth.eventMemories')}
            />
            <div className="v2-auth-hero-gradient" />
          </div>

          <div className="v2-auth-body">
            <h2 className="v2-auth-title">{t('auth.createAccount')}</h2>
            <p className="v2-auth-subtitle">{t('auth.createAccountSubtitle')}</p>

            <form className="v2-auth-form" onSubmit={handleSubmit}>
              <div className="v2-auth-fields">
                <div className="v2-auth-field-group">
                  <label htmlFor="name" className="v2-auth-label">
                    {t('auth.fullName')}
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    className="v2-auth-input"
                    placeholder={t('auth.namePlaceholder')}
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="v2-auth-field-group">
                  <label htmlFor="email" className="v2-auth-label">
                    {t('auth.email')}
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
                  <label htmlFor="password" className="v2-auth-label">
                    {t('auth.password')}
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    className="v2-auth-input"
                    placeholder={t('auth.passwordPlaceholder')}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="v2-auth-field-group">
                  <label htmlFor="confirmPassword" className="v2-auth-label">
                    {t('auth.confirmPassword')}
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    className="v2-auth-input"
                    placeholder={t('auth.passwordPlaceholder')}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <div className="v2-auth-remember">
                <input
                  type="checkbox"
                  id="agreed"
                  name="agreed"
                  className="v2-auth-checkbox"
                  required
                />
                <label htmlFor="agreed" className="v2-auth-checkbox-label">
                  {t('auth.agreeToTerms')}{' '}
                  <Link to="/tos">{t('auth.termsOfService')}</Link>
                  {' '}{t('auth.and')}{' '}
                  <Link to="/privacy">{t('auth.privacyPolicy')}</Link>
                </label>
              </div>

              <button type="submit" className="v2-auth-submit">
                {t('auth.createAccountBtn')}
              </button>
            </form>

            {!hideGoogleButton && (
              <>
                <div className="v2-auth-divider">
                  <hr className="v2-auth-divider-line" />
                  <span className="v2-auth-divider-text">{t('auth.orContinueWith')}</span>
                </div>

                <div className="v2-auth-social">
                  <button
                    type="button"
                    className="v2-auth-social-btn"
                    onClick={handleGoogleSignUp}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {t('auth.google')}
                  </button>
                  <button
                    type="button"
                    className="v2-auth-social-btn"
                    onClick={handleFacebookSignUp}
                  >
                    <svg viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M13.397 20.997v-8.196h2.765l.411-3.209h-3.176V7.548c0-.926.258-1.56 1.587-1.56h1.684V3.127A22.336 22.336 0 0 0 14.201 3c-2.444 0-4.122 1.492-4.122 4.231v2.355H7.332v3.209h2.753v8.202h3.312z" />
                    </svg>
                    {t('auth.facebook')}
                  </button>
                </div>
              </>
            )}

            <div className="v2-auth-link-section">
              {t('auth.alreadyHaveAccount')}
              <Link to="/signin" className="v2-auth-link">
                {t('auth.signIn')}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default V2SignUpForm;
