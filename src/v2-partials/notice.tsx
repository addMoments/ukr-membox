import '../v2-styles/PaymentSuccess.css';
import { MessageScreen } from '../types/mesage-screen';

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
