export const is_live = !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1")
// Ne: Yerel gelistirmede uclar REACT_APP_* ile ezilebilir (CRA build aninda inline eder).
// Neden: Yerel frontend canli PostgREST/S3'e gitmesin; prod build'de degiskenler yok, degerler ayni.
export const DB_ROOT = process.env.REACT_APP_DB_ROOT || "https://db.addmoments.com.ua"
export const SERV_ROOT = process.env.REACT_APP_SERV_ROOT || (is_live ? "https://serv.addmoments.com.ua" : "http://127.0.0.1:8083")
export const SITE_ROOT = process.env.REACT_APP_SITE_ROOT || (is_live ? "https://addmoments.com.ua" : "http://127.0.0.1:3000")
export const S3_ROOT = process.env.REACT_APP_S3_ROOT || "https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com"
export const META_PIXEL_ID = "905306969235905"
