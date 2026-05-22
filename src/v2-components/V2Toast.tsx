import { proxy, useSnapshot } from 'valtio';
import '../v2-styles/V2Toast.css';

export type ToastVariant = 'success' | 'info' | 'error';

interface ToastState {
  open: boolean;
  variant: ToastVariant;
  message: string;
}

export const toastState: ToastState = proxy<ToastState>({
  open: false,
  variant: 'success',
  message: '',
});

let dismissTimer: number | null = null;

// Ne: Generic toast'i ekrana 3 saniye boyunca gosterir.
// Nasil: Valtio store'u guncelleyip open=true yapar; aktif bir auto-dismiss varsa temizleyip yenisini kurar.
// Neden: Modal kapandiktan sonra kullaniciya kisa, kesintisiz bir geri bildirim verilebilsin (success/info/error variant'lariyla).
export const showToast = (message: string, variant: ToastVariant = 'success', durationMs: number = 3000) => {
  toastState.open = true;
  toastState.message = message;
  toastState.variant = variant;
  if (dismissTimer) window.clearTimeout(dismissTimer);
  dismissTimer = window.setTimeout(() => {
    toastState.open = false;
    dismissTimer = null;
  }, durationMs);
};

// Ne: Acik olan toast'i hemen kapatir.
// Nasil: open=false yapar ve aktif setTimeout'u iptal eder.
// Neden: Kullanici kapat butonuna bastiginda toast aninda kaybolsun, gereksiz state degisikligi yasanmasin.
export const dismissToast = () => {
  toastState.open = false;
  if (dismissTimer) {
    window.clearTimeout(dismissTimer);
    dismissTimer = null;
  }
};

const iconForVariant = (variant: ToastVariant): string => {
  switch (variant) {
    case 'success': return 'fa-solid fa-circle-check';
    case 'info': return 'fa-solid fa-circle-info';
    case 'error': return 'fa-solid fa-triangle-exclamation';
  }
};

function V2Toast() {
  const snap = useSnapshot(toastState);
  if (!snap.open) return null;

  return (
    <div className={`v2-toast v2-toast-${snap.variant}`} role="status" aria-live="polite">
      <div className="v2-toast-icon">
        <i className={iconForVariant(snap.variant)} />
      </div>
      <div className="v2-toast-message">{snap.message}</div>
      <button
        type="button"
        className="v2-toast-close"
        onClick={dismissToast}
        aria-label="Close"
      >
        <i className="fa-solid fa-xmark" />
      </button>
    </div>
  );
}

export default V2Toast;
