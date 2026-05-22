import { ReactNode, useEffect, useState } from 'react';
import { getAdminRole } from '../client/admin';
import { AdminRole } from '../types/admin';
import V2Header from './V2Header';
import '../v2-styles/AdminOrders.css';

type AdminRouteGuardProps = {
  children: ReactNode;
  requireSuperAdmin?: boolean;
};

// Ne: Admin sayfalarina giriste backend rol kontrolu yapar.
// Nasil: /api/admin/check sonucunu okur; gerekirse sadece super admin rolune izin verir.
// Neden: Order admin manuel URL ile products veya admin management gibi super admin sayfalarina giremesin.
function AdminRouteGuard({ children, requireSuperAdmin = false }: AdminRouteGuardProps) {
  const [role, setRole] = useState<AdminRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    getAdminRole()
      .then((nextRole) => {
        setRole(nextRole);
        setDenied(requireSuperAdmin ? !nextRole.is_super_admin : !nextRole.is_admin);
      })
      .catch(() => setDenied(true))
      .finally(() => setLoading(false));
  }, [requireSuperAdmin]);

  if (loading) {
    return (
      <div className="admin-layout">
        <V2Header />
        <div className="admin-container">
          <div className="admin-empty">Loading...</div>
        </div>
      </div>
    );
  }

  if (denied || !role) {
    return (
      <div className="admin-layout">
        <V2Header />
        <div className="admin-container">
          <div className="admin-empty">Access denied.</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default AdminRouteGuard;

