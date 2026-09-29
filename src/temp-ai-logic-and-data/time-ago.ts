import { t } from '../packages/i18n';
import { textOr } from '../utils/admin_i18n';

// Ne: "5 хв тому" / "5 min. ago" gibi goreli zaman; bir haftadan eskiyse kisa tarih.
// Nasil: Intl.RelativeTimeFormat aktif dille (lang_code) calisir; "Щойно / Just now" i18n'den.
// Neden: AM-09 — metin sabit Ingilizceydi ("Just now", "5 mins ago") ve Ukraynaca arayuzde
//        anonim misafirin kartinda, indirme ikonunun hemen yaninda gorunuyordu.
export function getTimeAgo(dateString: string): string {
  if (!dateString) return '';

  // Timestamps from the DB are stored without timezone info but are UTC.
  // Appending 'Z' tells JS to parse them as UTC instead of local time.
  const normalized = dateString.endsWith('Z') || dateString.includes('+') ? dateString : dateString + 'Z';
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const lang = t('lang_code') === 'uk' ? 'uk' : 'en';

  if (seconds < 60) return textOr('common.justNow', 'Just now', 'Щойно');

  if (seconds < 604800 && typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function') {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'always', style: 'short' });
    if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), 'minute');
    if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), 'hour');
    return rtf.format(-Math.floor(seconds / 86400), 'day');
  }

  return date.toLocaleDateString(lang, {
    month: 'short',
    day: 'numeric'
  });
}
