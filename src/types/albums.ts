import { S3_ROOT, SITE_ROOT } from '../consts';
import { packUUID } from '../packages/uuid';

export type AlbumPrivacy = 'public' | 'private' | 'protected';

// albums tablosu (3-albums.sql). Host tarafi tum kolonlari okur.
export interface Album {
  uid: string;
  event_uid: string;
  name: string;
  album_date: string | null;
  location: string | null;
  description: string | null;
  // S3 yolu: yuklenen kapak ya da bir upload'un value'su
  cover: string | null;
  privacy: AlbumPrivacy;
  // yalnizca host okur; misafir sorgularinda kolon yok
  passcode?: string | null;
  guest_upload: boolean;
  guest_view: boolean;
  guest_download_all: boolean;
  // "General": silinemez, albumsuz yuklemeler buraya duser
  is_default: boolean;
  sort_order: number;
  created_at?: string;
  deleted_at?: string | null;
}

// Misafir tarafinin gordugu alt kume. Misafir sorgulari select=* yerine bu listeyle gider:
// passcode kolonu misafir arayuzune hic gelmesin. (Asil koruma RLS: misafir yalnizca
// zaten actigi protected albumu gorur, bkz. 3-albums.sql'deki not.)
export const GUEST_ALBUM_COLUMNS =
  'uid,event_uid,name,album_date,location,description,cover,privacy,guest_upload,guest_view,guest_download_all,is_default,sort_order';

export type GuestAlbum = Omit<Album, 'passcode' | 'created_at' | 'deleted_at'>;

export type AlbumListSort = 'name' | 'date';

// Yeni album icin form degerleri (PostgREST POST/PATCH govdesi).
export interface AlbumInput {
  name: string;
  album_date: string | null;
  location: string | null;
  description: string | null;
  cover?: string | null;
  privacy: AlbumPrivacy;
  passcode: string | null;
  guest_upload: boolean;
  guest_view: boolean;
  guest_download_all: boolean;
}

export const albumGuestUrl = (albumUid: string) => {
  return SITE_ROOT + '/l/a' + packUUID(albumUid);
};

// Backend qr.AlbumQRPath ile ayni yol.
export const albumQrImageUrl = (eventUid: string, albumUid: string) => {
  return S3_ROOT + '/events/' + packUUID(eventUid) + '/albums/' + packUUID(albumUid) + '/qr.png';
};

export const albumCoverUrl = (album: { cover: string | null }) => {
  return album.cover ? S3_ROOT + album.cover : null;
};

// Album listesi siralamasi: General hep ilk, sonra ada ya da tarihe gore.
export const sortAlbums = <T extends GuestAlbum>(albums: T[], sort: AlbumListSort): T[] => {
  const copy = [...albums];
  copy.sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    if (sort === 'name') return a.name.localeCompare(b.name);
    // Tarihsizler en sona; ayni tarihte olusturulma sirasi (sort_order) korunur.
    const ad = a.album_date || '';
    const bd = b.album_date || '';
    if (ad !== bd) {
      if (!ad) return 1;
      if (!bd) return -1;
      return ad.localeCompare(bd);
    }
    return a.sort_order - b.sort_order;
  });
  return copy;
};
