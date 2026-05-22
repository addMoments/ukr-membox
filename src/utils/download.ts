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

const saveUrl = async ( url: string, filename: string ) => {
    const proxyUrl = `${SERV_ROOT}/api/download?url=${encodeURIComponent(url)}`;
    const res = await window.fetch(proxyUrl);
    const { url: presignedUrl } = await res.json();

    const s3res = await window.fetch(presignedUrl);
    const blob = await s3res.blob();
    saveBlob(blob, filename);
}

export { saveArrayBuffer, saveBlob, saveUrl };
