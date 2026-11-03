import { fonts } from '../types/fonts';

// Ne: Karsilama metninin (events.welcome_message) misafir ana sayfasinda kac satir tuttugu.
// Neden: Misafir ana sayfasi metnin ilk 3 satirini gosterir, fazlasi "Більше" ile acilir
//        (V2GuestHome GuestWelcomeText). Ayarlardaki sayac hostun bunu onceden gormesi icin.
//        16 Ekim'de metin 3 satirla sinirlanmisti; musteri 2 Kasim'da siniri kaldirtti.
// Nasil: Metin, misafir sayfasindaki ayni yazi tipi, boyut ve genislikte gizli bir kutuda
//        olculur. Genislik en dar yaygin telefona (360 px) gore: sayfa 14 px, metin 17 px
//        iceriden basliyor (GuestHome.css .guest-home-main / .guest-home-welcome-wrap).
export const WELCOME_MAX_LINES = 3;
// Metin sinirsiz buyumesin diye sert ust sinir (textarea maxLength).
export const WELCOME_MAX_CHARS = 1000;

const MEASURE_WIDTH = 360 - 2 * 14 - 2 * 17;
const LINE_HEIGHT = 22;

let measurer: HTMLDivElement | null = null;

function getMeasurer(): HTMLDivElement {
  if (measurer && document.body.contains(measurer)) return measurer;
  measurer = document.createElement('div');
  measurer.setAttribute('aria-hidden', 'true');
  Object.assign(measurer.style, {
    position: 'absolute',
    left: '-10000px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    width: `${MEASURE_WIDTH}px`,
    fontSize: '14px',
    lineHeight: `${LINE_HEIGHT}px`,
    letterSpacing: '-0.015em',
    whiteSpace: 'pre-line',
    overflowWrap: 'anywhere',
    textAlign: 'left',
  });
  document.body.appendChild(measurer);
  return measurer;
}

const fontFor = (fontId?: string) => fonts.find((f) => f.id === fontId) || fonts[0];

// Misafir yazi tipi bu sayfada yuklu degilse olcum yedek yazi tipiyle yapilir; once yukle.
export function loadWelcomeFont(fontId?: string): Promise<void> {
  const font = fontFor(fontId);
  const linkId = `welcomeMeasureFont-${font.id}`;
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = font.url;
    document.head.appendChild(link);
  }
  const family = font.fontFamily.split(',')[0].trim();
  return Promise.all([400, 700].map((w) => document.fonts?.load(`${w} 14px ${family}`)))
    .then(() => undefined)
    .catch(() => undefined);
}

export function countWelcomeLines(text: string, fontId?: string): number {
  if (!text.trim()) return 0;
  const el = getMeasurer();
  el.style.fontFamily = fontFor(fontId).fontFamily;
  el.textContent = text;
  return Math.max(1, Math.round(el.scrollHeight / LINE_HEIGHT));
}
