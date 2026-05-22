import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import V2SignUpForm from '../v2-partials/V2SignUpForm';
import { getSignupTokenInfo, signUpEmailWithToken, attachWithToken, SignupTokenInfo } from '../client/auth';
import V2SignInForm from '../v2-partials/V2SignInForm';
import { FormState } from '../utils/form_event_parse';
import '../v2-styles/AuthForm.css';
import { t } from '../packages/i18n';

function SignUp() {
  const { token } = useParams<{ token?: string }>();
  const [tokenInfo, setTokenInfo] = useState<SignupTokenInfo | null>(null);
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    if (!token) return;
    
    getSignupTokenInfo(token)
      .then(info => setTokenInfo(info))
      .catch(() => setTokenInfo({ valid: false, error: 'Failed to verify token' }))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAttach = async (formData: FormState) => {
    if (!token || !tokenInfo?.owner_email) return;
    try {
      await attachWithToken(token, tokenInfo.owner_email, formData.password);
    } catch (error) {
      alert(error instanceof Error ? error.message : t('auth.signInFailed'));
    }
  };

  const handleTokenSignUp = async (formData: FormState) => {
    if (!token) return;
    
    try {
      await signUpEmailWithToken(token, {
        email: formData.email,
        name: formData.name,
        password: formData.password,
        confirm_password: formData.confirmPassword,
        agreed: formData.agreed,
      });
    } catch (error) {
      console.error('Sign up error:', error);
      alert(error instanceof Error ? error.message : t('auth.signUpFailed'));
    }
  };

  if (loading) {
    return (
      <>
        <V2Header />
        <div className="v2-auth-page">
          <div className="v2-auth-bg-blur-1" />
          <div className="v2-auth-bg-blur-2" />
          <main className="v2-auth-main">
            <div className="v2-auth-card">
              <div className="v2-auth-body" style={{ padding: '48px' }}>
                <p className="v2-auth-subtitle" style={{ margin: 0 }}>{t('auth.verifyingInvite')}</p>
              </div>
            </div>
          </main>
        </div>
        <V2Footer />
      </>
    );
  }

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
                <h2 className="v2-auth-title">{t('auth.inviteRequired')}</h2>
                <p className="v2-auth-subtitle">{t('auth.inviteRequiredDesc')}</p>
                <Link to="/signin" className="v2-auth-submit" style={{ textDecoration: 'none' }}>
                  {t('auth.signIn')}
                </Link>
              </div>
            </div>
          </main>
        </div>
        <V2Footer />
      </>
    );
  }

  if (!tokenInfo || !tokenInfo.valid) {
    return (
      <>
        <V2Header />
        <div className="v2-auth-page">
          <div className="v2-auth-bg-blur-1" />
          <div className="v2-auth-bg-blur-2" />
          <main className="v2-auth-main">
            <div className="v2-auth-card">
              <div className="v2-auth-body" style={{ padding: '48px' }}>
                <h2 className="v2-auth-title">{t('auth.invalidInviteLink')}</h2>
                <p className="v2-auth-subtitle">{tokenInfo?.error || t('auth.invalidInviteLinkDesc')}</p>
                <Link to="/signin" className="v2-auth-submit" style={{ textDecoration: 'none' }}>
                  {t('auth.signIn')}
                </Link>
              </div>
            </div>
          </main>
        </div>
        <V2Footer />
      </>
    );
  }

  if (tokenInfo.email_exists) {
    return (
      <>
        <V2Header />
        <V2SignInForm
          onSubmit={handleAttach}
          prefillEmail={tokenInfo.owner_email}
          emailReadOnly
        />
        <V2Footer />
      </>
    );
  }

  return (
    <>
      <V2Header />
      <V2SignUpForm
        onSubmit={handleTokenSignUp}
        prefillEmail={tokenInfo.owner_email}
        emailReadOnly
        hideGoogleButton
      />
      <V2Footer />
    </>
  );
}

export default SignUp;

