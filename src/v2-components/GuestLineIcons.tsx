// Ne: Misafir ana sayfasinin ince cizgili ikonlari (onayli Figma'daki gibi).
// Nasil: Lucide ikon yollari (ISC lisansi) satir ici SVG olarak; renk currentColor'dan gelir.
// Neden: Font Awesome'in ucretsiz setinde kamera/mikrofon/ok yalnizca dolu (solid) cizimde var;
//        tasarimdaki 1.5-2px cizgili ikonlar ancak SVG ile birebir tutuyor.
import { ReactNode } from 'react';

type IconProps = { size?: number; strokeWidth?: number; className?: string };

function LineIcon({ size = 18, strokeWidth = 1.75, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const ArrowRightIcon = (props: IconProps) => (
  <LineIcon {...props}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></LineIcon>
);

// Tasarimdaki kamera kareye yakin: ust ortada vizor cikintisi, ortada objektif.
export const CameraIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <path d="M6 6.5h1.6l1.6-2.5h5.6l1.6 2.5H18a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9.5a3 3 0 0 1 3-3Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </LineIcon>
);

export const MicIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </LineIcon>
);

export const MessageCircleIcon = (props: IconProps) => (
  <LineIcon {...props}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></LineIcon>
);

// Tasarimdaki takvim yatay: genisligi yuksekliginden fazla.
export const CalendarIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <rect width="19" height="16" x="2.5" y="5" rx="3" ry="3" />
    <path d="M7.5 3v4M16.5 3v4M2.5 10.5h19" />
  </LineIcon>
);

export const LockIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </LineIcon>
);

// Guvenlik satirindaki kilit tasarimda dolu govdeli.
export const LockFilledIcon = (props: IconProps) => (
  <LineIcon {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2.5" ry="2.5" fill="currentColor" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </LineIcon>
);

export const CheckIcon = (props: IconProps) => (
  <LineIcon {...props}><path d="M20 6 9 17l-5-5" /></LineIcon>
);
