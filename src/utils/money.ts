// Ne: Tutari hryvnia olarak yazar; kurus yoksa ondalik basmaz (790 -> "₴790", 118.5 -> "₴118.50").
// Neden: Ukraynada fiyatlar ".00" ile yazilmiyor, musteri paket kartlarindaki "₴790.00"in
//        "₴790" olmasini istedi (2026-09-25). Promo indirimi kurus uretebildigi icin o durumda
//        iki hane kalir.
// Not: API price'i string donduruyor ("790.00"); .toFixed()'i dogrudan cagirmak sayfayi
//      bembeyaz birakir, bu yuzden deger once Number()'dan gecer.
export const formatUah = (value: number | string | null | undefined): string => {
  const amount = Number(value || 0);
  const cents = Math.round((Number.isFinite(amount) ? amount : 0) * 100);
  return `₴${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)}`;
};
