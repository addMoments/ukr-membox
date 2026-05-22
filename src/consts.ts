export const is_live = !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1")
export const DB_ROOT = "https://db.addmoments.com.ua"
export const SERV_ROOT = is_live ? "https://serv.addmoments.com.ua" : "http://127.0.0.1:8083"
export const SITE_ROOT = is_live ? "https://addmoments.com.ua" : "http://127.0.0.1:3000"
export const S3_ROOT = "https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com"
