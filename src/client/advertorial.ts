import { SERV_ROOT } from '../consts';
import { fetch as authFetch } from './core';
import {
  AdvertorialConfig,
  AdvertorialResponse,
  AdvertorialUploadUrlRequest,
  AdvertorialUploadUrlResponse,
} from '../types/advertorial';

// Ne: Event admin reklam alani ayarini backend'den okur.
// Nasil: Auth fetch ile GET /api/event/<packedUid>/advertorial cagrilir ve enabled/config response'u typed donulur.
// Neden: Settings ekrani hak kontrolunu feature id yerine backend'in enabled kararindan yapsin.
export async function getAdvertorialConfig(packedUid: string): Promise<AdvertorialResponse> {
  const res = await authFetch(`${SERV_ROOT}/api/event/${packedUid}/advertorial`, {
    headers: { Accept: 'application/json' },
  });
  const data = await res.json();
  return data as AdvertorialResponse;
}

// Ne: Guest tarafinda gosterilecek public reklam ayarini okur.
// Nasil: Guest token/header akisini koruyan authFetch ile public endpoint cagrilir.
// Neden: Guest UI sadece enabled=true ve layout doluysa reklam grid'i render etsin.
export async function getPublicAdvertorialConfig(packedUid: string): Promise<AdvertorialResponse> {
  const res = await authFetch(`${SERV_ROOT}/api/event/${packedUid}/advertorial-public`, {
    headers: { Accept: 'application/json' },
  });
  const data = await res.json();
  return data as AdvertorialResponse;
}

// Ne: Reklam gorseli icin S3 presigned upload bilgilerini alir.
// Nasil: Dosya adi, MIME tipi ve byte boyutu backend'e POST edilir; backend upload_url ve public_url doner.
// Neden: Frontend dosyayi direkt S3'e yuklesin, kaydedilecek image_url ise backend'in verdigi public_url olsun.
export async function getAdvertorialUploadUrl(
  packedUid: string,
  payload: AdvertorialUploadUrlRequest
): Promise<AdvertorialUploadUrlResponse> {
  const res = await authFetch(`${SERV_ROOT}/api/event/${packedUid}/advertorial/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return data as AdvertorialUploadUrlResponse;
}

// Ne: Event reklam layout ve cell listesini kaydeder.
// Nasil: PATCH /api/event/<packedUid>/advertorial endpoint'ine layout/cells payload'u gonderilir.
// Neden: "Yok" dahil tum aktiflik durumu backend sozlesmesindeki layout degeriyle temsil edilsin.
export async function saveAdvertorialConfig(
  packedUid: string,
  payload: AdvertorialConfig
): Promise<AdvertorialResponse> {
  const res = await authFetch(`${SERV_ROOT}/api/event/${packedUid}/advertorial`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return data as AdvertorialResponse;
}

// Ne: Secilen reklam gorselini presigned S3 URL'ine yukler.
// Nasil: Native window.fetch ile PUT yapar ve sadece backend'in required_headers degerlerini yollar.
// Neden: Auth wrapper Authorization/X-Event gibi ekstra header ekleyip S3 imzasini gecersiz kilmasin.
export async function uploadAdvertorialImage(
  uploadUrl: string,
  file: File,
  requiredHeaders: Record<string, string>
): Promise<void> {
  const res = await window.fetch(uploadUrl, {
    method: 'PUT',
    headers: { ...requiredHeaders },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Advertorial image upload failed (status ${res.status}).`);
  }
}
