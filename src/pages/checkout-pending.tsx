import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SERV_ROOT } from '../consts';
import { sendToMsg } from '../types/mesage-screen';
import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import { clearCartState } from '../client/cart';
import { markMetaEventOnce, trackMetaPurchase } from '../client/meta-pixel';

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 24; // ~60 seconds total

// Ne: Backend purchase status cevabindan Meta'ya gonderilecek net odeme tutarini okur.
// Nasil: net_total alanini number veya numeric string olarak kabul eder, gecersizse null dondurur.
// Neden: Purchase event'inde tahmini cart toplamı yerine gercek odenen tutar kullanilsin.
function readPurchaseValue(data: { net_total?: unknown }) {
  const rawValue = data.net_total;
  const parsedValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export default function CheckoutPending() {
  const { encPackedUID } = useParams<{ encPackedUID: string }>();
  const [dots, setDots] = useState('.');
  const pollCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate dots
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!encPackedUID) return;

    const poll = async () => {
      pollCount.current += 1;

      try {
        const res = await fetch(`${SERV_ROOT}/api/purchase/${encPackedUID}/status`);

        if (!res.ok) {
          if (timerRef.current) clearInterval(timerRef.current);
          sendToMsg({
            title: 'Payment Failed',
            message: 'There was a problem with your payment.',
            subtext: 'Please try again or contact support.',
            image: 'https://addmoments.com.ua/ui/assets/err.svg',
            buttons: [{ text: 'Try Again', href: '/checkout' }],
          });
          return;
        }

        const data = await res.json();

        if (data.status === 'failed') {
          if (timerRef.current) clearInterval(timerRef.current);
          sendToMsg({
            title: 'Payment Failed',
            message: 'Your payment was not successful.',
            subtext: 'Please try again or contact support.',
            image: 'https://addmoments.com.ua/ui/assets/err.svg',
            buttons: [{ text: 'Try Again', href: '/checkout' }],
          });
          return;
        }

        if (data.status === 'pending') {
          if (pollCount.current >= MAX_POLLS) {
            if (timerRef.current) clearInterval(timerRef.current);
            sendToMsg({
              title: 'Payment Pending',
              message: 'We could not confirm your payment yet.',
              subtext: 'If you were charged, please contact support.',
              image: 'https://addmoments.com.ua/ui/assets/err.svg',
            });
          }
          return;
        }

        if (data.status === 'success') {
          if (timerRef.current) clearInterval(timerRef.current);
          const purchaseValue = readPurchaseValue(data);
          if (purchaseValue !== null && markMetaEventOnce(`meta_purchase_tracked_${encPackedUID}`)) {
            // Ne: Odeme backend tarafindan success dogrulandiginda Meta Purchase event'i yollar.
            // Nasil: Status response'taki net_total degeri UAH currency ile Meta payload'ina aktarilir.
            // Neden: Baslatilan odeme degil, gercek basarili satin alma revenue olarak sayilsin.
            trackMetaPurchase({
              value: purchaseValue,
              currency: 'UAH',
            });
          }
          await clearCartState();
          sendToMsg({
            title: 'Payment Successful!',
            message: `A signup link has been sent to ${data.email}`,
            subtext: 'Click the link in your inbox or the button below to sign up.',
            buttons: [{ text: 'Sign up now', href: data.signup_url }],
            image: 'https://addmoments.com.ua/ui/assets/checkmark.svg',
          });
        }
      } catch {
        // Network error — keep polling
      }
    };

    poll(); // immediate first check
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [encPackedUID]);

  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const simulateSuccess = async () => {
    if (!encPackedUID) return;
    await fetch(`${SERV_ROOT}/api/purchase/${encPackedUID}/simulate-success`, { method: 'POST' });
  };

  return (
    <>
      <V2Header />
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: 'Poppins, sans-serif' }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Confirming your payment{dots}</h2>
        <p style={{ color: '#666', margin: 0 }}>Please wait, do not close this page.</p>
        {isDev && (
          <button
            onClick={simulateSuccess}
            style={{ marginTop: 16, padding: '10px 28px', background: '#D2E823', border: 'none', borderRadius: 9999, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            [DEV] Simulate Payment Success
          </button>
        )}
      </div>
      <V2Footer />
    </>
  );
}
