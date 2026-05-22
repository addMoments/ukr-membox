import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminPromoReport } from '../../client/promo';
import { PromoReportRow } from '../../types/promo';
import { AdminPartnership } from '../../types/partnership';
import { adminText } from '../../utils/admin_i18n';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import V2Header from '../../v2-components/V2Header';
import '../../v2-styles/AdminPageHeader.css';
import '../../v2-styles/AdminOrders.css';

// Ne: Rapor tutarlarini Ukrayna para birimi formatinda gosterir.
// Nasil: Bos/gecersiz degerleri 0 kabul edip iki ondalikli string dondurur.
// Neden: Gross, discount ve net kolonlari listede tutarli hizalansin.
function formatMoney(value: number) {
  return `₴${Number(value || 0).toFixed(2)}`;
}

// Ne: Rapor tarihlerini okunur admin formatina cevirir.
// Nasil: Bos degerde tire, dolu degerde en-GB tarih/saat formatini kullanir.
// Neden: first_used_at ve last_used_at alanlari hizli okunabilsin.
function formatDate(str?: string | null) {
  if (!str) return '-';
  return new Date(str).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Ne: Rapor filtre input'unu backend query parametresine cevirir.
// Nasil: Bos inputta undefined, dolu datetime-local inputta ISO string dondurur.
// Neden: from/to parametreleri yalnizca super admin filtre girdiyse endpoint'e eklensin.
function toIsoFilter(value: FormDataEntryValue | null): string | undefined {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return undefined;
  return new Date(raw).toISOString();
}

// Ne: Promo report satirindan ilgili siparis listesi linkini uretir.
// Nasil: Promo kodunu orders sayfasinin promo_code query parametresine URL encode ederek koyar.
// Neden: Super admin raporda gordugu promo performansindan tek tikla o promonun siparislerine gecebilsin.
function ordersLinkForPromo(promoCode: string) {
  return `/admin/orders?promo_code=${encodeURIComponent(promoCode)}`;
}

// Ne: Rapor satirindaki partnership objesi icin okunur etiket uretir.
// Nasil: Isim soyismi birlestirir, firma varsa sona ekler, bos kalirsa uid'ye duser.
// Neden: Promo report'ta partner kolonu teknik uid yerine admin'in anlayacagi metni gostersin.
function partnershipLabel(partnership: AdminPartnership) {
  const fullName = `${partnership.name} ${partnership.surname}`.trim();
  const company = partnership.company_name ? ` - ${partnership.company_name}` : '';
  return `${fullName || partnership.uid}${company}`;
}

const at = adminText;

// Ne: Super admin promo kullanim raporunu gosterir.
// Nasil: Sayfa acilisinda filtresiz, form submit'te from/to ISO query parametreleriyle report endpointini cagirir.
// Neden: Basarili odemelerden sonra promo bazinda gross, discount ve net etkisi takip edilebilsin.
function AdminPromoReport() {
  const [rows, setRows] = useState<PromoReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = (filters: { from?: string; to?: string } = {}) => {
    setLoading(true);
    getAdminPromoReport(filters)
      .then((data) => {
        setRows(data);
        setMessage(null);
      })
      .catch((err) => setMessage({ ok: false, text: err instanceof Error ? err.message : at('admin.promoReport.errors.load', 'Failed to load promo report.', 'Не вдалося завантажити звіт промокодів.') }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    load({
      from: toIsoFilter(formData.get('from')),
      to: toIsoFilter(formData.get('to')),
    });
  };

  return (
    <div className="admin-layout">
      <V2Header />
      <div className="admin-container">
        <AdminPageHeader
          breadcrumbs={[{ label: at('admin.nav.admin', 'Admin', 'Адмін') }, { label: at('admin.promoReport.title', 'Promo Report', 'Звіт промокодів') }]}
          title={at('admin.promoReport.title', 'Promo Report', 'Звіт промокодів')}
          actions={
            <>
              <Link to="/admin/promos" className="admin-page-header-link">
                <i className="fa-solid fa-ticket" />
                {at('admin.nav.managePromos', 'Manage Promos', 'Керувати промокодами')}
              </Link>
              <Link to="/admin/partnerships" className="admin-page-header-link">
                <i className="fa-solid fa-handshake" />
                {at('admin.nav.partnerships', 'Partnerships', 'Партнерства')}
              </Link>
              <Link to="/admin/orders" className="admin-page-header-link">
                <i className="fa-solid fa-receipt" />
                {at('admin.nav.viewOrders', 'View Orders', 'Переглянути замовлення')}
              </Link>
            </>
          }
        />

        <section className="admin-panel-card">
          <h2 className="admin-panel-title">{at('admin.promoReport.filters', 'Filters', 'Фільтри')}</h2>
          <form className="admin-panel-form" onSubmit={onFilter}>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.common.from', 'From', 'Від')}</label>
              <input name="from" type="datetime-local" className="admin-control-input" />
            </div>
            <div className="admin-control-group">
              <label className="admin-control-label">{at('admin.common.to', 'To', 'До')}</label>
              <input name="to" type="datetime-local" className="admin-control-input" />
            </div>
            <button type="submit" className="admin-save-btn" disabled={loading}>
              {loading ? at('admin.common.loading', 'Loading...', 'Завантаження...') : at('admin.common.apply', 'Apply', 'Застосувати')}
            </button>
          </form>
          {message && <p className={message.ok ? 'admin-panel-message-ok' : 'admin-panel-message-error'}>{message.text}</p>}
        </section>

        {loading && <div className="admin-empty">{at('admin.promoReport.loading', 'Loading promo report...', 'Завантаження звіту промокодів...')}</div>}
        {!loading && rows.length === 0 && <div className="admin-empty">{at('admin.promoReport.empty', 'No promo usage found.', 'Використань промокодів не знайдено.')}</div>}

        {!loading && rows.length > 0 && (
          <div className="admin-promo-report-list">
            {rows.map((row) => (
              <article key={row.promo_code_uid} className="admin-promo-report-row">
                <div className="admin-promo-report-code">
                  <strong>{row.promo_code}</strong>
                  <span>{row.usage_count} {row.usage_count === 1 ? at('admin.promoReport.use', 'use', 'використання') : at('admin.promoReport.uses', 'uses', 'використань')}</span>
                </div>
                <div className="admin-promo-report-partnership">
                  <span className="admin-order-account-label">{at('admin.promos.partnership', 'Partnership', 'Партнерство')}</span>
                  <strong>{row.partnership ? partnershipLabel(row.partnership) : '-'}</strong>
                </div>
                <div className="admin-promo-report-metrics">
                  <div className="admin-order-account-metric">
                    <span className="admin-order-account-label">{at('admin.promoReport.gross', 'Gross', 'Валовий')}</span>
                    <span className="admin-order-account-value">{formatMoney(row.gross_total)}</span>
                  </div>
                  <div className="admin-order-account-metric">
                    <span className="admin-order-account-label">{at('admin.promoReport.discount', 'Discount', 'Знижка')}</span>
                    <span className="admin-order-account-value">{formatMoney(row.discount_total)}</span>
                  </div>
                  <div className="admin-order-account-metric">
                    <span className="admin-order-account-label">{at('admin.promoReport.net', 'Net', 'Чистий')}</span>
                    <span className="admin-order-account-value">{formatMoney(row.net_total)}</span>
                  </div>
                </div>
                <div className="admin-promo-report-dates">
                  <span>{at('admin.promoReport.firstUsed', 'First used', 'Перше використання')}: {formatDate(row.first_used_at)}</span>
                  <span>{at('admin.promoReport.lastUsed', 'Last used', 'Останнє використання')}: {formatDate(row.last_used_at)}</span>
                  <Link to={ordersLinkForPromo(row.promo_code)} className="admin-promo-report-link">
                    {at('admin.promoReport.viewOrders', 'View orders', 'Переглянути замовлення')}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPromoReport;
