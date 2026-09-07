export type MessageScreenButton = {
  text: string;
  href: string;
};

export interface MessageScreen {
  title?: string | null;
  message?: string | null;
  subtext?: string | null;
  buttons?: MessageScreenButton[] | null;
  image?: string | null;
  warning?: string | null;
  // Ne: Ekranda kopyalanabilir metin ve QR kod olarak gosterilecek kisisel link.
  // Nasil: NoticeScreen bu degerden QR'i tarayicida uretir, payload'a data-URI konmaz.
  // Neden: Aktivasyon maili gelmeyen musteri linke ekrandan da ulasabilsin.
  link?: string | null;
};

// Ne: MessageScreen'i /notice/<base64> yolunda tasinabilir hale getirir.
// Nasil: JSON once UTF-8 baytlarina cevrilir, base64 ondan sonra alinir.
// Neden: btoa'ya dogrudan verilen metin 255 ustu bir kod noktasi icerdiginde
//        (Kiril, emoji) InvalidCharacterError firlatiyor. Hata cagiran click
//        handler'in icinde patladigi icin Ukraynaca arayuzde silme butonlari
//        hicbir sey yapmiyor gorunuyordu; Ingilizcede metin ASCII oldugu icin
//        ayni yol sorunsuz calisiyordu.
export const encodeMessageScreen = (msg: MessageScreen): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(msg));
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

// Ne: encodeMessageScreen'in tersi.
// Nasil: base64 -> bayt dizisi -> UTF-8 metin.
// Neden: Duz atob baytlari latin1 sayiyor, yani Kiril metin okunurken bozuluyor.
//        Sunucunun urettigi payload'lar da (Go base64.StdEncoding, UTF-8 JSON)
//        ayni yoldan gecer; ASCII iceriklerde sonuc eski davranisla birebir ayni.
export const decodeMessageScreen = (b64Msg: string): MessageScreen => {
  const binary = atob(b64Msg);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as MessageScreen;
};

export const sendToMsg = (msg: MessageScreen) => {
  const b64Msg = encodeMessageScreen(msg);
  window.location.href = `/notice/${b64Msg}`;
}