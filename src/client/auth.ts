import { DB_ROOT, SERV_ROOT } from '../consts';
import { rm_key } from '../utils/persistence';
import { fetch, FetchHttpError, isGuest } from './core';

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreed: boolean;
}

// Ne: Email + sifre ile signin; opsiyonel blockRedirects parametresi alir.
// Nasil: blockRedirects=true verildiginde core fetch'in 201/goto: redirect mantigi devre disi kalir; cagiran taraf manuel navigate edebilir.
// Neden: /signin?next=... senaryosunda backend'in default goto: yonlendirmesini bloklamak ve kullaniciyi orijinal URL'e gondermek icin gerekli.
//        Default davranis (blockRedirects=false) tum mevcut cagrilarda korunur, geriye donuk uyumluluk var.
export async function signInEmail(
  request: SignInRequest,
  options: { blockRedirects?: boolean } = {}
) {
  return fetch(`${SERV_ROOT}/auth/signin/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  }, { blockRedirects: options.blockRedirects ?? false });
}

export interface SignupTokenInfo {
  valid: boolean;
  reference_no?: string;
  owner_email?: string;
  email_exists?: boolean;
  error?: string;
}

export interface SignUpWithTokenRequest {
  email: string;
  name: string;
  password: string;
  confirm_password: string;
  agreed: boolean;
}

export async function getSignupTokenInfo(token: string): Promise<SignupTokenInfo> {
  const res = await fetch(`${SERV_ROOT}/auth/signup/email/${token}`, {
    method: 'GET',
  });
  return res.json();
}

export async function signUpEmailWithToken(token: string, request: SignUpWithTokenRequest): Promise<Response> {
  const res = await fetch(`${SERV_ROOT}/auth/signup/email/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Sign up failed');
  }
  return res;
}

export interface SignUpFreeRequest {
  email: string;
  name: string;
  password: string;
  confirm_password: string;
  agreed: boolean;
}

// Free kayit (musteri 18 Kasim 2026): token'siz kayit, free paket etkinligini tek adimda acar.
// Basarida sunucu X-Auth-Token + 201 "goto:/events" doner; core fetch token'i saklar ve yonlendirir.
// Hata kodlari signUpErrorCode ile okunur: ACCOUNT_EXISTS, FREE_PACKAGE_ALREADY_USED,
// FREE_PACKAGE_UNAVAILABLE, TOO_MANY_ATTEMPTS, INVALID_INPUT.
export async function signUpFree(request: SignUpFreeRequest): Promise<Response> {
  return fetch(`${SERV_ROOT}/auth/signup/free`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export const signUpErrorCode = (err: unknown): string | null => {
  if (!(err instanceof FetchHttpError)) return null;
  if (!err.body || typeof err.body !== 'object') return null;
  return typeof err.body.code === 'string' ? err.body.code : null;
};

export async function attachWithToken(
  token: string,
  email: string,
  password: string
): Promise<Response> {
  const res = await fetch(`${SERV_ROOT}/auth/signup/email/${token}/attach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }, { blockRedirects: false });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to attach account');
  }
  return res;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await fetch(`${SERV_ROOT}/auth/password-reset/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(token: string, password: string, confirmPassword: string): Promise<Response> {
  return fetch(`${SERV_ROOT}/auth/password-reset/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password, confirm_password: confirmPassword }),
  }, { blockRedirects: false });
}

export const whoAmI = async () => {
  return fetch(`${SERV_ROOT}/${isGuest() ? "api/guest" : "auth"}/whoami`, {
    method: 'GET',
  }).then(x => x.json()).then(x => {
    if (!x.iat && !x.ui){
      throw new Error("not logged in");
    }
    return x;
  });
}

export const dbWhoAmI = async (): Promise<string> => {
  const res = await fetch(`${DB_ROOT}/rpc/current_user_uid`, {
    method: 'GET',
  });
  return res.json();
}

export const logout = async () => {
  rm_key("tkn").catch(()=>{}).then(()=>{
    window.location.href = "/";
  })
}
