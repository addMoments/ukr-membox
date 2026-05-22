import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { addPanelOrderAdmin, deletePanelAdmin, getPanelAdmins } from '../../client/admin';
import { AddPanelOrderAdminPayload, AdminPanelAdmin } from '../../types/admin';
import { adminText } from '../../utils/admin_i18n';
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

const at = adminText;

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
        const text = err instanceof Error ? err.message : at('admin.panelAdmins.errors.load', 'Failed to load panel admins.', 'Не вдалося завантажити адміністраторів панелі.');
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

    if (!email) return { error: at('admin.panelAdmins.errors.emailRequired', 'Email is required.', 'Потрібно вказати email.') };
    if (!name) return { error: at('admin.panelAdmins.errors.nameRequired', 'Name is required.', 'Потрібно вказати ім\'я.') };
    if (!password) return { error: at('admin.panelAdmins.errors.passwordRequired', 'Password is required.', 'Потрібно вказати пароль.') };
    if (!confirmPassword) return { error: at('admin.panelAdmins.errors.confirmPasswordRequired', 'Confirm password is required.', 'Потрібно підтвердити пароль.') };
    if (password !== confirmPassword) return { error: at('admin.panelAdmins.errors.passwordsDoNotMatch', 'Passwords do not match.', 'Паролі не збігаються.') };

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
      setMessage({ ok: false, text: error || at('admin.common.pleaseCheckForm', 'Please check the form.', 'Перевірте форму.') });
      return;
    }

    setSaving(true);
    setMessage({ ok: true, text: at('admin.panelAdmins.creating', 'Creating order admin...', 'Створення адміністратора замовлень...') });
    try {
      await addPanelOrderAdmin(payload);
      form.reset();
      setMessage({ ok: true, text: at('admin.panelAdmins.created', 'Order admin created.', 'Адміністратора замовлень створено.') });
      load();
    } catch (err) {
      const text = err instanceof Error ? err.message : at('admin.panelAdmins.errors.create', 'Failed to create order admin.', 'Не вдалося створити адміністратора замовлень.');
      setMessage({ ok: false, text });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (admin: AdminPanelAdmin) => {
    const label = admin.email || admin.user_uid;
    if (!window.confirm(at('admin.panelAdmins.deleteConfirm', `Remove order admin access for ${label}?`, `Прибрати доступ адміністратора замовлень для ${label}?`, { label }))) return;

    setMessage({ ok: true, text: at('admin.panelAdmins.removing', 'Removing order admin...', 'Видалення адміністратора замовлень...') });
    try {
      await deletePanelAdmin(admin.user_uid);
      setAdmins((prev) => prev.filter((item) => item.user_uid !== admin.user_uid));
      setMessage({ ok: true, text: at('admin.panelAdmins.removed', 'Order admin removed.', 'Адміністратора замовлень видалено.') });
    } catch (err) {
      const text = err instanceof Error ? err.message : at('admin.panelAdmins.errors.remove', 'Failed to remove order admin.', 'Не вдалося прибрати адміністратора замовлень.');
      setMessage({ ok: false, text });
    }
  };

  return (
    <div className="admin-layout">
      <V2Header />
      <div className="admin-container">
        <AdminPageHeader
          breadcrumbs={[{ label: at('admin.nav.admin', 'Admin', 'Адмін') }, { label: at('admin.panelAdmins.title', 'Panel Admins', 'Адміністратори панелі') }]}
          title={at('admin.panelAdmins.title', 'Panel Admins', 'Адміністратори панелі')}
          actions={
            <>
              <Link to="/admin/orders" className="admin-page-header-link">
                <i className="fa-solid fa-receipt" />
                {at('admin.nav.viewOrders', 'View Orders', 'Переглянути замовлення')}
              </Link>
              <Link to="/admin/products" className="admin-page-header-link">
                <i className="fa-solid fa-boxes-stacked" />
                {at('admin.nav.manageProducts', 'Manage Products', 'Керувати продуктами')}
              </Link>
              <Link to="/admin/promos" className="admin-page-header-link">
                <i className="fa-solid fa-ticket" />
                {at('admin.nav.promos', 'Promos', 'Промокоди')}
              </Link>
              <Link to="/admin/partnerships" className="admin-page-header-link">
                <i className="fa-solid fa-handshake" />
                {at('admin.nav.partnerships', 'Partnerships', 'Партнерства')}
              </Link>
            </>
          }
        />

        <section className="admin-panel-card">
          <h2 className="admin-panel-title">{at('admin.panelAdmins.createTitle', 'Create Order Admin', 'Створити адміністратора замовлень')}</h2>
          <form className="admin-panel-form" onSubmit={onSubmit}>
            <input name="email" type="email" className="admin-control-input" placeholder="admin@example.com" disabled={saving} />
            <input name="name" className="admin-control-input" placeholder={at('admin.common.name', 'Name', 'Ім\'я')} disabled={saving} />
            <input name="password" type="password" className="admin-control-input" placeholder={at('admin.panelAdmins.temporaryPassword', 'Temporary password', 'Тимчасовий пароль')} disabled={saving} />
            <input name="confirm_password" type="password" className="admin-control-input" placeholder={at('admin.panelAdmins.confirmPassword', 'Confirm password', 'Підтвердити пароль')} disabled={saving} />
            <button type="submit" className="admin-save-btn" disabled={saving}>
              {saving ? at('admin.common.creating', 'Creating...', 'Створення...') : at('admin.common.create', 'Create', 'Створити')}
            </button>
          </form>
          {message && <p className={message.ok ? 'admin-panel-message-ok' : 'admin-panel-message-error'}>{message.text}</p>}
        </section>

        {loading && <div className="admin-empty">{at('admin.panelAdmins.loading', 'Loading panel admins...', 'Завантаження адміністраторів панелі...')}</div>}

        {!loading && admins.length === 0 && <div className="admin-empty">{at('admin.panelAdmins.empty', 'No order admins yet.', 'Адміністраторів замовлень ще немає.')}</div>}

        {!loading && admins.length > 0 && (
          <div className="admin-panel-list">
            {admins.map((admin) => (
              <article key={admin.user_uid} className="admin-panel-row">
                <div className="admin-panel-row-main">
                  <strong>{admin.email || '—'}</strong>
                  <span>{admin.name || at('admin.panelAdmins.noName', 'No name', 'Без імені')}</span>
                  <small>{at('admin.panelAdmins.role', 'Role', 'Роль')}: {admin.role}</small>
                </div>
                <div className="admin-panel-row-meta">
                  <span>{at('admin.common.created', 'Created', 'Створено')}: {formatDate(admin.created_at)}</span>
                  <span>{at('admin.common.by', 'By', 'Ким')}: {admin.created_by_email || '—'}</span>
                </div>
                <button type="button" className="admin-panel-delete-btn" onClick={() => onDelete(admin)}>
                  {at('admin.common.remove', 'Remove', 'Прибрати')}
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

