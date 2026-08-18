import { useEffect, useState } from 'react';
import { EventPublic } from '../types/events';
import { GuestTheme, defaultGuestTheme } from '../types/guestTheme';
import '../v2-styles/PaymentSuccess.css';
import '../v2-styles/GuestGate.css';

interface V2GuestGateProps {
  state: 'not-started' | 'ended';
  event: EventPublic;
  theme?: GuestTheme;
}

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getCountdown(targetMs: number): Countdown {
  const msLeft = Math.max(0, targetMs - Date.now());
  const totalSeconds = Math.floor(msLeft / 1000);
  return {
    days:    Math.floor(totalSeconds / 86400),
    hours:   Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function formatDate(dateString?: string | null) {
  if (!dateString) return '';
  const normalized = dateString.endsWith('Z') || dateString.includes('+') ? dateString : dateString + 'Z';
  return new Date(normalized).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function V2GuestGate({ state, event, theme = defaultGuestTheme }: V2GuestGateProps) {
  // Host aktivasyon tarihini henuz secmemis olabilir. O zaman geri sayacak bir an
  // yok: sayac yerine duz "baslamadi" mesaji gosterilir.
  const activationIso = event.activation_date;
  const startMs = activationIso
    ? new Date(
        activationIso.endsWith('Z') || activationIso.includes('+')
          ? activationIso
          : activationIso + 'Z'
      ).getTime()
    : null;

  const [countdown, setCountdown] = useState<Countdown>(() => getCountdown(startMs ?? Date.now()));

  useEffect(() => {
    if (state !== 'not-started' || startMs === null) return;
    const timer = setInterval(() => {
      setCountdown(getCountdown(startMs));
    }, 1000);
    return () => clearInterval(timer);
  }, [startMs, state]);

  return (
    <div className="payment-success-page" style={theme}>
      <main className="payment-success-main">
        <div className="payment-success-card">

          {state === 'not-started' ? (
            <>
              <div className="guest-gate-icon">
                <i className="fa-solid fa-hourglass-start" />
              </div>

              <div className="payment-success-content">
                <h1 className="payment-success-title">Event Has Not Started Yet</h1>
                <p className="guest-gate-event-name">{event.name}</p>
              </div>

              {startMs !== null ? (
                <>
                  <div className="guest-gate-countdown">
                    <div className="guest-gate-countdown-block">
                      <span className="guest-gate-countdown-value">{pad(countdown.days)}</span>
                      <span className="guest-gate-countdown-label">Days</span>
                    </div>
                    <span className="guest-gate-countdown-sep">:</span>
                    <div className="guest-gate-countdown-block">
                      <span className="guest-gate-countdown-value">{pad(countdown.hours)}</span>
                      <span className="guest-gate-countdown-label">Hours</span>
                    </div>
                    <span className="guest-gate-countdown-sep">:</span>
                    <div className="guest-gate-countdown-block">
                      <span className="guest-gate-countdown-value">{pad(countdown.minutes)}</span>
                      <span className="guest-gate-countdown-label">Mins</span>
                    </div>
                    <span className="guest-gate-countdown-sep">:</span>
                    <div className="guest-gate-countdown-block">
                      <span className="guest-gate-countdown-value">{pad(countdown.seconds)}</span>
                      <span className="guest-gate-countdown-label">Secs</span>
                    </div>
                  </div>

                  <p className="guest-gate-date">Starting on {formatDate(event.activation_date)}</p>
                </>
              ) : (
                <p className="guest-gate-date">The host has not set the start date yet.</p>
              )}
            </>
          ) : (
            <>
              <div className="guest-gate-icon">
                <i className="fa-solid fa-heart" />
              </div>

              <div className="payment-success-content">
                <h1 className="payment-success-title">Thank You</h1>
                <p className="guest-gate-event-name">{event.name}</p>
                <p className="payment-success-description">
                  Thank you for being part of this special event.
                </p>
              </div>

              <p className="guest-gate-date">This event ended on {formatDate(event.active_until)}</p>
            </>
          )}

        </div>
      </main>
    </div>
  );
}

export default V2GuestGate;
