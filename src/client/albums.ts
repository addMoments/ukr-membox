import { SERV_ROOT } from '../consts';
import { packUUID } from '../packages/uuid';
import { Album, AlbumInput, GUEST_ALBUM_COLUMNS, GuestAlbum } from '../types/albums';
import { fetch, FetchHttpError } from './core';
import { pgErr, pgREST } from './postgrest';
import { saveBlob } from '../utils/download';

// ---------------------------------------------------------------------------
// Host (auth)
// ---------------------------------------------------------------------------

export const listAlbums = async (eventUid: string): Promise<Album[]> => {
  const res = await pgREST(`/albums?event_uid=eq.${eventUid}&deleted_at=is.null&order=is_default.desc,sort_order.asc,created_at.asc`);
  return Array.isArray(res) ? res : [];
};

// Album basina cope atilmamis medya adedi. Sayim istemcide: etkinlik medya limiti
// (products.options.media_count) bini gecmiyor, tek istek yeterli.
export const albumMediaCounts = async (eventUid: string): Promise<Record<string, number>> => {
  const rows = await pgREST(`/uploads?event_uid=eq.${eventUid}&trashed_at=is.null&upload_type=in.(photo,video)&select=album_uid`);
  const counts: Record<string, number> = {};
  (Array.isArray(rows) ? rows : []).forEach((row: { album_uid: string | null }) => {
    if (!row.album_uid) return;
    counts[row.album_uid] = (counts[row.album_uid] || 0) + 1;
  });
  return counts;
};

export const getAlbum = async (albumUid: string): Promise<Album | null> => {
  const res = await pgREST(`/albums?uid=eq.${albumUid}&deleted_at=is.null`);
  return Array.isArray(res) && res[0] ? res[0] : null;
};

export const createAlbum = async (eventUid: string, input: AlbumInput): Promise<Album> => {
  const { res, err } = await pgErr('/albums', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...input, event_uid: eventUid }),
  });
  if (err) throw err;
  return Array.isArray(res) ? res[0] : res;
};

export const updateAlbum = async (albumUid: string, input: Partial<AlbumInput>): Promise<Album> => {
  const { res, err } = await pgErr(`/albums?uid=eq.${albumUid}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(input),
  });
  if (err) throw err;
  return Array.isArray(res) ? res[0] : res;
};

export interface DeleteAlbumResult {
  success: boolean;
  already_deleted: boolean;
  trashed_count: number;
}

// Albumu siler ve icindeki medyayi cope tasir (membox-serv, tek transaction).
export const deleteAlbum = async (eventUid: string, albumUid: string): Promise<DeleteAlbumResult> => {
  const res = await fetch(`${SERV_ROOT}/api/event/${packUUID(eventUid)}/album/${packUUID(albumUid)}`, {
    method: 'DELETE',
  });
  return res.json();
};

// Fotograflari baska albume tasir. DB trigger'i hedef albumun ayni etkinlikte oldugunu dogrular.
export const moveUploadsToAlbum = async (uploadUids: string[], albumUid: string): Promise<void> => {
  if (uploadUids.length === 0) return;
  const { err } = await pgErr(`/uploads?uid=in.(${uploadUids.join(',')})`, {
    method: 'PATCH',
    body: JSON.stringify({ album_uid: albumUid }),
  });
  if (err) throw err;
};

export interface QrOptions {
  fgColor: string;
  bgColor: string;
  shape: string;
  logo?: string;
}

export const adjustAlbumQR = async (eventUid: string, albumUid: string, options?: QrOptions): Promise<void> => {
  await fetch(`${SERV_ROOT}/api/qr/${packUUID(eventUid)}/album/${packUUID(albumUid)}`, {
    method: 'POST',
    body: options ? JSON.stringify(options) : '{}',
  });
};

// QR dosyasi eksik albumlere varsayilan QR uretir (idempotent).
export const ensureAlbumQRs = async (eventUid: string): Promise<string[]> => {
  const res = await fetch(`${SERV_ROOT}/api/event/${packUUID(eventUid)}/albums/ensure-qr`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({ generated: [] }));
  return data?.generated || [];
};

// ---------------------------------------------------------------------------
// Misafir (webanon)
// ---------------------------------------------------------------------------

// Ana sayfa listesi: yalnizca public. Private/protected albumler linkten acilir,
// listede cikmaz (karar 11). RLS ayrica yuklemesi kapali albumleri gizler.
export const guestListAlbums = async (eventUid: string): Promise<GuestAlbum[]> => {
  const res = await pgREST(
    `/albums?event_uid=eq.${eventUid}&privacy=eq.public&select=${GUEST_ALBUM_COLUMNS}&order=is_default.desc,sort_order.asc,created_at.asc`
  );
  return Array.isArray(res) ? res : [];
};

export const guestGetAlbum = async (albumUid: string): Promise<GuestAlbum | null> => {
  const res = await pgREST(`/albums?uid=eq.${albumUid}&select=${GUEST_ALBUM_COLUMNS}`);
  return Array.isArray(res) && res[0] ? res[0] : null;
};

export type GuestAlbumErrorCode = 'ALBUM_CLOSED' | 'PASSCODE_REQUIRED' | 'PASSCODE_INVALID' | 'ALBUM_NOT_OPENED';

export const getGuestAlbumErrorCode = (err: unknown): GuestAlbumErrorCode | null => {
  if (!(err instanceof FetchHttpError)) return null;
  const code = err.body && typeof err.body === 'object' ? (err.body as { code?: unknown }).code : null;
  if (code === 'ALBUM_CLOSED' || code === 'PASSCODE_REQUIRED' || code === 'PASSCODE_INVALID' || code === 'ALBUM_NOT_OPENED') {
    return code;
  }
  return null;
};

export interface GuestOpenResult {
  ok: boolean;
  album_uid: string;
  guest_view: boolean;
}

// Albumu linkten acar; private/protected ise token'a isler (X-Auth-Token core.ts'de saklanir).
export const guestOpenAlbum = async (albumUid: string, passcode?: string): Promise<GuestOpenResult> => {
  const res = await fetch(`${SERV_ROOT}/api/guest/album/${packUUID(albumUid)}/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(passcode ? { passcode } : {}),
  });
  return res.json();
};

// Tum albumu zip olarak indirir (sunucu anlik akitir, S3'e yazmaz).
export const guestDownloadAlbumZip = async (albumUid: string, fileName: string): Promise<void> => {
  const res = await fetch(`${SERV_ROOT}/api/guest/album/${packUUID(albumUid)}/zip`, {
    method: 'GET',
  });
  const blob = await res.blob();
  saveBlob(blob, fileName);
};
