import { Link } from 'react-router-dom';

interface AddonBoxProps {
  to: string;
  iconClass: string;
  title: string;
  description: string;
  accent?: boolean;
}

function AddonBox({ to, iconClass, title, description, accent }: AddonBoxProps) {
  return (
    <Link to={to} className="ehc-tool-card">
      <div className={`ehc-tool-icon${accent ? ' ehc-tool-icon-accent' : ''}`}>
        <i className={iconClass} />
      </div>
      <h3 className="ehc-tool-title">{title}</h3>
      <p className="ehc-tool-desc">{description}</p>
    </Link>
  );
}

export default AddonBox;
