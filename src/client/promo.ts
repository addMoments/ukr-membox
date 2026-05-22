import { SERV_ROOT } from '../consts';
import { FetchHttpError, fetch as authFetch } from './core';
import {
  AdminPromo,
  CreatePromoPayload,
  PromoReportRow,
  PromoValidationRequest,
  PromoValidationResponse,
  UpdatePromoPayload,
} from '../types/promo';

type UnknownRecord = Record<string, unknown>;

// Ne: Bilinmeyen JSON cevabini guvenli object formatina indirger.
// Nasil: Sadece null olmayan object degerleri Record kabul eder.
// Neden: Backend response alanlarini runtime'da tip hatasi almadan okuyabilmek.
const asRecord = (value: unknown): UnknownRecord => {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
};

// Ne: Backend'den string veya number gelebilen parasal/sayisal alanlari number'a cevirir.
// Nasil: Gecerli number veya numeric string disindaki degerleri 0 kabul eder.
// Neden: Admin listesi ve rapor ekranlari eksik alanlarda kirilmasin.
const parseNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

// Ne: Nullable sayisal backend alanlarini normalize eder.
// Nasil: Bos/null degerleri null, dolu degerleri parseNumber sonucu olarak dondurur.
// Neden: usage_limit_total gibi optional alanlar UI'da bos birakilabilsin.
const parseOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  return parseNumber(value);
};

// Ne: Nullable tarih/metin backend alanlarini normalize eder.
// Nasil: Dolu string degeri korur, diger tum degerleri null yapar.
// Neden: valid_from/valid_until alanlari rapor ve CRUD ekranlarinda tutarli gorunsun.
const parseOptionalString = (value: unknown): string | null => {
  return typeof value === 'string' && value ? value : null;
};

// Ne: Response body'yi JSON olarak okur veya anlamli hata uretir.
// Nasil: Text cevabi JSON.parse ile dener, basarisizsa kisa snippet'i hata mesajina koyar.
// Neden: Backend HTML/redirect dondurdugunde admin ekraninda sessiz bozulma olmasin.
const parseJsonOrThrow = async (res: Response, endpointLabel: string): Promise<unknown> => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.slice(0, 120).replace(/\s+/g, ' ');
    throw new Error(`${endpointLabel} JSON donmedi. Gelen cevap: ${snippet}`);
  }
};

// Ne: Admin promo response'unu frontend modeline cevirir.
// Nasil: UID/code/aktiflik/tarih/limit alanlarini tiplerine gore normalize eder.
// Neden: CRUD ekranlari backend veri formatindaki string-number farklarindan etkilenmesin.
const normalizePromo = (value: unknown): AdminPromo => {
  const raw = asRecord(value);
  return {
    uid: typeof raw.uid === 'string' ? raw.uid : '',
    code: typeof raw.code === 'string' ? raw.code : '',
    discount_type: typeof raw.discount_type === 'string' ? raw.discount_type : undefined,
    discount_value: parseNumber(raw.discount_value),
    valid_from: parseOptionalString(raw.valid_from),
    valid_until: parseOptionalString(raw.valid_until),
    usage_limit_total: parseOptionalNumber(raw.usage_limit_total),
    usage_count: parseNumber(raw.usage_count),
    is_active: raw.is_active === true,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : undefined,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
  };
};

// Ne: Promo report satirini frontend'in bekledigi numeric modele cevirir.
// Nasil: Toplam alanlarini number, tarih alanlarini nullable string olarak normalize eder.
// Neden: Rapor kartlari hesaplama yapmadan guvenli formatlama yapabilsin.
const normalizeReportRow = (value: unknown): PromoReportRow => {
  const raw = asRecord(value);
  return {
    promo_code_uid: typeof raw.promo_code_uid === 'string' ? raw.promo_code_uid : '',
    promo_code: typeof raw.promo_code === 'string' ? raw.promo_code : '',
    usage_count: parseNumber(raw.usage_count),
    gross_total: parseNumber(raw.gross_total),
    discount_total: parseNumber(raw.discount_total),
    net_total: parseNumber(raw.net_total),
    first_used_at: parseOptionalString(raw.first_used_at),
    last_used_at: parseOptionalString(raw.last_used_at),
  };
};

export const promoErrorMessages: Record<string, string> = {
  promo_not_found: 'Promo code not found',
  promo_expired: 'Promo code expired',
  promo_requires_premium: 'Promo code applies only to premium package',
  promo_usage_limit_reached: 'Promo code usage limit reached',
  promo_inactive: 'Promo code is inactive',
  promo_code_required: 'Promo code is required',
  promo_not_started: 'Promo code is not active yet',
  promo_unsupported_discount_type: 'Promo code cannot be applied',
  invalid_purchase_info: 'Cart information is invalid',
};

// Ne: Backend promo hata cevabindan kullaniciya gosterilecek hata kodunu ceker.
// Nasil: error_code/code/error/message alanlarini sirayla dener ve bilinen kodlari map'ler.
// Neden: Backend hata formatinda ufak farklar olsa bile checkout kullaniciya okunur mesaj gostersin.
export function getPromoErrorMessage(err: unknown): string {
  if (err instanceof FetchHttpError) {
    const body = asRecord(err.body);
    const code = [body.error_code, body.code, body.error, body.message]
      .find((value): value is string => typeof value === 'string');
    if (code && promoErrorMessages[code]) return promoErrorMessages[code];
    if (typeof body.message === 'string') return body.message;
  }

  if (err instanceof Error) return err.message;
  return 'Promo code could not be applied';
}

// Ne: Checkout promo kodunu backend'e dogrulatir.
// Nasil: POST /api/promo/validate endpointine promo_code ve purchase_info payload'unu yollar.
// Neden: Premium-only indirim ve add-on hariç tutma kurallari backend'deki tek kaynaktan hesaplansin.
export async function validatePromoCode(payload: PromoValidationRequest): Promise<PromoValidationResponse> {
  const res = await authFetch(`${SERV_ROOT}/api/promo/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow(res, 'POST /api/promo/validate');
  const raw = asRecord(data);
  return {
    promo_code_uid: typeof raw.promo_code_uid === 'string' ? raw.promo_code_uid : '',
    promo_code_text_snapshot: typeof raw.promo_code_text_snapshot === 'string' ? raw.promo_code_text_snapshot : payload.promo_code,
    gross_total: parseNumber(raw.gross_total),
    discount_amount: parseNumber(raw.discount_amount),
    net_total: parseNumber(raw.net_total),
  };
}

// Ne: Super admin promo listesini getirir.
// Nasil: GET /api/admin/promos cevabini array ise normalize eder, degilse bos liste dondurur.
// Neden: Promo CRUD ekraninda backend numerik/string farklari UI'yi bozmasin.
export async function getAdminPromos(): Promise<AdminPromo[]> {
  const res = await authFetch(`${SERV_ROOT}/api/admin/promos`, {
    headers: { Accept: 'application/json' },
    redirect: 'manual',
  });
  const data = await parseJsonOrThrow(res, 'GET /api/admin/promos');
  return Array.isArray(data) ? data.map(normalizePromo) : [];
}

// Ne: Yeni promo kodu olusturur.
// Nasil: Super admin formundan hazirlanan payload'u POST /api/admin/promos endpointine yollar.
// Neden: Optional tarih ve limit alanlari yalnizca kullanici doldurduysa backend'e gitsin.
export async function createAdminPromo(payload: CreatePromoPayload): Promise<AdminPromo> {
  const res = await authFetch(`${SERV_ROOT}/api/admin/promos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'manual',
  });
  const data = await parseJsonOrThrow(res, 'POST /api/admin/promos');
  return normalizePromo(data);
}

// Ne: Var olan promo kodunun duzenlenebilir alanlarini gunceller.
// Nasil: promoUID path parametresiyle PATCH /api/admin/promos/:promoUID endpointine partial payload yollar.
// Neden: Liste ekranindan form degerleri degistiginde yalnizca promo kaydi yenilensin.
export async function updateAdminPromo(promoUID: string, payload: UpdatePromoPayload): Promise<AdminPromo> {
  const res = await authFetch(`${SERV_ROOT}/api/admin/promos/${promoUID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'manual',
  });
  const data = await parseJsonOrThrow(res, `PATCH /api/admin/promos/${promoUID}`);
  return normalizePromo(data);
}

// Ne: Promo kodunu aktif veya pasif yapar.
// Nasil: Backend kontratindaki enable/disable action endpointlerinden uygun olani POST eder.
// Neden: Soft durum degisikligi CRUD formundan ayri ve tek tik aksiyon olarak kalabilsin.
export async function setAdminPromoActive(promoUID: string, active: boolean): Promise<AdminPromo> {
  const action = active ? 'enable' : 'disable';
  const res = await authFetch(`${SERV_ROOT}/api/admin/promos/${promoUID}/${action}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    redirect: 'manual',
  });
  const data = await parseJsonOrThrow(res, `POST /api/admin/promos/${promoUID}/${action}`);
  return normalizePromo(data);
}

// Ne: Promo kodunu soft delete eder.
// Nasil: DELETE /api/admin/promos/:promoUID endpointini cagirir.
// Neden: Super admin kullanilmayan promosyonlari listeden kaldirabilsin, kalici silme karari backend'de kalsin.
export async function deleteAdminPromo(promoUID: string): Promise<void> {
  await authFetch(`${SERV_ROOT}/api/admin/promos/${promoUID}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    redirect: 'manual',
  });
}

// Ne: Promo kullanim raporunu tarih filtresiyle veya filtresiz getirir.
// Nasil: from/to varsa query string'e ekler, GET /api/admin/promos/report cevabini normalize eder.
// Neden: Super admin odeme sonrasi gross/discount/net etkisini promo bazinda gorebilsin.
export async function getAdminPromoReport(filters: { from?: string; to?: string } = {}): Promise<PromoReportRow[]> {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const qs = params.toString();
  const res = await authFetch(`${SERV_ROOT}/api/admin/promos/report${qs ? `?${qs}` : ''}`, {
    headers: { Accept: 'application/json' },
    redirect: 'manual',
  });
  const data = await parseJsonOrThrow(res, 'GET /api/admin/promos/report');
  return Array.isArray(data) ? data.map(normalizeReportRow) : [];
}
