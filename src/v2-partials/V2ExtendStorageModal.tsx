import { useEffect, useState } from 'react';
import { t } from '../packages/i18n';
import {
  extendStorage,
  isAlreadyExtendedError,
  isExtendForbiddenError,
  isExtendRejectedError,
} from '../client/event-storage';
import { isEventClosedError } from '../utils/guestInitError';
import { showToast } from '../v2-components/V2Toast';
import '../v2-styles/V2ExtendStorageModal.css';

interface V2ExtendStorageModalProps {
  open: boolean;
  packedUid: string;
  onClose: () => void;
  onSuccess: (storageUntil: string) => void;
  onRefetch: () => void;
  onEventClosed: () => void;
}

// Ne: extendStorage namespace'i icin tum fallback metinleri (en/uk).
// Nasil: i18n S3'ten yukledigi icin lokal lang dosyasi guncellense bile build ortaminda key bulunamayabiliyor; t() o durumda raw key'i (orn. "extendStorage.modalTitle") donuyor. Bu yuzden burada hardcoded fallback tutuyoruz.
// Neden: i18n cache'i yenilenene kadar UI'da raw key gorunmesin; dile gore Ukraynaca/Ingilizce metin dogru gozuksun.
const FALLBACKS: Record<string, { en: string; uk: string }> = {
  'extendStorage.modalTitle': {
    en: 'Your event will be deleted in 14 days',
    uk: 'Ваш івент буде видалено через 14 днів',
  },
  'extendStorage.modalMessage': {
    en: 'After the storage period ends, the event and all of its data will be removed from the system. You can extend it for one more month using the button below. NOTE: Extension is a one-time only option.',
    uk: 'Після завершення періоду зберігання івент та всі його дані будуть видалені з системи. Ви можете продовжити його ще на один місяць, натиснувши кнопку нижче. УВАГА: Продовження доступне лише один раз.',
  },
  'extendStorage.cancel': { en: 'Cancel', uk: 'Скасувати' },
  'extendStorage.extend': { en: 'Extend 1 month', uk: 'Продовжити на 1 місяць' },
  'extendStorage.extending': { en: 'Extending...', uk: 'Продовження...' },
  'extendStorage.toastSuccess': {
    en: 'Storage period extended by 1 month',
    uk: 'Період зберігання продовжено на 1 місяць',
  },
  'extendStorage.toastAlreadyExtended': {
    en: 'This event has already been extended',
    uk: 'Цей івент вже було продовжено',
  },
  'extendStorage.toastRejected': {
    en: 'Extension failed (the period may have expired)',
    uk: 'Не вдалося продовжити (можливо, термін минув)',
  },
  'extendStorage.toastClosed': {
    en: 'This event has been closed',
    uk: 'Цей івент закрито',
  },
  'extendStorage.toastForbidden': {
    en: "You don't have permission to extend this event",
    uk: 'У вас немає дозволу продовжувати цей івент',
  },
  'extendStorage.toastUnknown': {
    en: 'Something went wrong, please try again',
    uk: 'Щось пішло не так, спробуйте ще раз',
  },
};

// Ne: t() cagrisini sarip raw key dondugunde dile uygun fallback'e dusen yardimci.
// Nasil: t(key) sonucunu key ile karsilastirir; ayni ise FALLBACKS tablosundan lang_code'a gore string secer.
// Neden: S3'ten yuklenmemis cevirilerde bile UI dogru metni gostersin.
const tr = (key: string): string => {
  const value = t(key);
  if (value && value !== key) return value;
  const lang = t('lang_code');
  const langKey = lang === 'uk' ? 'uk' : 'en';
  return FALLBACKS[key]?.[langKey] ?? key;
};

// Ne: Etkinlik saklama suresini 1 ay uzatma akisini barindiran modal.
// Nasil: Acildiginda kullanicidan onay alir; "Extend"e basildiginda extendStorage cagirilir; status'a gore parent callback'lerine bildirim verir ve toast gosterir.
// Neden: Tek bir noktadan API + UX yonetimi yaparak EventDetailLayout temiz kalsin; site design dili (lavanta accent, pill buton, blur backdrop) ile tutarli olsun.
function V2ExtendStorageModal({
  open,
  packedUid,
  onClose,
  onSuccess,
  onRefetch,
  onEventClosed,
}: V2ExtendStorageModalProps) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, submitting, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = () => {
    if (submitting) return;
    onClose();
  };

  // Ne: Backend'e uzatma istegini gonderir ve donen status'a gore UI'i yonlendirir.
  // Nasil: extendStorage cagrir; basariliysa onSuccess+toastSuccess; 409/410/403/diger hatalarinda ilgili helper'larla teshis edip uygun toast ve parent callback'i tetikler.
  // Neden: Modal kullaniciya net bir geri bildirim verirken parent state'inin dogru senkron olmasini saglasin.
  const handleExtend = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await extendStorage(packedUid);
      onSuccess(res.storage_until);
      onClose();
      showToast(tr('extendStorage.toastSuccess'), 'success');
    } catch (err) {
      if (isAlreadyExtendedError(err)) {
        onRefetch();
        onClose();
        showToast(tr('extendStorage.toastAlreadyExtended'), 'info');
      } else if (isExtendRejectedError(err)) {
        onRefetch();
        onClose();
        showToast(tr('extendStorage.toastRejected'), 'error');
      } else if (isEventClosedError(err)) {
        onEventClosed();
        onClose();
        showToast(tr('extendStorage.toastClosed'), 'error');
      } else if (isExtendForbiddenError(err)) {
        onClose();
        showToast(tr('extendStorage.toastForbidden'), 'error');
      } else {
        onClose();
        showToast(tr('extendStorage.toastUnknown'), 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="extend-modal-overlay" onClick={handleBackdropClick}>
      <div
        className="extend-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extend-modal-title"
        aria-describedby="extend-modal-message"
        onClick={(e) => e.stopPropagation()}
      >
        {!submitting && (
          <button
            type="button"
            className="extend-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        )}

        <div className="extend-modal-icon">
          <i className="fa-regular fa-clock" />
        </div>

        <h2 id="extend-modal-title" className="extend-modal-title">
          {tr('extendStorage.modalTitle')}
        </h2>

        <p id="extend-modal-message" className="extend-modal-message">
          {tr('extendStorage.modalMessage')}
        </p>

        <div className="extend-modal-actions">
          <button
            type="button"
            className="extend-modal-btn extend-modal-btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            {tr('extendStorage.cancel')}
          </button>
          <button
            type="button"
            className="extend-modal-btn extend-modal-btn-primary"
            onClick={handleExtend}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="extend-modal-spinner" />
                {tr('extendStorage.extending')}
              </>
            ) : (
              tr('extendStorage.extend')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default V2ExtendStorageModal;
