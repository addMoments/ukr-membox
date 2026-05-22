import { t } from '../packages/i18n';

// Ne: Admin ekranlari icin i18n key veya manuel EN/UK fallback metni dondurur.
// Nasil: t(key) key'in kendisini dondururse aktif lang_code'a gore fallback secer.
// Neden: Uzak JSON cache gecikse bile admin metinleri Ingilizce/Ukraynaca gorunsun.
export function adminText(key: string, en: string, uk: string, values?: Record<string, string | number>) {
  const value = t(key, values);
  if (value !== key) return String(value);
  return t('lang_code') === 'uk' ? uk : en;
}
