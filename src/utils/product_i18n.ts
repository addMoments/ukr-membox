import { t } from '../packages/i18n';

// Ne: Urun kaydindan gelen bir etiketin aktif dildeki karsiligini secer.
// Nasil: Aktif dil uk ise label_uk alanini, degilse label alanini dondurur; label_uk
//        eksik ya da bossa yine label'a duser.
// Neden: config_fields ve designs etiketleri products.options icinde veri olarak duruyor ve
//        yalnizca Ingilizce yazilmis (2.13). Bunlar admin panelden duzenlenebildigi icin
//        anahtar bazli i18n ile cozulemez; ceviri de veriyle birlikte gelmeli. Alan yoksa
//        davranis degismiyor, yani veri girilmeden once hicbir urun etkilenmiyor.
export function localizedLabel(item?: { label?: string; label_uk?: string } | null): string {
  if (!item) return '';
  const uk = item.label_uk?.trim();
  if (uk && t('lang_code') === 'uk') return uk;
  return item.label || '';
}

// Ne: Checkout form etiketlerindeki soru isareti ve "What is your" on ekini temizler.
// Nasil: Sondaki ? isaretini atar, Ingilizce "what is your" prefix'ini siler; kalan metin
//        tamamen kucuk harfse kelime baslarini buyutur (Event Date).
// Neden: Welcome Board etiketleri QR Card ile ayni gorunsun; QR Card zaten temiz oldugu
//        icin bu temizlik onu degistirmez.
export function displayConfigFieldLabel(field?: { key?: string; label?: string; label_uk?: string } | null): string {
  let label = localizedLabel(field);
  label = label.replace(/[?؟]+\s*$/g, '').trim();
  if (/^what is your\s+/i.test(label)) {
    label = label.replace(/^what is your\s+/i, '').trim();
    if (label && label === label.toLowerCase()) {
      label = label.replace(/\b\w/g, (ch) => ch.toUpperCase());
    }
  }
  return label;
}

const QR_CARD_FIELD_ORDER = ['name_text', 'welcome_message', 'secondary_text', 'event_date'];

// Ne: Fiziksel add-on form alanlarini QR Card sirasina ceker.
// Nasil: Event Title, Welcome Message, Event Date; listede olmayan alanlar sonda kalir.
// Neden: Welcome Board kaydinda tarih welcome message'dan once geliyor; checkout QR Card
//        ile ayni content akisini gostermeli.
type ConfigFieldLike = { key: string; label?: string; label_uk?: string; type?: string; maxLength?: number };

export function sortConfigFieldsLikeQrCard<T extends ConfigFieldLike = ConfigFieldLike>(fields: T[]): T[] {
  return [...fields].sort((a, b) => {
    const ai = QR_CARD_FIELD_ORDER.indexOf(a.key);
    const bi = QR_CARD_FIELD_ORDER.indexOf(b.key);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
