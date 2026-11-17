// Canli demo etkinligi: partnership@ hesabindaki "DEMO" (75f28cdf-c6e9-4aff-8abc-fd6b0e332fcc), Fatih 14 Kasim.
// Musteri 17 Kasim: header'da "Live demo", ana sayfada QR + buton (WordPress), Services & Prices'ta bant.
// Fatih'in verdigi /l/qdfKM38bpSv-KvP1rDjMvzA linki backend'de buraya yonlenir (linkHandler.go, 'q' oneki);
// dogrudan buraya baglaniyoruz ki ?lang= ziyaretcinin bulundugu dili tasisin (i18n.ts onu lang_setting'e yazar,
// yonlendirme sorguyu duser). Demo etkinligi degisirse hfSetup.js ve WordPress bilesenleri de guncellenmeli.
export const DEMO_GUEST_PATH = '/guest/dfKM38bpSv-KvP1rDjMvzA';

export const demoGuestUrl = (lang: string) => `${DEMO_GUEST_PATH}?lang=${lang === 'uk' ? 'uk' : 'en'}`;
