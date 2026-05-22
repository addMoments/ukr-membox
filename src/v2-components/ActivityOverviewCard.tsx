import { t } from '../packages/i18n';
import '../v2-styles/ActivityOverviewCard.css';

interface StatItem {
  value: string | number;
  label: string;
}

interface ActivityOverviewCardProps {
  stats: StatItem[];
}

function ActivityOverviewCard({ stats }: ActivityOverviewCardProps) {
  return (
    <div className="activity-overview-card">
      <h3 className="activity-overview-title">
        <i className="fa-solid fa-chart-simple" />
        {t('eventHome.activityOverview.title')}
      </h3>
      <div className="activity-overview-grid">
        {stats.map((stat, index) => (
          <div key={index} className="activity-overview-item">
            <div className="activity-overview-value" style={{ fontSize: String(stat.value).length > 4 ? '18px' : undefined }}>{stat.value}</div>
            <div className="activity-overview-label" style={{ fontSize: stat.label.length > 5 ? '12px' : undefined }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ActivityOverviewCard;
