import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../packages/i18n';
import '../v2-styles/FeatureGate.css';

interface FeatureGateProps {
  features: number[];
  featureId: number;
  displayName: string;
  children: ReactNode;
}

function FeatureGate({ features, featureId, displayName, children }: FeatureGateProps) {
  if (!features.includes(featureId)) {
    return (
      <div className="feature-gate">
        <div className="feature-gate-card">
          <div className="feature-gate-icon">
            <i className="fa-solid fa-lock"></i>
          </div>
          <h2 className="feature-gate-title">{displayName}</h2>
          <p className="feature-gate-desc">
            {t('featureGate.desc', { feature: displayName })}
          </p>
          <Link to="/events/services-and-prices" className="feature-gate-btn">
            <i className="fa-solid fa-arrow-up-right-dots"></i>
            {t('featureGate.upgrade')}
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default FeatureGate;
