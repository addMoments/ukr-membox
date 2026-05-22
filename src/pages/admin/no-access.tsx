import { adminText } from '../../utils/admin_i18n';
import V2Footer from '../../v2-components/V2Footer';
import V2Header from '../../v2-components/V2Header';
import '../../v2-styles/AdminOrders.css';

const at = adminText;

// Ne: Admin yetkisi kaldirilmis kullanici icin net bilgi ekrani.
// Nasil: Guard kullanmadan render olur; cunku bu ekrana zaten admin olmayan eski panel adminler yonlendirilir.
// Neden: Eventsiz eski panel admin services/prices satis akisana dusmeden neden paneli acamadigini gorsun.
function AdminNoAccess() {
  return (
    <>
      <V2Header />
      <div className="admin-layout">
        <main className="admin-container">
          <div className="admin-empty">
            <h1>{at('admin.noAccess.title', 'You do not have admin access.', 'У вас немає доступу адміністратора.')}</h1>
            <p>{at('admin.noAccess.description', 'This account does not have an active admin permission.', 'Цей обліковий запис не має активного дозволу адміністратора.')}</p>
          </div>
        </main>
      </div>
      <V2Footer />
    </>
  );
}

export default AdminNoAccess;
