import { useEffect, useRef, useState } from 'react';
import '../v2-styles/AdvertorialImage.css';

// Misafir ana sayfasindaki reklam hucresinin gorseli. Host ayarlarindaki onizleme de bunu
// kullanir, boylece host misafirin gordugu kutuyu gorur (Solomiia 19 Ekim aksami: 16:9
// onizlemede 1600x800 reklam ust/altta bosluk birakip eksik gibi gorunuyordu).

// Ne: Gorselin bosluk kalan iki kenarinin (yan yana ya da ust/alt) ortalama rengi; hucrenin
//     bu kenarlardaki bos seridi bu duz renklerle boyanir.
// Nasil: Gorsel hucreden darsa en sol ve en sag piksel sutunu, genisse en ust ve en alt satir
//        kucuk bir canvas'ta ortalanir. S3 CORS'u herkese acik; canvas yine de okunamazsa
//        (baska kaynak) null doner ve hucrenin sade zemini kalir.
const advertorialEdgeFill = (img: HTMLImageElement | null, cell: HTMLElement | null): string | null => {
  if (!img || !cell || !img.naturalWidth || !img.naturalHeight || !cell.clientWidth || !cell.clientHeight) return null;
  const sideBands = img.naturalWidth / img.naturalHeight < cell.clientWidth / cell.clientHeight;
  const size = 64;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    // Seffaf kenarli (PNG logo) gorselde renk alfa ile agirliklanir; kenar cogunlukla
    // seffafsa null doner ve hucrenin kendi zemini kalir (siyah serit olusmasin).
    const average = (x: number, y: number, w: number, h: number) => {
      const data = ctx.getImageData(x, y, w, h).data;
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        r += data[i] * alpha; g += data[i + 1] * alpha; b += data[i + 2] * alpha; a += alpha;
      }
      if (a < (data.length / 4) * 255 * 0.5) return null;
      return `rgb(${Math.round(r / a)}, ${Math.round(g / a)}, ${Math.round(b / a)})`;
    };
    const first = sideBands ? average(0, 0, 1, size) : average(0, 0, size, 1);
    const last = sideBands ? average(size - 1, 0, 1, size) : average(0, size - 1, size, 1);
    if (!first || !last) return null;
    return `linear-gradient(${sideBands ? 'to right' : 'to bottom'}, ${first} 50%, ${last} 50%)`;
  } catch {
    return null;
  }
};

// Ne: Reklam gorseli hucrede butun gorunur (kirpilmaz); 2:1 olmayan gorselde kalan bosluk,
//     gorselin o kenarindaki rengin duz tonuyla dolar.
// Neden: 16 Ekim'de bosluk gorselin kenar seridi uzatilarak dolduruluyordu; kenarinda acik
//        cerceve olan reklamlarda (Monako, Prestige) bu bulanik leke gibi gorundu (Solomiia,
//        19 Ekim). Kirpma da denendi: canli 16:9 reklamlarin bazilarinda yazi kenara %5 yakin
//        (Monako'nun soru isareti), hucreyi doldurmak icin gereken ~%7 kirpma onu kesiyordu.
// Ne: Renk okunabilsin diye gorsel CORS ile, ayri bir onbellek anahtariyla (?am=c) yuklenir.
// Neden: S3, Origin basligi olmayan istege CORS basligi ve Vary donmuyor. Ayni URL daha once
//        CORS'suz yuklendiyse (eski surum) tarayici o yaniti CORS istegine verir ve gorsel hic
//        gorunmez. Bu anahtari yalnizca bu bilesen, her zaman CORS ile ister.
const advertorialCorsSrc = (src: string) => `${src}${src.includes('?') ? '&' : '?'}am=c`;

function AdvertorialImage({ src, alt = '' }: { src: string; alt?: string }) {
  const [fill, setFill] = useState<string | null>(null);
  const [corsFailed, setCorsFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const boxRef = useRef<HTMLSpanElement>(null);

  const measure = () => setFill(advertorialEdgeFill(imgRef.current, boxRef.current));

  // Gorsel degisince (host yeni reklam yukledi) eski rengi ve CORS yedegini birakma.
  useEffect(() => {
    setFill(null);
    setCorsFailed(false);
  }, [src]);

  // Onbellekten gelen gorselde onLoad, React baglanmadan once tetiklenmis olabilir.
  useEffect(() => {
    if (imgRef.current?.complete) setFill(advertorialEdgeFill(imgRef.current, boxRef.current));
  }, [src, corsFailed]);

  // CORS yuklemesi basarisizsa reklam kaybolmasin: gorsel eski yolla, renksiz zeminde yuklenir.
  return (
    <span ref={boxRef} className="advertorial-image" style={fill ? { background: fill } : undefined}>
      {corsFailed ? (
        <img src={src} alt={alt} loading="lazy" />
      ) : (
        <img
          ref={imgRef}
          src={advertorialCorsSrc(src)}
          alt={alt}
          loading="lazy"
          crossOrigin="anonymous"
          onLoad={measure}
          onError={() => setCorsFailed(true)}
        />
      )}
    </span>
  );
}

export default AdvertorialImage;
