import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Button from '../components/Button';
import { textOr } from '../utils/admin_i18n';
import '../v2-styles/ImageCropModal.css';

// Ne: Secilen gorseli sabit oranli bir cerceveye gore kirpan pencere (AM-14 B secenegi).
// Nasil: Gorsel cerceveyi her zaman kaplar; surukleyerek konumlanir, kaydirici / iki parmak /
//        tekerlekle buyutulur. "Kirp" cerceveyi canvas'a cizip yeni bir File dondurur,
//        "Kirpmadan" orijinal dosyayi aynen dondurur — kirpma istege bagli.
// Neden: Etkinlik gorseli ve album kapagi object-fit: cover ile gosteriliyor; organizator hangi
//        kismin gorunecegini yuklemeden once goremiyordu.

interface ImageCropModalProps {
  // null = pencere kapali.
  file: File | null;
  // Cerceve orani (genislik / yukseklik).
  aspect: number;
  // Kirpilan dosyanin en fazla genisligi; kaynak daha kucukse buyutulmez.
  maxOutputWidth: number;
  onCancel: () => void;
  onDone: (file: File) => void;
}

const MAX_ZOOM = 4;

type Point = { x: number; y: number };

const clampNum = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const croppedName = (name: string, ext: string) => {
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name}-crop.${ext}`;
};

function ImageCropModal({ file, aspect, maxOutputWidth, onCancel, onDone }: ImageCropModalProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [frameW, setFrameW] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setNatural({ w: 0, h: 0 });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError('');
    setBusy(false);
    // Pencere kapaninca adresi de birak: yeniden acilista ilk kare iptal edilmis eski blob'u
    // cizip onError'a dusmesin (ikinci secimde "acilamadi" hatasi).
    return () => {
      URL.revokeObjectURL(url);
      setImgUrl(null);
    };
  }, [file]);

  // Cerceve genisligi CSS'ten gelir (aspect-ratio); pencere boyutu degisince yeniden olculur.
  useLayoutEffect(() => {
    if (!file) return;
    const measure = () => setFrameW(frameRef.current?.clientWidth || 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [file]);

  const frameH = frameW / aspect;
  const ready = natural.w > 0 && frameW > 0;
  const baseScale = ready ? Math.max(frameW / natural.w, frameH / natural.h) : 1;
  const scale = baseScale * zoom;
  const dispW = natural.w * scale;
  const dispH = natural.h * scale;

  // Gorsel cerceveden tasmasin: merkez kaymasi, gorselin tasan payinin yarisiyla sinirli.
  const clampOffset = useCallback((p: Point, z: number): Point => {
    if (!ready) return { x: 0, y: 0 };
    const s = baseScale * z;
    const maxX = Math.max(0, (natural.w * s - frameW) / 2);
    const maxY = Math.max(0, (natural.h * s - frameH) / 2);
    return { x: clampNum(p.x, -maxX, maxX), y: clampNum(p.y, -maxY, maxY) };
  }, [baseScale, frameH, frameW, natural.h, natural.w, ready]);

  const view = clampOffset(offset, zoom);

  const applyZoom = useCallback((next: number) => {
    const z = clampNum(next, 1, MAX_ZOOM);
    setZoom(z);
    setOffset(prev => clampOffset(prev, z));
  }, [clampOffset]);

  // React'in wheel dinleyicisi pasif; preventDefault icin elle ve pasif olmayan bagla.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !file) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(prevZoom => {
        const z = clampNum(prevZoom * Math.exp(-e.deltaY * 0.0015), 1, MAX_ZOOM);
        setOffset(prev => clampOffset(prev, z));
        return z;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampOffset, file]);

  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, file, onCancel]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ready) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const current = { x: e.clientX, y: e.clientY };

    if (pointers.size >= 2) {
      // Iki parmak: parmaklar arasi mesafenin oraniyla buyut.
      const other = Array.from(pointers.entries()).find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(prev.x - other.x, prev.y - other.y);
        const after = Math.hypot(current.x - other.x, current.y - other.y);
        if (before > 0) applyZoom(zoom * (after / before));
      }
    } else {
      setOffset(p => clampOffset({ x: p.x + current.x - prev.x, y: p.y + current.y - prev.y }, zoom));
    }
    pointers.set(e.pointerId, current);
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
  };

  const handleCrop = async () => {
    const img = imgRef.current;
    if (!file || !img || !ready) return;
    setBusy(true);
    try {
      // Cercevenin sol ust kosesi, gorselin dogal piksel koordinatlarinda.
      const sx = (dispW / 2 - frameW / 2 - view.x) / scale;
      const sy = (dispH / 2 - frameH / 2 - view.y) / scale;
      const sw = frameW / scale;
      const sh = frameH / scale;
      const outW = Math.max(1, Math.round(Math.min(maxOutputWidth, sw)));
      const outH = Math.max(1, Math.round(outW / aspect));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas 2d context unavailable');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      // PNG saydamligi korunur; digerleri JPEG (WEBP'yi her tarayici canvas'tan uretemiyor).
      const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, 0.9));
      if (!blob) throw new Error('canvas.toBlob returned null');
      onDone(new File([blob], croppedName(file.name, type === 'image/png' ? 'png' : 'jpg'), { type }));
    } catch (err) {
      console.error('[crop] failed', err);
      setError(textOr('crop.failed', 'Could not open this image. Try another file.', 'Не вдалося відкрити зображення. Спробуйте інший файл.'));
      setBusy(false);
    }
  };

  if (!file) return null;

  return (
    <div className="crop-modal-backdrop" onClick={() => { if (!busy) onCancel(); }}>
      <div className="crop-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h3 className="crop-modal-title">{textOr('crop.title', 'Crop image', 'Обрізати зображення')}</h3>
        <p className="crop-modal-hint">{textOr('crop.hint', 'Drag the image to position it. Use the slider or pinch to zoom. Guests will see exactly what is inside the frame.', 'Перетягніть зображення, щоб розмістити його. Масштаб — повзунком або двома пальцями. Гості побачать саме те, що в рамці.')}</p>

        <div
          ref={frameRef}
          className="crop-modal-frame"
          style={{ aspectRatio: String(aspect) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          {imgUrl && !error && (
            <img
              ref={imgRef}
              src={imgUrl}
              alt=""
              draggable={false}
              onLoad={e => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={e => e.currentTarget.src === imgUrl && setError(textOr('crop.failed', 'Could not open this image. Try another file.', 'Не вдалося відкрити зображення. Спробуйте інший файл.'))}
              style={ready ? {
                width: dispW,
                height: dispH,
                transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))`,
              } : { visibility: 'hidden' }}
            />
          )}
          <div className="crop-modal-grid" aria-hidden="true" />
        </div>

        <label className="crop-modal-zoom">
          <i className="fa-solid fa-magnifying-glass-minus" />
          <span className="crop-modal-sr">{textOr('crop.zoom', 'Zoom', 'Масштаб')}</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!ready || busy}
            onChange={e => applyZoom(Number(e.target.value))}
          />
          <i className="fa-solid fa-magnifying-glass-plus" />
        </label>

        {error && <p className="crop-modal-error" role="alert">{error}</p>}

        <div className="crop-modal-actions">
          <Button type="button" variant="secondary" text={textOr('crop.cancel', 'Cancel', 'Скасувати')} onClick={onCancel} disabled={busy} />
          <Button type="button" variant="secondary" text={textOr('crop.useOriginal', 'Use without cropping', 'Без обрізання')} onClick={() => onDone(file)} disabled={busy} />
          <Button type="button" icon="fa-solid fa-crop-simple" text={textOr('crop.apply', 'Crop and use', 'Обрізати й використати')} onClick={handleCrop} loading={busy} disabled={!ready || !!error} />
        </div>
      </div>
    </div>
  );
}

export default ImageCropModal;
