import { SERV_ROOT } from '../consts';
import { fetch as authFetch, FetchHttpError } from './core';

export const ALREADY_EXTENDED_CODE = 'ALREADY_EXTENDED';
export const EXTEND_REJECTED_CODE = 'EXTEND_REJECTED';

export interface ExtendStorageResponse {
  storage_until: string;
}

const getErrorCode = (err: unknown): string | null => {
  if (!(err instanceof FetchHttpError)) return null;
  if (!err.body || typeof err.body !== 'object') return null;
  return typeof err.body.code === 'string' ? err.body.code : null;
};

// Ne: Event storage suresini 1 ay uzatma istegi gonderir.
// Nasil: POST /api/event/<packedUid>/extend-storage cagirir; authFetch JWT'yi otomatik ekler, hata durumunda FetchHttpError firlatir.
// Neden: Modal "1 Ay Uzat" butonu tek bir noktadan endpoint'e baglansin; status'a gore (200/409/410/403) cagri yeri uygun toast'i gostersin.
export async function extendStorage(packedUid: string): Promise<ExtendStorageResponse> {
  const res = await authFetch(`${SERV_ROOT}/api/event/${packedUid}/extend-storage`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  const data = await res.json();
  return data as ExtendStorageResponse;
}

// Ne: 409 ALREADY_EXTENDED hatasini ayirt eder.
// Nasil: FetchHttpError olup status 409 ve body.code === 'ALREADY_EXTENDED' ise true doner.
// Neden: Modal ve toast katmani bu duruma "info" varyantiyla cevap verebilsin (event'in zaten uzatildigini bildirsin).
export const isAlreadyExtendedError = (err: unknown): boolean => {
  if (!(err instanceof FetchHttpError)) return false;
  if (err.status !== 409) return false;
  return getErrorCode(err) === ALREADY_EXTENDED_CODE;
};

// Ne: 409 EXTEND_REJECTED hatasini ayirt eder.
// Nasil: FetchHttpError olup status 409 ve body.code === 'EXTEND_REJECTED' ise true doner.
// Neden: Eligibility kosullari saglanmadiginda (suresi gecmis vb.) UI "error" toast'ina dusebilsin.
export const isExtendRejectedError = (err: unknown): boolean => {
  if (!(err instanceof FetchHttpError)) return false;
  if (err.status !== 409) return false;
  return getErrorCode(err) === EXTEND_REJECTED_CODE;
};

// Ne: 403 yetki hatasini ayirt eder.
// Nasil: FetchHttpError olup status 403 ise true doner; defansif fallback amacli.
// Neden: Sahibi olmayan biri butonu zorlarsa UI net bir "yetkiniz yok" mesaji gosterebilsin.
export const isExtendForbiddenError = (err: unknown): boolean => {
  if (!(err instanceof FetchHttpError)) return false;
  return err.status === 403;
};
