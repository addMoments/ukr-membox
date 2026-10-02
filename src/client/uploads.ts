import { SERV_ROOT } from "../consts";
import { packUUID } from "../packages/uuid";
import { fetch, FetchHttpError } from "./core";

type PresignResponse = Record<string, {
    upUrl: string;
    filePath: string;
}>;

export const uploadEventImage = async (
    file: File,
) => {
    const url = `${SERV_ROOT}/api/upload/event_image`;
    return uploadFiles(url, [file]);
};

export const uploadQrLogo = async (
    file: File,
) => {
    const url = `${SERV_ROOT}/api/upload/qr_logo`;
    return uploadFiles(url, [file]);
};

export const uploadAlbumCover = async (
    file: File,
) => {
    const url = `${SERV_ROOT}/api/upload/album_cover`;
    return uploadFiles(url, [file]);
};

// Ne: Misafir yuklemesinin neden basarisiz oldugu; modal buna gore mesaj secer.
//   unreadable   — tarayici dosyanin icerigini okuyamadi (tekrar denemek ise yaramaz,
//                  misafir dosyayi yeniden secmeli).
//   not_received — dosya birkac denemeye ragmen S3'e ulasmadi (ag).
export type GuestUploadFailReason = 'unreadable' | 'not_received';

export class GuestUploadError extends Error {
    reason: GuestUploadFailReason;

    constructor(reason: GuestUploadFailReason, message: string) {
        super(message);
        this.name = 'GuestUploadError';
        this.reason = reason;
    }
}

// Sunucunun /confirm cevabi (ukr-membox-serv upload_receipt.Status).
type ConfirmStatus = 'received' | 'pending' | 'missing' | 'empty' | 'duplicate';

// duplicate: ayni dosya bu albumde zaten vardi; sunucu yeni kopyayi sildi (AM-07). Misafir icin basari.
export type GuestUploadResult = { path: string; duplicate: boolean };

// Ilk deneme + iki tekrar; kisa kopmalari (tunel, baz istasyonu degisimi) atlatmaya yeter.
const RETRY_DELAYS_MS = [2000, 5000];

// Ne: Tek dosyanin yukleme asamasi; modal dosya satirinda gosterir (AM-01).
//   uploading  — dosya S3'e gidiyor (progress 0..1)
//   processing — PUT bitti, sunucu dosyayi S3'te dogruluyor (/confirm)
//   retrying   — ag hatasi; kisa bekleme sonrasi yeni deneme (attempt / of)
//   offline    — baglanti yok; gelince kendiliginden devam eder
export type GuestUploadPhase =
    | { phase: 'uploading'; progress: number }
    | { phase: 'processing' }
    | { phase: 'retrying'; attempt: number; of: number }
    | { phase: 'offline' };

export type GuestUploadOptions = {
    onPhase?: (phase: GuestUploadPhase) => void;
    // Misafir "Durdur"a basinca yukleme ve beklemeler AbortError ile biter.
    signal?: AbortSignal;
};

const abortError = () => new DOMException('Upload stopped', 'AbortError');

export const isAbortError = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
        reject(abortError());
        return;
    }
    const onAbort = () => {
        clearTimeout(timer);
        reject(abortError());
    };
    const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
});

// Ne: Baglanti yoksa gelene kadar bekler (AM-04).
// Neden: Otobusteki misafirin dosyalari tunelde art arda "basarisiz" oluyordu; artik baglanti
//        donene kadar bekliyor ve deneme hakkini harcamiyor. 'online' olayi bazi mobil
//        tarayicilarda gec geliyor, o yuzden birkac saniyede bir navigator.onLine'a da bakilir.
const waitForOnline = (signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (navigator.onLine) {
        resolve();
        return;
    }
    if (signal?.aborted) {
        reject(abortError());
        return;
    }
    const finish = (err?: DOMException) => {
        clearInterval(poll);
        window.removeEventListener('online', onOnline);
        signal?.removeEventListener('abort', onAbort);
        if (err) reject(err); else resolve();
    };
    const onOnline = () => finish();
    const onAbort = () => finish(abortError());
    const poll = setInterval(() => {
        if (navigator.onLine) finish();
    }, 3000);
    window.addEventListener('online', onOnline);
    signal?.addEventListener('abort', onAbort, { once: true });
});

// Ne: PUT'tan once dosyanin ilk baytini okur.
// Neden: iOS Safari okuyamadigi dosyayi (21 Eylul, bir misafirin 100 videosu) fetch'e hata
//        vermeden bos govdeyle gonderiyor; S3 0 baytlik nesneyi 200 ile kabul ediyor ve misafir
//        "tamamlandi" goruyordu. Okunamayan dosyayi yuklemeye hic baslamadan ayiriyoruz.
const assertReadable = async (file: File) => {
    const unreadable = new GuestUploadError('unreadable', `Cannot read ${file.name}`);
    if (file.size === 0) throw unreadable;

    const head = file.slice(0, 1);
    if (typeof head.arrayBuffer !== 'function') return;
    try {
        if ((await head.arrayBuffer()).byteLength === 0) throw unreadable;
    } catch {
        throw unreadable;
    }
};

const confirmGuestUpload = async (confirmUrl: string, filePath: string, putOk: boolean, signal?: AbortSignal): Promise<ConfirmStatus> => {
    const res = await fetch(
        confirmUrl,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify([{ path: filePath, ok: putOk }]),
            signal,
        }
    );
    const body: Record<string, ConfirmStatus> = await res.json();
    return body[filePath];
};

// Ne: Tek dosyayi presign -> S3 PUT -> /confirm ile yukler; ag hatasinda yeni bir presign ile
//     iki kez daha dener.
// Neden: 25 Eylul'de otobusteki misafirlerin PUT'lari yarida kaldi ve yalnizca kirmizi bir X
//        gorduler. Sunucu satiri, dosyayi S3'te gorene kadar gizli tutuyor (received_at);
//        /confirm o karari hemen verdirir ve basarisiz denemenin satirini siler.
const uploadGuestFile = async (presignUrl: string, confirmUrl: string, file: File, opts: GuestUploadOptions = {}): Promise<GuestUploadResult> => {
    const { onPhase, signal } = opts;
    const attempts = RETRY_DELAYS_MS.length + 1;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt > 0) {
            onPhase?.({ phase: 'retrying', attempt: attempt + 1, of: attempts });
            await sleep(RETRY_DELAYS_MS[attempt - 1], signal);
        }
        if (!navigator.onLine) {
            onPhase?.({ phase: 'offline' });
            await waitForOnline(signal);
        }
        onPhase?.({ phase: 'uploading', progress: 0 });

        let presign: PresignResponse[string] | undefined;
        try {
            presign = (await presignFiles(presignUrl, [file], signal))[file.name];
        } catch (err) {
            if (isAbortError(err)) throw err;
            // Limit, album ve yetki hatalari (4xx) tekrar denense de degismez; modal onlari tanir.
            if (err instanceof FetchHttpError && err.status < 500) throw err;
            lastError = err;
            continue;
        }
        if (!presign) {
            lastError = new Error(`No presigned URL for ${file.name}`);
            continue;
        }

        let putOk = true;
        try {
            await putToS3(presign.upUrl, file, progress => onPhase?.({ phase: 'uploading', progress }), signal);
        } catch (err) {
            if (isAbortError(err)) {
                // Durduruldu: yarim denemenin gizli satiri bir saat kotaya sayilmasin, sunucu hemen silsin.
                confirmGuestUpload(confirmUrl, presign.filePath, false).catch(() => undefined);
                throw err;
            }
            putOk = false;
            lastError = err;
        }

        onPhase?.({ phase: 'processing' });
        let status: ConfirmStatus | null = null;
        try {
            status = await confirmGuestUpload(confirmUrl, presign.filePath, putOk, signal);
        } catch (err) {
            if (isAbortError(err)) throw err;
            lastError = err;
        }

        if (status === 'received') return { path: presign.filePath, duplicate: false };
        if (status === 'duplicate') return { path: presign.filePath, duplicate: true };
        if (status === 'empty') throw new GuestUploadError('unreadable', `Empty upload for ${file.name}`);
        // Tarayici PUT'u basarili gordu ama sunucuya ulasilamadi ya da dosyayi henuz goremedi:
        // tarama bir dakika icinde galeriye alir. Yeniden yuklemek ayni fotografi iki kez ekler.
        if (putOk && (status === null || status === 'pending')) return { path: presign.filePath, duplicate: false };
    }

    throw new GuestUploadError('not_received', `Upload failed for ${file.name}: ${String(lastError)}`);
};

/**
 * Upload files as a guest participant
 * @param eventUid - UID of the event
 * @param utype - Upload type: 'photo', 'video', or 'voice'
 * @param files - Array of File objects to upload
 * @param albumUid - Hedef album (photo/video). Verilmezse sunucu General'e yazar.
 * @returns Dosya basina S3 yolu ve albumde zaten olup olmadigi (duplicate)
 * @param opts - Asama bildirimi (onPhase) ve durdurma sinyali (signal)
 * @throws GuestUploadError dosya okunamadiysa ya da S3'e ulasmadiysa; limit/album/yetki
 *         hatalarinda sunucunun FetchHttpError'u oldugu gibi gelir; durdurulursa AbortError.
 */
export const guestUpload = async (
    eventUid: string,
    utype: string,
    files: File[],
    albumUid?: string | null,
    opts: GuestUploadOptions = {}
) => {
    const eventPackedUid = packUUID(eventUid);
    const albumParam = albumUid ? `?album=${packUUID(albumUid)}` : '';
    const presignUrl = `${SERV_ROOT}/api/guest/upload/${eventPackedUid}/${utype}${albumParam}`;
    // dedupe=1: bu arayuz "duplicate" cevabini taniyor (sunucu eski arayuze "received" der).
    const confirmUrl = `${SERV_ROOT}/api/guest/upload/${eventPackedUid}/confirm?dedupe=1`;

    const results: GuestUploadResult[] = [];
    for (const file of files) {
        // Baglanti yokken dosyayi okumaya calisma: WebKit yerel blob'u da ag sureci uzerinden
        // okuyor, kesintide okuma hatasi dosyayi yanlislikla "okunamadi" diye isaretliyordu.
        if (!navigator.onLine) {
            opts.onPhase?.({ phase: 'offline' });
            await waitForOnline(opts.signal);
        }
        await assertReadable(file);
        results.push(await uploadGuestFile(presignUrl, confirmUrl, file, opts));
    }
    return results;
}

const presignFiles = async (url: string, files: File[], signal?: AbortSignal): Promise<PresignResponse> => {
    // Ne: Presign istegi dosya adiyla birlikte boyutu da tasir.
    // Neden: Depolama limiti (paket basina GB, misafir basina GB) yalnizca boyut
    //        bilinirse uygulanabilir; dosyanin kendisi tarayicidan dogrudan S3'e gidiyor,
    //        sunucu baytlari hic gormuyor. Sunucu eski duz isim dizisini de kabul eder.
    const presignRes = await fetch(
        url,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(files.map(f => ({ name: f.name, size: f.size }))),
            signal,
        }
    );

    return presignRes.json();
};

// Ne: Dosyayi presign'li URL'e PUT eder; ilerlemeyi 0..1 olarak bildirir.
// Neden: fetch yukleme ilerlemesi vermiyor; buyuk bir video dakikalarca "yukleniyor"da
//        kipirdamadan duruyordu (AM-01). XHR'in upload.onprogress'i her tarayicida var.
const putToS3 = (upUrl: string, file: File, onProgress?: (progress: number) => void, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
        reject(abortError());
        return;
    }
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    const done = (err?: Error) => {
        signal?.removeEventListener('abort', onAbort);
        if (err) reject(err); else resolve();
    };
    // Yuzde her degistiginde bir kez: 100 dosyalik listede her olayda cizim telefonu yorar.
    let lastPercent = -1;
    xhr.upload.onprogress = (e) => {
        if (!onProgress || !e.lengthComputable || e.total === 0) return;
        const percent = Math.floor((e.loaded / e.total) * 100);
        if (percent === lastPercent) return;
        lastPercent = percent;
        onProgress(percent / 100);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
        ? done()
        : done(new Error(`Upload failed for ${file.name}: ${xhr.status}`));
    xhr.onerror = () => done(new Error(`Upload failed for ${file.name}: network error`));
    xhr.ontimeout = () => done(new Error(`Upload failed for ${file.name}: timeout`));
    xhr.onabort = () => done(abortError());
    xhr.open('PUT', upUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    signal?.addEventListener('abort', onAbort, { once: true });
    xhr.send(file);
});

/**
 * Upload files to S3 via presigned URLs (host yuklemeleri: etkinlik gorseli, QR logosu,
 * album kapagi). Bunlar uploads tablosuna yazilmaz, o yuzden /confirm adimi yok.
 * @param url - Presign endpoint URL
 * @param files - Array of File objects to upload
 * @returns Array of final S3 file paths
 */
export const uploadFiles = async (
    url: string,
    files: File[]
): Promise<string[]> => {
    const presignData = await presignFiles(url, files);

    await Promise.all(
        files.map(async (file) => {
            const presign = presignData[file.name];
            if (!presign) {
                throw new Error(`No presigned URL for ${file.name}`);
            }
            await putToS3(presign.upUrl, file);
        })
    );

    return files.map(f => presignData[f.name].filePath);
};

