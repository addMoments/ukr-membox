import { SERV_ROOT } from '../consts';
import { fetch as authFetch } from './core';
import {
  AdminPartnership,
  CreatePartnershipPayload,
  PartnershipMetrics,
  UpdatePartnershipPayload,
} from '../types/partnership';

type UnknownRecord = Record<string, unknown>;

// Ne: Bilinmeyen JSON cevabini guvenli object formatina indirger.
// Nasil: Sadece null olmayan object degerleri Record kabul eder.
// Neden: Backend response alanlarini runtime'da tip hatasi almadan okuyabilmek.
const asRecord = (value: unknown): UnknownRecord => {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
};

// Ne: Backend'den string veya number gelebilen metrik alanlarini number'a cevirir.
// Nasil: Gecerli number veya numeric string disindaki degerleri 0 kabul eder.
// Neden: Partnership metrik kartlari eksik alanlarda kirilmasin.
const parseNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

// Ne: Nullable tarih/metin backend alanlarini normalize eder.
// Nasil: Dolu string degeri korur, diger tum degerleri null yapar.
// Neden: Optional contact ve tarih alanlari UI'da tutarli gorunsun.
const parseOptionalString = (value: unknown): string | null => {
  return typeof value === 'string' && value ? value : null;
};

// Ne: Backend'in farkli partnership uid alan adlarini tek string'e indirger.
// Nasil: uid, partnership_uid ve partnershipUID alanlarini sirayla dener.
// Neden: Promo response icindeki nested partnership objesi farkli uid adi kullansa bile dropdown secili kalsin.
const parsePartnershipUID = (raw: UnknownRecord): string => {
  if (typeof raw.uid === 'string' && raw.uid) return raw.uid;
  if (typeof raw.partnership_uid === 'string' && raw.partnership_uid) return raw.partnership_uid;
  if (typeof raw.partnershipUID === 'string' && raw.partnershipUID) return raw.partnershipUID;
  return '';
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

// Ne: Partnership metrics response'unu frontend modeline cevirir.
// Nasil: Sayisal toplamlari number, tarih alanlarini nullable string olarak normalize eder.
// Neden: Detay ekranindaki metrik kartlari backend format farklarindan etkilenmesin.
const normalizeMetrics = (value: unknown): PartnershipMetrics => {
  const raw = asRecord(value);
  return {
    promo_count: parseNumber(raw.promo_count),
    usage_count: parseNumber(raw.usage_count),
    gross_total: parseNumber(raw.gross_total),
    discount_total: parseNumber(raw.discount_total),
    net_total: parseNumber(raw.net_total),
    first_used_at: parseOptionalString(raw.first_used_at),
    last_used_at: parseOptionalString(raw.last_used_at),
  };
};

// Ne: Admin partnership response'unu frontend modeline cevirir.
// Nasil: Kimlik, zorunlu isim alanlari, optional contact alanlari ve varsa metrics objesini normalize eder.
// Neden: Liste, detay ve promo secim ekranlari ayni guvenli Partnership modelini kullansin.
export const normalizePartnership = (value: unknown): AdminPartnership => {
  const raw = asRecord(value);
  return {
    uid: parsePartnershipUID(raw),
    name: typeof raw.name === 'string' ? raw.name : '',
    surname: typeof raw.surname === 'string' ? raw.surname : '',
    company_name: parseOptionalString(raw.company_name),
    phone: parseOptionalString(raw.phone),
    email: parseOptionalString(raw.email),
    is_active: raw.is_active !== false,
    metrics: raw.metrics ? normalizeMetrics(raw.metrics) : undefined,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : undefined,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
  };
};

// Ne: Partnership liste response'unu farkli backend wrapper formatlarindan cikarir.
// Nasil: Direkt array'i veya data/items/partnerships alanlarindaki array'i kabul eder.
// Neden: Dropdown ve liste ekranlari backend'in liste cevabi wrapper'li gelse bile bos kalmasin.
const getPartnershipArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const raw = asRecord(value);
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.partnerships)) return raw.partnerships;
  return [];
};

// Ne: Super admin partnership listesini getirir.
// Nasil: GET /api/admin/partnerships cevabini array veya bilinen wrapper formatindan cikarip normalize eder.
// Neden: Partnership liste ve promo secim ekranlari backend veri formatindan etkilenmeden calissin.
export async function getAdminPartnerships(): Promise<AdminPartnership[]> {
  const res = await authFetch(`${SERV_ROOT}/api/admin/partnerships`, {
    headers: { Accept: 'application/json' },
    redirect: 'manual',
  });
  const data = await parseJsonOrThrow(res, 'GET /api/admin/partnerships');
  return getPartnershipArray(data).map(normalizePartnership);
}

// Ne: Yeni partnership kaydi olusturur.
// Nasil: Super admin formundan hazirlanan payload'u POST /api/admin/partnerships endpointine yollar.
// Neden: Partnership CRUD ekrani backend'deki tek kaynaktan yeni partner olustursun.
export async function createAdminPartnership(payload: CreatePartnershipPayload): Promise<AdminPartnership> {
  const res = await authFetch(`${SERV_ROOT}/api/admin/partnerships`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'manual',
  });
  const data = await parseJsonOrThrow(res, 'POST /api/admin/partnerships');
  return normalizePartnership(data);
}

// Ne: Tek partnership detayini getirir.
// Nasil: partnershipUID path parametresiyle GET /api/admin/partnerships/:partnershipUID endpointini cagirir.
// Neden: Detay sayfasi partner bilgilerini ve metrics kartlarini guncel backend verisiyle gostersin.
export async function getAdminPartnership(partnershipUID: string): Promise<AdminPartnership> {
  const res = await authFetch(`${SERV_ROOT}/api/admin/partnerships/${partnershipUID}`, {
    headers: { Accept: 'application/json' },
    redirect: 'manual',
  });
  const data = await parseJsonOrThrow(res, `GET /api/admin/partnerships/${partnershipUID}`);
  return normalizePartnership(data);
}

// Ne: Var olan partnership kaydinin duzenlenebilir alanlarini gunceller.
// Nasil: partnershipUID path parametresiyle PATCH /api/admin/partnerships/:partnershipUID endpointine partial payload yollar.
// Neden: Liste veya detay ekranindan yapilan degisiklikler yalnizca ilgili partner kaydini yenilesin.
export async function updateAdminPartnership(partnershipUID: string, payload: UpdatePartnershipPayload): Promise<AdminPartnership> {
  const res = await authFetch(`${SERV_ROOT}/api/admin/partnerships/${partnershipUID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'manual',
  });
  const data = await parseJsonOrThrow(res, `PATCH /api/admin/partnerships/${partnershipUID}`);
  return normalizePartnership(data);
}

// Ne: Partnership kaydini admin listesinden kaldirir.
// Nasil: DELETE /api/admin/partnerships/:partnershipUID endpointini cagirir.
// Neden: Soft delete karari backend'de kalirken frontend kaydi normal silme gibi listeden cikarsin.
export async function deleteAdminPartnership(partnershipUID: string): Promise<void> {
  await authFetch(`${SERV_ROOT}/api/admin/partnerships/${partnershipUID}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    redirect: 'manual',
  });
}
