import { META_PIXEL_ID } from '../consts';

type MetaEventParams = Record<string, string | number | boolean | null | undefined>;

type MetaFbq = {
  (command: 'init' | 'track', name: string, params?: MetaEventParams): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: MetaFbq;
};

declare global {
  interface Window {
    fbq?: MetaFbq;
    _fbq?: MetaFbq;
  }
}

const META_PIXEL_SCRIPT_ID = 'meta-pixel-script';
let metaPixelInitialized = false;

// Ne: Meta Pixel fbq fonksiyonunu guvenli sekilde okur.
// Nasil: Browser disi ortamda veya script henuz hazir degilse undefined dondurur.
// Neden: Tracking cagrilari fbq yokken uygulamayi kirmadan sessizce gecilebilsin.
function getMetaFbq() {
  if (typeof window === 'undefined') return undefined;
  return window.fbq;
}

// Ne: Meta Pixel script'ini sayfaya ekler ve Pixel ID ile init eder.
// Nasil: Meta'nin fbq queue stub'ini kurar, script zaten eklendiyse tekrar eklemez.
// Neden: SPA icinde Pixel'i tek kez baslatip tum event'leri ayni instance'a baglamak icin.
export function initMetaPixel() {
  if (metaPixelInitialized) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
        return;
      }
      fbq.queue?.push(args);
    } as MetaFbq;

    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
  }

  if (!document.getElementById(META_PIXEL_SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = META_PIXEL_SCRIPT_ID;
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript?.parentNode?.insertBefore(script, firstScript);
  }

  window.fbq('init', META_PIXEL_ID);
  metaPixelInitialized = true;
}

// Ne: Meta Pixel'e genel event gonderimini tek noktadan yapar.
// Nasil: Init'i garanti eder, fbq varsa track komutunu event adi ve parametrelerle cagirir.
// Neden: Event fonksiyonlari ortak guvenlik ve yukleme davranisini paylassin.
function trackMetaEvent(eventName: string, params?: MetaEventParams) {
  initMetaPixel();
  const fbq = getMetaFbq();
  if (!fbq) return;
  fbq('track', eventName, params);
}

// Ne: Meta Pixel PageView event'ini yollar.
// Nasil: Ortak track helper'i uzerinden parametresiz PageView cagirir.
// Neden: SPA route degisimlerinde sayfa goruntulemelerini Meta tarafinda gorunur yapmak icin.
export function trackMetaPageView() {
  trackMetaEvent('PageView');
}

// Ne: Meta Pixel AddToCart event'ini yollar.
// Nasil: Istege bagli event parametrelerini ortak track helper'ina aktarir.
// Neden: Kullanici checkout'a cart ile geldiginde sepet aksiyonu olculsun.
export function trackMetaAddToCart(params?: MetaEventParams) {
  trackMetaEvent('AddToCart', params);
}

// Ne: Meta Pixel CompleteRegistration event'ini yollar.
// Nasil: Kayit basarili olduktan sonra ortak track helper'i ile event gonderir.
// Neden: Buton tiklamasi yerine gercek tamamlanan kayit donusumu olculsun.
export function trackMetaCompleteRegistration(params?: MetaEventParams) {
  trackMetaEvent('CompleteRegistration', params);
}

// Ne: Meta Pixel Purchase event'ini gercek odeme tutariyla yollar.
// Nasil: value ve currency parametrelerini Meta'nin bekledigi Purchase payload'ina cevirir.
// Neden: Odeme basarili oldugunda UAH bazli revenue Meta raporlarina dogru yansisin.
export function trackMetaPurchase(params: { value: number; currency: string }) {
  trackMetaEvent('Purchase', {
    value: params.value,
    currency: params.currency,
  });
}

// Ne: Ayni browser oturumunda bir tracking anahtarinin kullanilip kullanilmadigini kontrol eder.
// Nasil: sessionStorage'da key varsa false dondurur, yoksa key'i isaretleyip true dondurur.
// Neden: Refresh, geri/ileri navigasyon veya polling tekrarlarinda duplicate event riskini azaltmak icin.
export function markMetaEventOnce(key: string) {
  if (typeof sessionStorage === 'undefined') return true;
  if (sessionStorage.getItem(key)) return false;
  sessionStorage.setItem(key, '1');
  return true;
}
