import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import '../v2-styles/PaymentSuccess.css';
import { MessageScreen } from '../types/mesage-screen';
import { t } from '../packages/i18n';

// Ne: notice.link varsa linki QR + kopyalanabilir metin olarak gosteren blok.
// Nasil: QR data-URI'si tarayicida uretilir; kopyalama clipboard API'siyle, o yoksa
//        gecici bir textarea + execCommand ile yapilir (http/eski Safari yolu).
// Neden: Aktivasyon maili ulasmadiginda musteri linki ekrandan okuyup telefonuna gecirebilsin.
function NoticeLink({ link }: { link: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(link, { width: 320, margin: 1, color: { dark: '#1E2330', light: '#FFFFFF' } })
      .then(url => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [link]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const ta = document.createElement('textarea');
        ta.value = link;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
    } catch {
      // Kopyalanamadi: link zaten ekranda secilebilir halde duruyor.
    }
  };

  return (
    <div className="payment-success-link">
      <p className="payment-success-link-title">{t('notice.linkTitle')}</p>
      <p className="payment-success-link-desc">{t('notice.linkDesc')}</p>
      {qrDataUrl && <img src={qrDataUrl} className="payment-success-link-qr" alt={t('notice.qrAlt')} />}
      <div className="payment-success-link-row">
        <span className="payment-success-link-url">{link}</span>
        <button type="button" className="payment-success-link-copy" onClick={copy}>
          <i className={copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'}></i>
          {copied ? t('notice.copied') : t('notice.copy')}
        </button>
      </div>
    </div>
  );
}

function NoticeScreen({notice}: {notice: MessageScreen}) {
  return (
    <div className="payment-success-page">

      <main className="payment-success-main">
        <div className="payment-success-card">
          {/* Success Icon */}
          {notice.image && <div className="payment-success-icon-wrapper">
            <div className="payment-success-icon-ring">
              <img src={notice.image} className="payment-success-icon-circle" />
            </div>
          </div>}

          {/* Content */}
          <div className="payment-success-content">
            <h1 className="payment-success-title">{notice.title}</h1>
            {notice.message && <p className="payment-success-description">{notice.message}</p>}
            {notice.subtext && <p className="payment-success-tagline">{notice.subtext}</p>}
          </div>

          {/* Actions */}
          <div className="payment-success-actions">
            {notice.buttons && notice.buttons.map((button) => (
              <a href={button.href} className="payment-success-cta">
                {button.text}
                <i className="fa-solid fa-arrow-right"></i>
              </a>
            ))}

            {notice.link && <NoticeLink link={notice.link} />}

            {notice.warning && <div className="payment-success-hint">
              <i className="fa-solid fa-circle-info payment-success-hint-icon"></i>
              <p className="payment-success-hint-text">
                {notice.warning}
              </p>
            </div>}
          </div>
        </div>
      </main>

    </div>
  );
}

export default NoticeScreen;
