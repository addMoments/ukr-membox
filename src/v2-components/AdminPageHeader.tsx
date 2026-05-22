import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import '../v2-styles/AdminPageHeader.css';

type BreadcrumbItem = {
  label: string;
  to?: string;
};

type AdminPageHeaderProps = {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  actions?: ReactNode;
};

function AdminPageHeader({ breadcrumbs, title, actions }: AdminPageHeaderProps) {
  return (
    <div className="admin-page-header">
      <nav className="admin-page-header-breadcrumb">
        {breadcrumbs.map((item, index) => (
          <span key={index}>
            {index > 0 && <span className="admin-page-header-separator">›</span>}
            {item.to ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span className="current">{item.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="admin-page-header-row">
        <h1 className="admin-page-header-title">{title}</h1>
        {actions && <div className="admin-page-header-actions">{actions}</div>}
      </div>
    </div>
  );
}

export default AdminPageHeader;
