import { t } from '../packages/i18n';

// i18next burada compatibilityJSON: 'v3' ile kurulu, yani cogul eklerini kendisi
// dogru secemiyor. Ukraynaca uc formlu oldugu icin secim burada yapiliyor ve
// ceviri anahtarlari duz tutuluyor. Sayi {{n}} ile gecirilir; {{count}} i18next'in
// kendi cogul mekanizmasini tetikleyecegi icin bilerek kullanilmiyor.
type PluralForm = 'One' | 'Few' | 'Many';

const pluralForm = (n: number, langCode: string): PluralForm => {
  if (langCode !== 'uk') return n === 1 ? 'One' : 'Many';

  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'One';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'Few';
  return 'Many';
};

// Gun sayisini en dogal birimle yazar: 21 -> "3 weeks", 31 -> "1 month", 90 -> "3 months".
// Ay yaklasik 30 gun sayilir; pakete gore 28-31 arasi degerler tek ay olarak okunur.
export const formatDuration = (days: number): string => {
  const langCode = t('lang_code');
  const months = Math.round(days / 30);

  let unit: 'Days' | 'Weeks' | 'Months' = 'Days';
  let count = days;

  if (days >= 28 && Math.abs(days - months * 30) <= 2) {
    unit = 'Months';
    count = months;
  } else if (days >= 7 && days % 7 === 0) {
    unit = 'Weeks';
    count = days / 7;
  }

  return t(`duration.${unit.toLowerCase()}${pluralForm(count, langCode)}`, { n: count });
};

// Iki ISO tarih arasindaki tam gun farki. Backend naive timestamp donebildigi icin
// karsilastirmadan once UTC'ye sabitlenir.
export const daysBetween = (fromIso?: string | null, toIso?: string | null): number | null => {
  if (!fromIso || !toIso) return null;

  const asUtc = (iso: string) => new Date(iso + (iso.includes('Z') || iso.includes('+') ? '' : 'Z')).getTime();
  const from = asUtc(fromIso);
  const to = asUtc(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;

  const days = Math.round((to - from) / 86400000);
  return days > 0 ? days : null;
};
