import { SERV_ROOT } from '../consts';
import { FetchHttpError, fetch as authFetch } from './core';
import {
  AddonUploadUrlRequest,
  AddonUploadUrlResponse,
  AdminProduct,
  AdminProductOptions,
  UpdateAdminProductPayload,
} from '../types/admin-products';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord => {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
};

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  return undefined;
};

const parseJsonOrThrow = async (res: Response, endpointLabel: string): Promise<unknown> => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.slice(0, 120).replace(/\s+/g, ' ');
    throw new Error(`${endpointLabel} JSON donmedi. Gelen cevap: ${snippet}`);
  }
};

const normalizeOptions = (value: unknown): AdminProductOptions => {
  const raw = asRecord(value);
  return {
    guest_count: parseNumber(raw.guest_count),
    media_count: parseNumber(raw.media_count),
    activation_days: parseNumber(raw.activation_days),
    storage_days: parseNumber(raw.storage_days),
    voice_included: parseBoolean(raw.voice_included),
    advertorial_included: parseBoolean(raw.advertorial_included),
    sponsored_included: parseBoolean(raw.sponsored_included),
    image: typeof raw.image === 'string' ? raw.image : undefined,
    mobile_image: typeof raw.mobile_image === 'string' ? raw.mobile_image : undefined,
  };
};

const normalizeAdminProduct = (value: unknown): AdminProduct => {
  const raw = asRecord(value);
  const options = normalizeOptions(raw.options);
  return {
    uid: typeof raw.uid === 'string' ? raw.uid : '',
    id: typeof raw.id === 'string' ? raw.id : '',
    price: parseNumber(raw.price) ?? 0,
    display_name_en: typeof raw.display_name_en === 'string' ? raw.display_name_en : undefined,
    display_name_uk: typeof raw.display_name_uk === 'string' ? raw.display_name_uk : undefined,
    display_description_en: typeof raw.display_description_en === 'string' ? raw.display_description_en : undefined,
    display_description_uk: typeof raw.display_description_uk === 'string' ? raw.display_description_uk : undefined,
    display_bullets_en: typeof raw.display_bullets_en === 'string' ? raw.display_bullets_en : undefined,
    display_bullets_uk: typeof raw.display_bullets_uk === 'string' ? raw.display_bullets_uk : undefined,
    options,
    priority: parseNumber(raw.priority) ?? 0,
    fullfillment_type: typeof raw.fullfillment_type === 'string' ? raw.fullfillment_type : 'digital',
    granted_features: Array.isArray(raw.granted_features)
      ? raw.granted_features.filter((x): x is number => typeof x === 'number')
      : [],
    voice_included: parseBoolean(raw.voice_included) ?? options.voice_included,
    advertorial_included: parseBoolean(raw.advertorial_included) ?? options.advertorial_included,
    sponsored_included: parseBoolean(raw.sponsored_included) ?? options.sponsored_included,
    is_add_on: Boolean(raw.is_add_on),
    is_enabled: Boolean(raw.is_enabled),
  };
};

const mapAdminFetchError = (err: unknown): never => {
  if (err instanceof FetchHttpError && [401, 403, 303, 307].includes(err.status)) {
    throw new Error('Access denied. Please sign in with a super-admin account.');
  }
  throw err;
};

// Ne: Admin urun listesini backend'den cekip ekranda kullanilabilir tek tipte dondurur.
// Nasil: Redirect'i manuel yakalar, JSON parse eder ve gelen karmasik alanlari (price/options) normalize eder.
// Neden: Admin/products ekrani backend formatina bagimli kalmadan stabil calissin ve yetkisiz durumda anlamli hata gostersin.
export async function getAdminProducts(): Promise<AdminProduct[]> {
  try {
    const res = await authFetch(`${SERV_ROOT}/api/admin/products`, {
      headers: { Accept: 'application/json' },
      redirect: 'manual',
    });
    const data = await parseJsonOrThrow(res, 'GET /api/admin/products');
    if (!Array.isArray(data)) return [];
    return data.map(normalizeAdminProduct);
  } catch (err) {
    return mapAdminFetchError(err);
  }
}

// Ne: Tek bir urunu admin ekranindan gunceller.
// Nasil: PATCH endpoint'ine display_* ve fiyat/limit alanlarini gonderir, donen cevabi normalize edip geri verir.
// Neden: product_id degismeden yalnizca gorunen metin ve paket kurallari admin override ile degisebilsin.
export async function updateAdminProduct(productUID: string, payload: UpdateAdminProductPayload): Promise<AdminProduct> {
  try {
    const res = await authFetch(`${SERV_ROOT}/api/admin/products/${productUID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'manual',
    });
    const data = await parseJsonOrThrow(res, `PATCH /api/admin/products/${productUID}`);
    return normalizeAdminProduct(data);
  } catch (err) {
    return mapAdminFetchError(err);
  }
}

// Ne: Add-on icin S3 presigned upload bilgilerini backend'den alir.
// Nasil: POST /api/admin/products/upload-url cagirir, content_type / size_bytes ile super-admin endpointine istek atar.
// Neden: Frontend dosyayi direkt S3'e PUT edebilsin; backend public_url'i daha sonra PATCH ile dogrulayacak.
export async function getAddonUploadUrl(payload: AddonUploadUrlRequest): Promise<AddonUploadUrlResponse> {
  try {
    const res = await authFetch(`${SERV_ROOT}/api/admin/products/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'manual',
    });
    const data = await parseJsonOrThrow(res, 'POST /api/admin/products/upload-url');
    return data as AddonUploadUrlResponse;
  } catch (err) {
    return mapAdminFetchError(err);
  }
}

// Ne: Presigned URL'e dosyayi raw binary olarak PUT eder.
// Nasil: Native fetch kullanilir; Authorization header'i kasten eklenmez, sadece backend'in dondugu required_headers gonderilir.
// Neden: S3 presigned PUT Authorization header'i kabul etmez; aksi halde imza dogrulamasi kirilir.
export async function uploadFileToS3(uploadUrl: string, file: File, requiredHeaders: Record<string, string>): Promise<void> {
  const res = await window.fetch(uploadUrl, {
    method: 'PUT',
    headers: { ...requiredHeaders },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`S3 upload failed (status ${res.status}).`);
  }
}

// Ne: Add-on urununun options.image alanini yeni public_url ile gunceller.
// Nasil: Backend kontratina uygun sekilde PATCH /api/admin/products/:uid icine sadece options.image koyar.
// Neden: PUT zinciri basariyla tamamlandiktan sonra DB tarafinda image referansi tek bir alandan yonetilsin.
export async function setAddonImage(productUID: string, publicUrl: string): Promise<AdminProduct> {
  return updateAdminProduct(productUID, { options: { image: publicUrl } });
}

// Ne: Add-on urununun mobil options.mobile_image alanini yeni public_url ile gunceller.
// Nasil: Mevcut admin products PATCH kontratina yalnizca options.mobile_image payload'u yollar.
// Neden: Mobil fiyat/kart gorseli desktop gorselden bagimsiz yonetilebilsin.
export async function setAddonMobileImage(productUID: string, publicUrl: string): Promise<AdminProduct> {
  return updateAdminProduct(productUID, { options: { mobile_image: publicUrl } });
}

// Ne: Add-on urununun options.image alanini temizler.
// Nasil: Backend kontratina uygun sekilde options.image alanina bos string gonderir; backend bu durumda alani kaldirir.
// Neden: Admin "Remove" butonuna bastiginda kullanici icin tek tikta gorseli kaldirmak ve ekrandaki state'i hizla guncellemek.
export async function removeAddonImage(productUID: string): Promise<AdminProduct> {
  return updateAdminProduct(productUID, { options: { image: '' } });
}

// Ne: Add-on urununun options.mobile_image alanini temizler.
// Nasil: Backend kontratina uygun sekilde mobile_image alanina bos string gonderir.
// Neden: Mobil gorsel kaldirildiginda public tarafta options.image fallback'i devreye girebilsin.
export async function removeAddonMobileImage(productUID: string): Promise<AdminProduct> {
  return updateAdminProduct(productUID, { options: { mobile_image: '' } });
}

// Ne: Add-on urununun is_enabled bayragini gunceller.
// Nasil: PATCH /api/admin/products/:uid'a yalnizca { is_enabled } gonderir; backend core paketlerde 422 dondurur.
// Neden: Admin add-on satirini hizlica aktif/pasif yapsin; public /api/products zaten is_enabled=true filtreli oldugu icin pasif olan add-on otomatik gizlensin.
export async function setAddonEnabled(productUID: string, isEnabled: boolean): Promise<AdminProduct> {
  return updateAdminProduct(productUID, { is_enabled: isEnabled });
}

const ADDON_IMAGE_ALLOWED_MIME: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

const ADDON_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// Ne: Admin panelden secilen add-on gorsel dosyasini backend kurallarina gore dogrular.
// Nasil: MIME tipi whitelist, 5MB ust limiti ve uzanti-MIME uyumu kontrol edilir; hata varsa kullaniciya net mesaj donulur.
// Neden: Gereksiz upload-url + S3 PUT cagrilarinin onune gecip kullaniciya hatayi en erken adimda gostermek.
export function validateAddonImageFile(file: File): string | null {
  const allowedExts = ADDON_IMAGE_ALLOWED_MIME[file.type];
  if (!allowedExts) {
    return 'Only JPG, PNG or WebP images are allowed.';
  }

  if (file.size > ADDON_IMAGE_MAX_BYTES) {
    return 'Image must be 5MB or smaller.';
  }

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ext || !allowedExts.includes(ext)) {
    return 'File extension does not match the image type.';
  }

  return null;
}
