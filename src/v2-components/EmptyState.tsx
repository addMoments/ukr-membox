import '../v2-styles/EmptyState.css';

interface EmptyStateProps {
  title: string;
  subtitle: string;
  color: string;
}

function EmptyState({ title, subtitle, color }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <i 
        className="fa-solid fa-inbox empty-state-icon" 
        style={{ color }} 
      />
      <h2 className="empty-state-title" style={{ color }}>
        {title}
      </h2>
      <p className="empty-state-subtitle" style={{ color }}>
        {subtitle}
      </p>
    </div>
  );
}

export default EmptyState;
