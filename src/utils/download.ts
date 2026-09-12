import { SERV_ROOT } from '../consts';

function saveArrayBuffer( buffer: ArrayBuffer, filename: string, contentType: string ) {
    saveBlob( new Blob( [ buffer ], { type: contentType } ), filename );
};

function saveBlob( blob: Blob, filename: string ) {
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(anchor.href), 10000);
};

// Ne: Sunucudan kisa omurlu imzali URL alinir ve tarayici dogrudan ona gonderilir; sunucu
//     imzaya Content-Disposition: attachment (dosya adi) ekledigi icin sayfa degismez, dosya iner.
// Neden: Eski yol dosyanin tamamini fetch + blob ile bellege alip sonra "kaydet"i tetikliyordu:
//        75 MB'lik bir export boyunca ne ilerleme cubugu ne dosya gorunuyordu (yalnizca donen
//        buton), 600 MB'lik export'lar da bellekte sisiyordu. Dogrudan link tarayicinin kendi
//        indirme yoneticisini kullanir: ilerleme gorunur, bellek kullanilmaz.
//        Capraz kaynakta <a download> yok sayildigi icin ad sunucudaki basliktan gelir.
const saveUrl = async ( url: string, filename: string ) => {
    const proxyUrl = `${SERV_ROOT}/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const res = await window.fetch(proxyUrl);
    if (!res.ok) {
        throw new Error(`download proxy failed: ${res.status}`);
    }
    const { url: presignedUrl } = await res.json();

    const anchor = document.createElement('a');
    anchor.href = presignedUrl;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}

export { saveArrayBuffer, saveBlob, saveUrl };
