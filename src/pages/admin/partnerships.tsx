import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createAdminPartnership,
  getAdminPartnerships,
  updateAdminPartnership,
} from '../../client/partnership';
import { AdminPartnership, CreatePartnershipPayload, PartnershipMetrics, UpdatePartnershipPayload } from '../../types/partnership';
import { adminText } from '../../utils/admin_i18n';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import V2Header from '../../v2-components/V2Header';
import '../../v2-styles/AdminPageHeader.css';
import '../../v2-styles/AdminOrders.css';

// Ne: ISO tarih degerini admin listesinde okunur hale getirir.
// Nasil: Bos degerde tire, dolu degerde en-GB tarih/saat formatini kullanir.
// Neden: Partnership kayit tarihleri listede tutarli gorunsun.
function formatDate(str?: string | null) {
  if (!str) return '-';
  return new Date(str).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Ne: Partnership metrik tutarlarini Ukrayna para birimi formatinda gosterir.
// Nasil: Bos/gecersiz degerleri 0 kabul edip iki ondalikli string dondurur.
// Neden: Gross, discount ve net kartlari listede tutarli hizalansin.
function formatMoney(value: number) {
  return `₴${Number(value || 0).toFixed(2)}`;
}

// Ne: Optional form alanini create payload'u icin okur.
// Nasil: Bos stringleri undefined yapar, dolu degerleri trimlenmis string olarak dondurur.
// Neden: Opsiyonel partnership alanlari bosken backend'e gereksiz empty string gonderilmesin.
function readOptionalString(value: FormDataEntryValue | null): string | undefined {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw || undefined;
}

// Ne: Optional form alanini update payload'u icin okur.
// Nasil: Bos stringleri null yapar, dolu degerleri trimlenmis string olarak dondurur.
// Neden: Admin optional contact alanlarini sonradan temizleyebilsin.
function readOptionalStringOrNull(value: FormDataEntryValue | null): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw || null;
}

// Ne: Partnership satirini kaydedilen form payload'u ile local olarak gunceller.
// Nasil: Backend PATCH cevabini UI state icin kaynak almaz; mevcut kaydin uzerine formdan okunan alanlari uygular.
// Neden: Backend partial/empty response dondurdugunde save sonrasi input degerleri sifirlanmasin.
function applyPartnershipPayload(current: AdminPartnership, payload: UpdatePartnershipPayload): AdminPartnership {
  return {
    ...current,
    name: payload.name ?? current.name,
    surname: payload.surname ?? current.surname,
    company_name: payload.company_name !== undefined ? payload.company_name : current.company_name,
    phone: payload.phone !== undefined ? payload.phone : current.phone,
    email: payload.email !== undefined ? payload.email : current.email,
    is_active: payload.is_active ?? current.is_active,
  };
}

const at = adminText;

interface PartnershipMetricsInlineProps {
  metrics?: PartnershipMetrics;
}

// Ne: Partnership metriklerini liste satirindaki kutuda gosterir.
// Nasil: Metrics yoksa sifir/null varsayilanlari kullanir ve mevcut admin metric kart siniflariyla render eder.
// Neden: Ayrica detay sayfasi acmadan partner performansi tek ekranda gorulebilsin.
function PartnershipMetricsInline({ metrics }: PartnershipMetricsInlineProps) {
  const safeMetrics: PartnershipMetrics = metrics || {
    promo_count: 0,
    usage_count: 0,
    gross_total: 0,
    discount_total: 0,
    net_total: 0,
    first_used_at: null,
    last_used_at: null,
  };

  return (
    <div className="admin-partnership-metrics">
      <div className="admin-order-account-metric">
        <span className="admin-order-account-label">{at('admin.partnerships.metrics.promoCount', 'Promo Count', 'К-сть промокодів')}</span>
        <span className="admin-order-account-value">{safeMetrics.promo_count}</span>
      </div>
      <div className="admin-order-account-metric">
        <span className="admin-order-account-label">{at('admin.partnerships.metrics.usageCount', 'Usage Count', 'К-сть використань')}</span>
        <span className="admin-order-account-value">{safeMetrics.usage_count}</span>
      </div>
      <div className="admin-order-account-metric">
        <span className="admin-order-account-label">{at('admin.partnerships.metrics.grossTotal', 'Gross Total', 'Валовий підсумок')}</span>
        <span className="admin-order-account-value">{formatMoney(safeMetrics.gross_total)}</span>
      </div>
      <div className="admin-order-account-metric">
        <span className="admin-order-account-label">{at('admin.partnerships.metrics.discountTotal', 'Discount Total', 'Сума знижок')}</span>
        <span className="admin-order-account-value">{formatMoney(safeMetrics.discount_total)}</span>
      </div>
      <div className="admin-order-account-metric">
        <span className="admin-order-account-label">{at('admin.partnerships.metrics.netTotal', 'Net Total', 'Чистий підсумок')}</span>
        <span className="admin-order-account-value">{formatMoney(safeMetrics.net_total)}</span>
      </div>
      <div className="admin-order-account-metric">
        <span className="admin-order-account-label">{at('admin.partnerships.metrics.firstUsed', 'First Used', 'Перше використання')}</span>
        <span className="admin-order-account-value">{formatDate(safeMetrics.first_used_at)}</span>
      </div>
      <div className="admin-order-account-metric">
        <span className="admin-order-account-label">{at('admin.partnerships.metrics.lastUsed', 'Last Used', 'Останнє використання')}</span>
        <span className="admin-order-account-value">{formatDate(safeMetrics.last_used_at)}</span>
      </div>
    </div>
  );
}

// Ne: Super admin partnership CRUD ekranini render eder.
// Nasil: Create formu ve her partnership icin edit/delete aksiyonlarini backend client fonksiyonlarina baglar.
// Neden: Partnership yonetimi ve metrikleri promo akisini bozmadan tek super admin sayfasinda kalabilsin.
function AdminPartnerships() {
  const [partnerships, setPartnerships] = useState<AdminPartnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyByUid, setBusyByUid] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => {
    setLoading(true);
    getAdminPartnerships()
      .then((data) => setPartnerships(data))
      .catch((err) => setMessage({ ok: false, text: err instanceof Error ? err.message : at('admin.partnerships.errors.load', 'Failed to load partnerships.', 'Не вдалося завантажити партнерства.') }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Ne: Create form verisini partnership create payload'una cevirir.
  // Nasil: Uncontrolled formdan FormData okur; zorunlu name/surname alanlarini dogrular, optional alanlari bos ise payload'a eklemez.
  // Neden: Backend zorunlu alan hatalarindan once admin'e net form geri bildirimi verilsin.
  const buildCreatePayload = (form: HTMLFormElement): { payload?: CreatePartnershipPayload; error?: string } => {
    const formData = new FormData(form);
    const name = String(formData.get('name') || '').trim();
    const surname = String(formData.get('surname') || '').trim();
    const companyName = readOptionalString(formData.get('company_name'));
    const phone = readOptionalString(formData.get('phone'));
    const email = readOptionalString(formData.get('email'));

    if (!name) return { error: at('admin.partnerships.errors.nameRequired', 'Name is required.', 'Потрібно вказати ім\'я.') };
    if (!surname) return { error: at('admin.partnerships.errors.surnameRequired', 'Surname is required.', 'Потрібно вказати прізвище.') };

    return {
      payload: {
        name,
        surname,
        ...(companyName ? { company_name: companyName } : {}),
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
      },
    };
  };

  // Ne: Edit form verisini partnership update payload'una cevirir.
  // Nasil: Required alanlari trimleyip dogrular, optional alanlar bos ise null gonderir.
  // Neden: Admin kaydi guncellerken phone/email/company gibi alanlari temizleyebilsin.
  const buildUpdatePayload = (form: HTMLFormElement): { payload?: UpdatePartnershipPayload; error?: string } => {
    const formData = new FormData(form);
    const name = String(formData.get('name') || '').trim();
    const surname = String(formData.get('surname') || '').trim();

    if (!name) return { error: at('admin.partnerships.errors.nameRequired', 'Name is required.', 'Потрібно вказати ім\'я.') };
    if (!surname) return { error: at('admin.partnerships.errors.surnameRequired', 'Surname is required.', 'Потрібно вказати прізвище.') };

    return {
      payload: {
        name,
        surname,
        company_name: readOptionalStringOrNull(formData.get('company_name')),
        phone: readOptionalStringOrNull(formData.get('phone')),
        email: readOptionalStringOrNull(formData.get('email')),
      },
    };
  };

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { payload, error } = buildCreatePayload(form);

    if (!payload) {
      setMessage({ ok: false, text: error || at('admin.common.pleaseCheckForm', 'Please check the form.', 'Перевірте форму.') });
      return;
    }

    setSaving(true);
    setMessage({ ok: true, text: at('admin.partnerships.creating', 'Creating partnership...', 'Створення партнерства...') });
    try {
      const partnership = await createAdminPartnership(payload);
      setPartnerships((prev) => [partnership, ...prev]);
      form.reset();
      setMessage({ ok: true, text: at('admin.partnerships.created', 'Partnership created.', 'Партнерство створено.') });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : at('admin.partnerships.errors.create', 'Failed to create partnership.', 'Не вдалося створити партнерство.') });
    } finally {
      setSaving(false);
    }
  };

  const onUpdate = async (event: FormEvent<HTMLFormElement>, partnership: AdminPartnership) => {
    event.preventDefault();
    const { payload, error } = buildUpdatePayload(event.currentTarget);

    if (!payload) {
      setMessage({ ok: false, text: error || at('admin.common.pleaseCheckForm', 'Please check the form.', 'Перевірте форму.') });
      return;
    }

    setBusyByUid((prev) => ({ ...prev, [partnership.uid]: true }));
    setMessage({ ok: true, text: at('admin.partnerships.saving', 'Saving partnership...', 'Збереження партнерства...') });
    try {
      await updateAdminPartnership(partnership.uid, payload);
      const nextPartnership = applyPartnershipPayload(partnership, payload);
      setPartnerships((prev) => prev.map((item) => (item.uid === partnership.uid ? nextPartnership : item)));
      setMessage({ ok: true, text: at('admin.partnerships.saved', 'Partnership saved.', 'Партнерство збережено.') });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : at('admin.partnerships.errors.save', 'Failed to save partnership.', 'Не вдалося зберегти партнерство.') });
    } finally {
      setBusyByUid((prev) => ({ ...prev, [partnership.uid]: false }));
    }
  };

  // Ne: Partnership aktif/pasif durumunu degistirir.
  // Nasil: PATCH /api/admin/partnerships/:uid endpointine is_active boolean'i gonderir.
  // Neden: Backend artik delete'i deactivate olarak kullandigi icin UI'da silme yerine guvenli durum degisikligi sunulsun.
  const onToggleActive = async (partnership: AdminPartnership) => {
    const nextActive = !partnership.is_active;
    setBusyByUid((prev) => ({ ...prev, [partnership.uid]: true }));
    setMessage({
      ok: true,
      text: nextActive
        ? at('admin.partnerships.activating', 'Activating partnership...', 'Активація партнерства...')
        : at('admin.partnerships.deactivating', 'Deactivating partnership...', 'Деактивація партнерства...'),
    });
    try {
      await updateAdminPartnership(partnership.uid, { is_active: nextActive });
      const nextPartnership = applyPartnershipPayload(partnership, { is_active: nextActive });
      setPartnerships((prev) => prev.map((item) => (item.uid === partnership.uid ? nextPartnership : item)));
      setMessage({
        ok: true,
        text: nextActive
          ? at('admin.partnerships.activated', 'Partnership activated.', 'Партнерство активовано.')
          : at('admin.partnerships.deactivated', 'Partnership deactivated.', 'Партнерство деактивовано.'),
      });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : at('admin.partnerships.errors.status', 'Failed to update partnership status.', 'Не вдалося оновити статус партнерства.') });
    } finally {
      setBusyByUid((prev) => ({ ...prev, [partnership.uid]: false }));
    }
  };

  return (
    <div className="admin-layout">
      <V2Header />
      <div className="admin-container">
        <AdminPageHeader
          breadcrumbs={[{ label: at('admin.nav.admin', 'Admin', 'Адмін') }, { label: at('admin.partnerships.title', 'Partnerships', 'Партнерства') }]}
          title={at('admin.partnerships.title', 'Partnerships', 'Партнерства')}
          actions={
            <>
              <Link to="/admin/promos" className="admin-page-header-link">
                <i className="fa-solid fa-ticket" />
                {at('admin.nav.promos', 'Promos', 'Промокоди')}
              </Link>
              <Link to="/admin/orders" className="admin-page-header-link">
                <i className="fa-solid fa-receipt" />
                {at('admin.nav.viewOrders', 'View Orders', 'Переглянути замовлення')}
              </Link>
            </>
          }
        />

        <section className="admin-panel-card">
          <h2 className="admin-panel-title">{at('admin.partnerships.createTitle', 'Create Partnership', 'Створити партнерство')}</h2>
          <form className="admin-panel-form admin-promo-form" onSubmit={onCreate}>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.common.name', 'Name', 'Ім\'я')}</label>
              <input name="name" className="admin-control-input" placeholder="Іван" disabled={saving} />
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.common.surname', 'Surname', 'Прізвище')}</label>
              <input name="surname" className="admin-control-input" placeholder="Петренко" disabled={saving} />
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.common.company', 'Company', 'Компанія')}</label>
              <input name="company_name" className="admin-control-input" placeholder="ТОВ ABC" disabled={saving} />
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.common.phone', 'Phone', 'Телефон')}</label>
              <input name="phone" className="admin-control-input" placeholder="+380..." disabled={saving} />
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.common.email', 'Email', 'Email')}</label>
              <input name="email" type="email" className="admin-control-input" placeholder="ivan@example.com" disabled={saving} />
            </div>
            <button type="submit" className="admin-save-btn" disabled={saving}>
              {saving ? at('admin.common.creating', 'Creating...', 'Створення...') : at('admin.common.create', 'Create', 'Створити')}
            </button>
          </form>
          {message && <p className={message.ok ? 'admin-panel-message-ok' : 'admin-panel-message-error'}>{message.text}</p>}
        </section>

        {loading && <div className="admin-empty">{at('admin.partnerships.loading', 'Loading partnerships...', 'Завантаження партнерств...')}</div>}
        {!loading && partnerships.length === 0 && <div className="admin-empty">{at('admin.partnerships.empty', 'No partnerships yet.', 'Партнерств ще немає.')}</div>}

        {!loading && partnerships.length > 0 && (
          <div className="admin-panel-list">
            {partnerships.map((partnership) => {
              const busy = !!busyByUid[partnership.uid];
              return (
                <article key={partnership.uid} className="admin-panel-row admin-promo-row">
                  <form className="admin-promo-edit-form" onSubmit={(event) => onUpdate(event, partnership)}>
                    <div className="admin-control-group">
                      <label className="admin-control-label">{at('admin.common.name', 'Name', 'Ім\'я')}</label>
                      <input name="name" className="admin-control-input" defaultValue={partnership.name} disabled={busy} />
                    </div>
                    <div className="admin-control-group">
                      <label className="admin-control-label">{at('admin.common.surname', 'Surname', 'Прізвище')}</label>
                      <input name="surname" className="admin-control-input" defaultValue={partnership.surname} disabled={busy} />
                    </div>
                    <div className="admin-control-group">
                      <label className="admin-control-label">{at('admin.common.company', 'Company', 'Компанія')}</label>
                      <input name="company_name" className="admin-control-input" defaultValue={partnership.company_name ?? ''} disabled={busy} />
                    </div>
                    <div className="admin-control-group">
                      <label className="admin-control-label">{at('admin.common.phone', 'Phone', 'Телефон')}</label>
                      <input name="phone" className="admin-control-input" defaultValue={partnership.phone ?? ''} disabled={busy} />
                    </div>
                    <div className="admin-control-group">
                      <label className="admin-control-label">{at('admin.common.email', 'Email', 'Email')}</label>
                      <input name="email" type="email" className="admin-control-input" defaultValue={partnership.email ?? ''} disabled={busy} />
                    </div>
                    <div className="admin-promo-meta">
                      <span className={`admin-status-badge ${partnership.is_active ? 'fulfilled' : 'cancelled'}`}>
                        {partnership.is_active ? at('admin.common.active', 'Active', 'Активний') : at('admin.common.inactive', 'Inactive', 'Неактивний')}
                      </span>
                      <span>{partnership.company_name || at('admin.common.noCompany', 'No company', 'Без компанії')}</span>
                      <span>{at('admin.common.email', 'Email', 'Email')}: {partnership.email || '-'}</span>
                      <span>{at('admin.common.phone', 'Phone', 'Телефон')}: {partnership.phone || '-'}</span>
                      <span>{at('admin.common.created', 'Created', 'Створено')}: {formatDate(partnership.created_at)}</span>
                    </div>
                    <PartnershipMetricsInline metrics={partnership.metrics} />
                    <div className="admin-promo-actions">
                      <button type="submit" className="admin-save-btn" disabled={busy}>
                        {busy ? at('admin.common.saving', 'Saving...', 'Збереження...') : at('admin.common.save', 'Save', 'Зберегти')}
                      </button>
                      <button type="button" className="admin-promo-toggle-btn" onClick={() => onToggleActive(partnership)} disabled={busy}>
                        {partnership.is_active ? at('admin.partnerships.deactivate', 'Deactivate', 'Деактивувати') : at('admin.partnerships.activate', 'Activate', 'Активувати')}
                      </button>
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPartnerships;
