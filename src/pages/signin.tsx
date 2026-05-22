import { useSearchParams } from 'react-router-dom';
import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import V2SignInForm from '../v2-partials/V2SignInForm';
import { signInEmail } from '../client/auth';
import { resolvePostSignInRedirect } from '../client/admin';
import { FormState } from '../utils/form_event_parse';
import { t } from '../packages/i18n';

// Ne: ?next= parametresini guvenli bir same-origin path'e cevirir.
// Nasil: decodeURIComponent eder; sadece tek '/' ile baslayan, '//' veya '/\\' ile baslamayan relative path'i kabul eder.
// Neden: CWE-601 Open Redirect zafiyetini onler. Saldirgan ?next=https://evil.com gonderse safeNext null doner ve default akisa duser.
const safeNext = (raw: string | null): string | null => {
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!decoded.startsWith('/')) return null;
  if (decoded.startsWith('//')) return null;
  if (decoded.startsWith('/\\')) return null;
  return decoded;
};

function SignIn() {
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get('next'));

  // Ne: Login form submit handler.
  // Nasil: Backend goto'sunu once bloklar; basarili login sonrasi admin check ile ozel no-access durumunu yakalar, yoksa next/goto akisini surdurur.
  // Neden: Silinmis ve aktif eventi olmayan panel admin services/prices'a dusmesin; normal login yonlendirmeleri bozulmasin.
  const handleSignIn = async (formData: FormState) => {
    try {
      const result = await signInEmail(
        { email: formData.email, password: formData.password },
        { blockRedirects: true }
      );
      window.location.href = await resolvePostSignInRedirect(result, next);
      console.log('Sign in success:', result);
    } catch (error) {
      console.error('Sign in error:', error);
      alert(error instanceof Error ? error.message : t('auth.signInFailed'));
    }
  };

  return (
    <>
      <V2Header />
      <V2SignInForm onSubmit={handleSignIn} />
      <V2Footer />
    </>
  );
}

export default SignIn;
