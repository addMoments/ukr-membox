import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import { confirmPasswordReset } from '../client/auth';
import { t } from '../packages/i18n';
import '../v2-styles/AuthForm.css';

function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value;

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    if (!token) return;

    setLoading(true);
    setError('');
    try {
      await confirmPasswordReset(token, password, confirmPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. The link may have expired.');
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <>
        <V2Header />
        <div className="v2-auth-page">
          <div className="v2-auth-bg-blur-1" />
          <div className="v2-auth-bg-blur-2" />
          <main className="v2-auth-main">
            <div className="v2-auth-card">
              <div className="v2-auth-body" style={{ padding: '48px' }}>
                <h2 className="v2-auth-title">Invalid link</h2>
                <p className="v2-auth-subtitle">This password reset link is invalid.</p>
                <Link to="/recover" className="v2-auth-submit" style={{ textDecoration: 'none' }}>
                  Request a new link
                </Link>
              </div>
            </div>
          </main>
        </div>
        <V2Footer />
      </>
    );
  }

  return (
    <>
      <V2Header />
      <div className="v2-auth-page">
        <div className="v2-auth-bg-blur-1" />
        <div className="v2-auth-bg-blur-2" />
        <main className="v2-auth-main">
          <div className="v2-auth-card">
            <div className="v2-auth-body">
              <h2 className="v2-auth-title">Set new password</h2>
              <p className="v2-auth-subtitle">Choose a new password for your account.</p>

              <form className="v2-auth-form" onSubmit={handleSubmit}>
                <div className="v2-auth-fields">
                  <div className="v2-auth-field-group">
                    <label htmlFor="password" className="v2-auth-label">{t('auth.password')}</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      className="v2-auth-input"
                      placeholder={t('auth.passwordPlaceholder')}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </div>
                  <div className="v2-auth-field-group">
                    <label htmlFor="confirmPassword" className="v2-auth-label">{t('auth.confirmPassword')}</label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      className="v2-auth-input"
                      placeholder={t('auth.passwordPlaceholder')}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </div>
                </div>

                {error && <p style={{ color: '#c0392b', fontSize: 14, margin: '4px 0' }}>{error}</p>}

                <button type="submit" className="v2-auth-submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Set new password'}
                </button>
              </form>

              <div className="v2-auth-link-section">
                <Link to="/signin" className="v2-auth-link">{t('auth.signIn')}</Link>
              </div>
            </div>
          </div>
        </main>
      </div>
      <V2Footer />
    </>
  );
}

export default ResetPassword;
