import V2Footer from '../../v2-components/V2Footer';
import V2Header from '../../v2-components/V2Header';
import '../../v2-styles/AdminOrders.css';

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
            <h1>{"Admin yetkiniz bulunmamaktad\u0131r."}</h1>
            <p>Bu hesap icin aktif bir admin yetkisi bulunmuyor.</p>
          </div>
        </main>
      </div>
      <V2Footer />
    </>
  );
}

export default AdminNoAccess;
