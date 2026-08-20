import { t } from '../packages/i18n';

// Ne: i18n key'ini cozer, bulunamazsa verilen EN/UK metnine duser.
// Nasil: t(key) key'in kendisini dondururse (i18next bulamayinca boyle yapar) aktif
//        lang_code'a gore fallback secilir.
// Neden: Ceviri JSON'lari uzaktan yukleniyor. Cache gecikirse ya da bir anahtar heniz
//        deploy edilmemisse kullaniciya ham anahtar adi ("auth.showPassword") gorunuyordu.
export function textOr(key: string, en: string, uk: string, values?: Record<string, string | number>) {
  const value = t(key, values);
  if (value !== key) return String(value);
  return t('lang_code') === 'uk' ? uk : en;
}

// Admin ekranlarinin kullandigi mevcut ad; davranis textOr ile birebir ayni.
export const adminText = textOr;
