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
type ConfirmStatus = 'received' | 'pending' | 'missing' | 'empty';

// Ilk deneme + iki tekrar; kisa kopmalari (tunel, baz istasyonu degisimi) atlatmaya yeter.
const RETRY_DELAYS_MS = [2000, 5000];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

const confirmGuestUpload = async (confirmUrl: string, filePath: string, putOk: boolean): Promise<ConfirmStatus> => {
    const res = await fetch(
        confirmUrl,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify([{ path: filePath, ok: putOk }]),
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
const uploadGuestFile = async (presignUrl: string, confirmUrl: string, file: File): Promise<string> => {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);

        let presign: PresignResponse[string] | undefined;
        try {
            presign = (await presignFiles(presignUrl, [file]))[file.name];
        } catch (err) {
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
            await putToS3(presign.upUrl, file);
        } catch (err) {
            putOk = false;
            lastError = err;
        }

        let status: ConfirmStatus | null = null;
        try {
            status = await confirmGuestUpload(confirmUrl, presign.filePath, putOk);
        } catch (err) {
            lastError = err;
        }

        if (status === 'received') return presign.filePath;
        if (status === 'empty') throw new GuestUploadError('unreadable', `Empty upload for ${file.name}`);
        // Tarayici PUT'u basarili gordu ama sunucuya ulasilamadi ya da dosyayi henuz goremedi:
        // tarama bir dakika icinde galeriye alir. Yeniden yuklemek ayni fotografi iki kez ekler.
        if (putOk && (status === null || status === 'pending')) return presign.filePath;
    }

    throw new GuestUploadError('not_received', `Upload failed for ${file.name}: ${String(lastError)}`);
};

/**
 * Upload files as a guest participant
 * @param eventUid - UID of the event
 * @param utype - Upload type: 'photo', 'video', or 'voice'
 * @param files - Array of File objects to upload
 * @param albumUid - Hedef album (photo/video). Verilmezse sunucu General'e yazar.
 * @returns Array of final S3 file paths
 * @throws GuestUploadError dosya okunamadiysa ya da S3'e ulasmadiysa; limit/album/yetki
 *         hatalarinda sunucunun FetchHttpError'u oldugu gibi gelir.
 */
export const guestUpload = async (
    eventUid: string,
    utype: string,
    files: File[],
    albumUid?: string | null
) => {
    const eventPackedUid = packUUID(eventUid);
    const albumParam = albumUid ? `?album=${packUUID(albumUid)}` : '';
    const presignUrl = `${SERV_ROOT}/api/guest/upload/${eventPackedUid}/${utype}${albumParam}`;
    const confirmUrl = `${SERV_ROOT}/api/guest/upload/${eventPackedUid}/confirm`;

    const paths: string[] = [];
    for (const file of files) {
        await assertReadable(file);
        paths.push(await uploadGuestFile(presignUrl, confirmUrl, file));
    }
    return paths;
}

const presignFiles = async (url: string, files: File[]): Promise<PresignResponse> => {
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
        }
    );

    return presignRes.json();
};

const putToS3 = async (upUrl: string, file: File) => {
    const uploadRes = await window.fetch(upUrl, {
        method: "PUT",
        body: file,
        headers: {
            "Content-Type": file.type || "application/octet-stream",
        },
    });

    if (!uploadRes.ok) {
        throw new Error(`Upload failed for ${file.name}: ${uploadRes.status}`);
    }
};

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

