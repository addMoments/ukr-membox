import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { addPanelOrderAdmin, deletePanelAdmin, getPanelAdmins } from '../../client/admin';
import { AddPanelOrderAdminPayload, AdminPanelAdmin } from '../../types/admin';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import V2Header from '../../v2-components/V2Header';
import '../../v2-styles/AdminPageHeader.css';
import '../../v2-styles/AdminOrders.css';

// Ne: ISO tarih degerini admin listesinde okunur hale getirir.
// Nasil: Bos degerde tire, dolu degerde en-GB tarih/saat formatini kullanir.
// Neden: Backend tarih formatina UI icinde tekrar tekrar parse mantigi yazilmasin.
function formatDate(str: string) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Ne: Super admin icin order admin yonetim ekranini render eder.
// Nasil: Listeyi endpointten yukler; uncontrolled hesap olusturma formuyla ekleme, confirm ile silme yapar.
// Neden: Order admin yetkileri frontendden ayrica yonetilebilsin ve bu ekran super admin route guard arkasinda kalsin.
function PanelAdmins() {
  const [admins, setAdmins] = useState<AdminPanelAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => {
    setLoading(true);
    getPanelAdmins()
      .then((data) => setAdmins(data))
      .catch((err) => {
        const text = err instanceof Error ? err.message : 'Failed to load panel admins.';
        setMessage({ ok: false, text });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Ne: Uncontrolled form verisini yeni backend payload'una cevirip dogrular.
  // Nasil: FormData'dan email/name/password/confirm_password okur; eksik veya eslesmeyen sifrede hata doner.
  // Neden: Backend'e hatali hesap olusturma istegi atmadan once super admin'e net geri bildirim verilsin.
  const buildCreatePayload = (form: HTMLFormElement): { payload?: AddPanelOrderAdminPayload; error?: string } => {
    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim();
    const name = String(formData.get('name') || '').trim();
    const password = String(formData.get('password') || '');
    const confirmPassword = String(formData.get('confirm_password') || '');

    if (!email) return { error: 'Email is required.' };
    if (!name) return { error: 'Name is required.' };
    if (!password) return { error: 'Password is required.' };
    if (!confirmPassword) return { error: 'Confirm password is required.' };
    if (password !== confirmPassword) return { error: 'Passwords do not match.' };

    return {
      payload: {
        email,
        name,
        password,
        confirm_password: confirmPassword,
        role: 'order_admin',
      },
    };
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { payload, error } = buildCreatePayload(form);

    if (!payload) {
      setMessage({ ok: false, text: error || 'Please check the form.' });
      return;
    }

    setSaving(true);
    setMessage({ ok: true, text: 'Creating order admin...' });
    try {
      await addPanelOrderAdmin(payload);
      form.reset();
      setMessage({ ok: true, text: 'Order admin created.' });
      load();
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Failed to create order admin.';
      setMessage({ ok: false, text });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (admin: AdminPanelAdmin) => {
    const label = admin.email || admin.user_uid;
    if (!window.confirm(`Remove order admin access for ${label}?`)) return;

    setMessage({ ok: true, text: 'Removing order admin...' });
    try {
      await deletePanelAdmin(admin.user_uid);
      setAdmins((prev) => prev.filter((item) => item.user_uid !== admin.user_uid));
      setMessage({ ok: true, text: 'Order admin removed.' });
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Failed to remove order admin.';
      setMessage({ ok: false, text });
    }
  };

  return (
    <div className="admin-layout">
      <V2Header />
      <div className="admin-container">
        <AdminPageHeader
          breadcrumbs={[{ label: 'Admin' }, { label: 'Panel Admins' }]}
          title="Panel Admins"
          actions={
            <>
              <Link to="/admin/orders" className="admin-page-header-link">
                <i className="fa-solid fa-receipt" />
                View Orders
              </Link>
              <Link to="/admin/products" className="admin-page-header-link">
                <i className="fa-solid fa-boxes-stacked" />
                Manage Products
              </Link>
              <Link to="/admin/promos" className="admin-page-header-link">
                <i className="fa-solid fa-ticket" />
                Promos
              </Link>
            </>
          }
        />

        <section className="admin-panel-card">
          <h2 className="admin-panel-title">Create Order Admin</h2>
          <form className="admin-panel-form" onSubmit={onSubmit}>
            <input name="email" type="email" className="admin-control-input" placeholder="admin@example.com" disabled={saving} />
            <input name="name" className="admin-control-input" placeholder="Admin Name" disabled={saving} />
            <input name="password" type="password" className="admin-control-input" placeholder="Temporary password" disabled={saving} />
            <input name="confirm_password" type="password" className="admin-control-input" placeholder="Confirm password" disabled={saving} />
            <button type="submit" className="admin-save-btn" disabled={saving}>
              {saving ? 'Creating...' : 'Create'}
            </button>
          </form>
          {message && <p className={message.ok ? 'admin-panel-message-ok' : 'admin-panel-message-error'}>{message.text}</p>}
        </section>

        {loading && <div className="admin-empty">Loading panel admins...</div>}

        {!loading && admins.length === 0 && <div className="admin-empty">No order admins yet.</div>}

        {!loading && admins.length > 0 && (
          <div className="admin-panel-list">
            {admins.map((admin) => (
              <article key={admin.user_uid} className="admin-panel-row">
                <div className="admin-panel-row-main">
                  <strong>{admin.email || '—'}</strong>
                  <span>{admin.name || 'No name'}</span>
                  <small>Role: {admin.role}</small>
                </div>
                <div className="admin-panel-row-meta">
                  <span>Created: {formatDate(admin.created_at)}</span>
                  <span>By: {admin.created_by_email || '—'}</span>
                </div>
                <button type="button" className="admin-panel-delete-btn" onClick={() => onDelete(admin)}>
                  Remove
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PanelAdmins;

