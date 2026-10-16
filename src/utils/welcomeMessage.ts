import { fonts } from '../types/fonts';

// Ne: Karsilama metninin (events.welcome_message) misafir ana sayfasindaki satir siniri.
// Neden: Musteri 16 Ekim'de hostun en fazla 3 tam satir kullanabilmesini istedi; ana sayfada
//        baslik, metin, butonlar, 4 reklam ve albumlerin basi tek ekrana sigmali.
// Nasil: Metin, misafir sayfasindaki ayni yazi tipi, boyut ve genislikte gizli bir kutuda
//        olculur. Genislik en dar yaygin telefona (360 px) gore: sayfa 14 px, metin 17 px
//        iceriden basliyor (GuestHome.css .guest-home-main / .guest-home-welcome-wrap). Boylece
//        sinira uyan metin 360 px ve uzeri her telefonda 3 satiri gecmez.
export const WELCOME_MAX_LINES = 3;
// Olcum her nasilsa calismazsa da metin sinirsiz buyumesin diye sert ust sinir.
export const WELCOME_MAX_CHARS = 160;

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

export function welcomeFits(text: string, fontId?: string): boolean {
  return text.length <= WELCOME_MAX_CHARS && countWelcomeLines(text, fontId) <= WELCOME_MAX_LINES;
}

// Sona yapistirilan uzun metni sinira sigan en uzun basa keser.
export function fitWelcomeMessage(text: string, fontId?: string): string {
  const capped = text.slice(0, WELCOME_MAX_CHARS);
  if (welcomeFits(capped, fontId)) return capped;
  let lo = 0;
  let hi = capped.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (welcomeFits(capped.slice(0, mid), fontId)) lo = mid;
    else hi = mid - 1;
  }
  return capped.slice(0, lo);
}
