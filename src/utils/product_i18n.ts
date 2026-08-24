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
