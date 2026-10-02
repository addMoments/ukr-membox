import { saveUrl } from './download';

// Ne: Misafirin "bu fotografi telefonuma kaydet" niyetine platforma gore en kisa yol (AM-16).
//   iPhone / iPad (iOS'taki her tarayici WebKit): Web Share ile paylasim menusu acilir;
//     "Save Image" / "Save Video" dosyayi dogrudan Fotograflar'a yazar.
//   Android ve masaustu: dogrudan indirme. Android'de indirilen fotograf galerinin
//     Download albumunde gorunur; masaustunde beklenen de zaten indirmedir.
// Neden: iOS'ta indirme dosyayi Fotograflar'a degil Dosyalar > Indirilenler'e koyuyordu; musteri
//        "indir -> indirilenler -> ac -> paylas -> kaydet" zincirini sikayet etti.
// Kisit: iOS paylasim menusunu ancak dokunustan hemen sonra acar. Dosya once indirilmis olmali:
//        goruntuleyicide acilan fotograf onceden alinir (prefetchForSave); dosya dokunus aninda
//        hazir degilse ve izin bu arada dustuyse 'needs_tap' doner, ikinci dokunus menuyu hemen acar.

// Bu boyutun ustu paylasim icin bellege alinmaz (iOS Safari'yi cokertebilir); indirmeye duser.
const SHARE_MAX_BYTES = 100 * 1024 * 1024;
// Goruntuleyicide gezinirken bellekte en fazla bu kadar dosya tutulur.
const CACHE_LIMIT = 3;

export type SaveOutcome = 'shared' | 'cancelled' | 'downloaded' | 'needs_tap';

export const isAppleMobile = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let shareFilesSupported: boolean | null = null;
const canShareFiles = () => {
  if (shareFilesSupported === null) {
    try {
      const probe = new File([new Blob(['x'], { type: 'image/jpeg' })], 'probe.jpg', { type: 'image/jpeg' });
      shareFilesSupported = typeof navigator.share === 'function'
        && typeof navigator.canShare === 'function'
        && navigator.canShare({ files: [probe] });
    } catch {
      shareFilesSupported = false;
    }
  }
  return shareFilesSupported;
};

// true: kaydetme paylasim menusuyle Fotograflar'a gider (dugme metni ve simgesi buna gore).
export const savesToPhotos = () => isAppleMobile() && canShareFiles();

const pending = new Map<string, Promise<File>>();
const ready = new Map<string, File>();

const remember = (url: string, file: File) => {
  ready.delete(url);
  ready.set(url, file);
  while (ready.size > CACHE_LIMIT) {
    const oldest = ready.keys().next().value as string;
    ready.delete(oldest);
    pending.delete(oldest);
  }
};

// Ne: Dosyayi paylasima hazir File olarak alir; ayni adres icin tek istek.
// Not: Projenin fetch'i Authorization basligi ekliyor, S3 onu istemez; dogrudan window.fetch.
export const prefetchForSave = (url: string, filename: string): Promise<File> => {
  const known = pending.get(url);
  if (known) return known;
  const request = window.fetch(url, { mode: 'cors', credentials: 'omit' })
    .then((res) => {
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      remember(url, file);
      return file;
    });
  request.catch(() => pending.delete(url));
  pending.set(url, request);
  return request;
};

export const isReadyToSave = (url: string) => ready.has(url);

// size: bilinmiyorsa null; buyuk videolar paylasim yerine indirilir.
export const saveMedia = async (url: string, filename: string, size?: number | null): Promise<SaveOutcome> => {
  if (!savesToPhotos() || (size && size > SHARE_MAX_BYTES)) {
    await saveUrl(url, filename);
    return 'downloaded';
  }

  // Hazir dosyada araya await girmez: paylasim dokunusla ayni gorevde cagrilir.
  const readyFile = ready.get(url);
  const file = readyFile || await prefetchForSave(url, filename);
  try {
    await navigator.share({ files: [file] });
    return 'shared';
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'AbortError') return 'cancelled';
    if (name === 'NotAllowedError' && !readyFile) return 'needs_tap';
    throw err;
  }
};
