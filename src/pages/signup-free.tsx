import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import V2SignUpForm from '../v2-partials/V2SignUpForm';
import { signUpErrorCode, signUpFree } from '../client/auth';
import { FormState } from '../utils/form_event_parse';
import { t } from '../packages/i18n';
import { textOr } from '../utils/admin_i18n';
import { ensureCanonicalLink, ensureMetaTag } from '../utils/seo';
import { markMetaEventOnce, trackMetaCompleteRegistration } from '../client/meta-pixel';
import '../v2-styles/AuthForm.css';

// Free kayit sayfasi (Fatih 18 Kasim 2026): header'daki "Get started free" buraya gelir. Form token'li
// kayitla ayni (ad, e-posta, parola, kosullar); gonderince backend free paket etkinligini acar, hostu
// oturum acmis olarak etkinligine yollar. Altta "Already a member? Sign in".
// Kurallar backend'de (signup_free.go): e-posta basina bir free paket, hesap varsa giris.

const canonicalPath = '/signup/';
const PRICES_PATH = '/events/services-and-prices/';

function SignUpFree() {
  const [notice, setNotice] = useState<ReactNode>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const canonicalHref = new URL(canonicalPath, window.location.origin).toString();
    const title = textOr('auth.signUpFreeTitle', 'Sign up free - AddMoments', 'Безкоштовна реєстрація - AddMoments');
    const description = textOr(
      'auth.signUpFreeDescription',
      'Create your free AddMoments event and start collecting photos and videos from your guests.',
      'Створіть безкоштовну подію AddMoments і збирайте фото та відео від своїх гостей.',
    );

    document.title = title;
    ensureMetaTag('name', 'description').setAttribute('content', description);
    ensureMetaTag('property', 'og:title').setAttribute('content', title);
    ensureMetaTag('property', 'og:description').setAttribute('content', description);
    ensureMetaTag('property', 'og:url').setAttribute('content', canonicalHref);
    ensureCanonicalLink(canonicalHref);
  }, []);

  const signInLink = <Link to="/signin">{t('auth.signIn')}</Link>;
  const pricesLink = (
    <Link to={PRICES_PATH}>{textOr('auth.freeSignup.pricesLink', 'Services & Prices', 'Послуги та ціни')}</Link>
  );

  // Ne: Sunucunun hata kodunu kullaniciya ne yapacagini soyleyen bir satira cevirir.
  // Neden: Bu sayfa herkese acik; "409" ya da ham hata metni yerine giris / paketler linki gosterilmeli.
  const noticeFor = (code: string | null, fallback: string): ReactNode => {
    switch (code) {
      case 'ACCOUNT_EXISTS':
        return (
          <>
            {textOr('auth.freeSignup.accountExists', 'You already have an account with this email.', 'У вас уже є обліковий запис з цією електронною поштою.')}{' '}
            {signInLink}
          </>
        );
      case 'FREE_PACKAGE_ALREADY_USED':
        return (
          <>
            {textOr('auth.freeSignup.alreadyUsed', 'This email has already used the free package.', 'Ця електронна пошта вже використала безкоштовний пакет.')}{' '}
            {signInLink}{' '}
            {textOr('auth.freeSignup.orChoose', 'or choose a package on', 'або оберіть пакет на сторінці')}{' '}
            {pricesLink}.
          </>
        );
      case 'FREE_PACKAGE_UNAVAILABLE':
        return (
          <>
            {textOr('auth.freeSignup.unavailable', 'The free package is not available right now. See our packages on', 'Безкоштовний пакет зараз недоступний. Перегляньте наші пакети на сторінці')}{' '}
            {pricesLink}.
          </>
        );
      case 'TOO_MANY_ATTEMPTS':
        return textOr('auth.freeSignup.tooMany', 'Too many sign ups from your network. Please try again in an hour.', 'Забагато реєстрацій з вашої мережі. Спробуйте ще раз за годину.');
      default:
        return fallback;
    }
  };

  const handleSignUp = async (formData: FormState) => {
    setBusy(true);
    setNotice(null);
    try {
      await signUpFree({
        email: String(formData.email || '').trim(),
        name: String(formData.name || '').trim(),
        password: formData.password,
        confirm_password: formData.confirmPassword,
        agreed: !!formData.agreed,
      });
      // Basarida core fetch "goto:/events" ile yonlendirdi; donusum bir kez sayilir.
      if (markMetaEventOnce(`meta_registration_tracked_free_${String(formData.email || '').toLowerCase()}`)) {
        trackMetaCompleteRegistration({ content_name: 'signup_free' });
      }
    } catch (error) {
      console.error('Free sign up error:', error);
      const fallback = error instanceof Error && error.message ? error.message : t('auth.signUpFailed');
      setNotice(noticeFor(signUpErrorCode(error), fallback));
      setBusy(false);
    }
  };

  return (
    <>
      <V2Header />
      <V2SignUpForm onSubmit={handleSignUp} hideGoogleButton notice={notice} busy={busy} />
      <V2Footer />
    </>
  );
}

export default SignUpFree;
