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

export const sendToMsg = (msg: MessageScreen) => {
  const b64Msg = btoa(JSON.stringify(msg));
  window.location.href = `/notice/${b64Msg}`;
}