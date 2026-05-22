import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetch as authFetch } from '../../client/core';
import { getAdminRole } from '../../client/admin';
import { SERV_ROOT } from '../../consts';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import V2Header from '../../v2-components/V2Header';
import '../../v2-styles/AdminPageHeader.css';
import '../../v2-styles/AdminOrders.css';

interface OrderSummary {
  uid: string;
  created_at: string;
  buyer_email: string;
  buyer_name: string;
  items_count: string;
  total?: string;
  gross_total?: string;
  discount_amount?: string;
  net_total?: string;
  promo_code_uid?: string | null;
  promo_code_text_snapshot?: string | null;
  worst_status: string;
}

interface OrderFilters {
  promoCode: string;
  from: string;
  to: string;
}

// Ne: Siparis durumunu badge CSS class'ina cevirir.
// Nasil: Bilinen status degerlerini aynen kullanir, bilinmeyenleri default'a dusurur.
// Neden: Backend yeni veya bos status dondurse bile UI kirilmasin.
function statusClass(status: string) {
  const known = ['purchased', 'client-action', 'admin-action', 'shipped', 'fulfilled', 'cancelled'];
  return known.includes(status) ? status : 'default';
}

// Ne: Admin siparis listesini rol bilgisine gore render eder.
// Nasil: Orders endpointiyle birlikte admin rolunu okur; finansal alanlari sadece super admin icin gosterir.
// Neden: Order admin operasyonel siparis bilgisini gorebilsin ama fiyat/tutar bilgilerine erismesin.
function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [filters, setFilters] = useState<OrderFilters>({ promoCode: '', from: '', to: '' });
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    setFilters({
      promoCode: searchParams.get('promo_code') || '',
      from: searchParams.get('from') || '',
      to: searchParams.get('to') || '',
    });
  }, [searchParams]);

  useEffect(() => {
    getAdminRole()
      .then((role) => setIsSuperAdmin(role.is_super_admin))
      .catch(() => setIsSuperAdmin(false));

    authFetch(`${SERV_ROOT}/api/admin/orders`)
      .then(res => res.json())
      .then(data => {
        setOrders(data || []);
        setLoading(false);
      })
      .catch(err => {
        if (err.message?.includes('403') || err.message?.includes('forbidden')) {
          setDenied(true);
        }
        setLoading(false);
      });
  }, []);

  const formatDate = (str: string) => {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Ne: Siparis listesinde gosterilecek odeme tutarini secer.
  // Nasil: Promo destekli backend alanlarinda once net_total'i, yoksa eski total alanini kullanir.
  // Neden: Promo uygulanmis siparislerde listede gercek odenen tutar gorunsun, eski response'lar kirilmasin.
  const resolveOrderTotal = (order: OrderSummary) => {
    return order.net_total ?? order.total ?? '0';
  };

  // Ne: Super admin filtre formunu URL query parametrelerine yazar.
  // Nasil: Uncontrolled formdan promo_code/from/to alanlarini okur, dolu olanlari search params'e ekler.
  // Neden: Promo report'tan gelen linkler ve manuel filtreler paylasilabilir URL ile ayni kaynagi kullansin.
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    const promoCode = String(formData.get('promo_code') || '').trim();
    const from = String(formData.get('from') || '').trim();
    const to = String(formData.get('to') || '').trim();

    if (promoCode) next.set('promo_code', promoCode);
    if (from) next.set('from', from);
    if (to) next.set('to', to);

    setSearchParams(next);
  };

  // Ne: Orders filtrelerini temizler.
  // Nasil: URL search params'i bos obje ile degistirir.
  // Neden: Kullanici tek tikla tum promo/tarih filtrelerinden normal listeye donebilsin.
  const clearFilters = () => {
    setSearchParams({});
  };

  // Ne: Promo uygulanmis siparisler icin liste alt bilgisini uretir.
  // Nasil: Promo kodu doluysa gross_total ve pozitif discount_amount degerlerinden okunur metin kurar.
  // Neden: Super admin listede net odenen tutarin hangi promo ve onceki tutardan geldigini hizla gorebilsin.
  const renderPromoSummary = (order: OrderSummary) => {
    if (!order.promo_code_text_snapshot) return null;
    const grossTotal = parseFloat(order.gross_total ?? order.total ?? '0');
    const discountAmount = parseFloat(order.discount_amount ?? '0');

    return (
      <span className="admin-order-card-promo">
        Promo {order.promo_code_text_snapshot} applied · was ₴{grossTotal.toFixed(2)}
        {discountAmount > 0 ? ` · discount ₴${discountAmount.toFixed(2)}` : ''}
      </span>
    );
  };

  const hasActiveFilters = Boolean(filters.promoCode || filters.from || filters.to);

  // Ne: Orders listesini URL'den gelen promo/tarih filtrelerine gore client-side suzer.
  // Nasil: Promo kodunu case-insensitive eslestirir; from/to varsa order.created_at timestamp'ini aralikta kontrol eder.
  // Neden: Backend filtre endpointi olmadan promo bazli satis listesi mevcut response alanlariyla gorulebilsin.
  const filteredOrders = orders.filter((order) => {
    if (filters.promoCode) {
      const orderPromo = (order.promo_code_text_snapshot || '').toLowerCase();
      if (orderPromo !== filters.promoCode.toLowerCase()) return false;
    }

    const createdAt = order.created_at ? new Date(order.created_at).getTime() : 0;
    if (filters.from && createdAt < new Date(filters.from).getTime()) return false;
    if (filters.to && createdAt > new Date(filters.to).getTime()) return false;

    return true;
  });

  return (
    <div className="admin-layout">
      <V2Header />
      <div className="admin-container" data-has-order-filters={hasActiveFilters ? 'true' : 'false'}>
        <AdminPageHeader
          breadcrumbs={[{ label: 'Admin' }, { label: 'Orders' }]}
          title="Orders"
          actions={
            isSuperAdmin ? (
              <>
                <Link to="/admin/products" className="admin-page-header-link">
                  <i className="fa-solid fa-boxes-stacked" />
                  Manage Products
                </Link>
                <Link to="/admin/panel-admins" className="admin-page-header-link">
                  <i className="fa-solid fa-user-shield" />
                  Panel Admins
                </Link>
                <Link to="/admin/promos" className="admin-page-header-link">
                  <i className="fa-solid fa-ticket" />
                  Promos
                </Link>
              </>
            ) : null
          }
        />

        {isSuperAdmin && (
          <section className="admin-panel-card admin-order-filter-card">
            <h2 className="admin-panel-title">Filter Orders</h2>
            <form className="admin-panel-form" onSubmit={applyFilters} key={`${filters.promoCode}-${filters.from}-${filters.to}`}>
              <div className="admin-control-group">
                <label className="admin-control-label">Promo Code</label>
                <input name="promo_code" className="admin-control-input" placeholder="SUMMER10" defaultValue={filters.promoCode} />
              </div>
              <div className="admin-control-group">
                <label className="admin-control-label">From</label>
                <input name="from" type="datetime-local" className="admin-control-input" defaultValue={filters.from} />
              </div>
              <div className="admin-control-group">
                <label className="admin-control-label">To</label>
                <input name="to" type="datetime-local" className="admin-control-input" defaultValue={filters.to} />
              </div>
              <button type="submit" className="admin-save-btn">Apply</button>
              {hasActiveFilters && (
                <button type="button" className="admin-order-filter-clear" onClick={clearFilters}>
                  Clear
                </button>
              )}
            </form>
          </section>
        )}

        {loading && <div className="admin-empty">Loading...</div>}

        {denied && (
          <div className="admin-empty">Access denied. You are not a super-admin.</div>
        )}

        {!loading && !denied && orders.length === 0 && (
          <div className="admin-empty">No orders yet.</div>
        )}

        {!loading && !denied && orders.length > 0 && filteredOrders.length === 0 && (
          <div className="admin-empty">
            {hasActiveFilters ? 'No orders found for these filters.' : 'No orders yet.'}
          </div>
        )}

        {!loading && !denied && filteredOrders.length > 0 && (
          <div className="admin-orders-list">
            {filteredOrders.map(order => (
              <Link key={order.uid} to={`/admin/orders/${order.uid}`} className="admin-order-card">
                <div className="admin-order-card-top">
                  <div className="admin-order-card-buyer">
                    <span className="admin-orders-email">{order.buyer_email || '—'}</span>
                    {order.buyer_name && <span className="admin-order-card-name">{order.buyer_name}</span>}
                  </div>
                  <span className={`admin-status-badge ${statusClass(order.worst_status)}`}>
                    {order.worst_status || '—'}
                  </span>
                </div>
                <div className="admin-order-card-bottom">
                  <span className="admin-order-card-meta">{formatDate(order.created_at)}</span>
                  <span className="admin-order-card-meta">{order.items_count} item{order.items_count !== '1' ? 's' : ''}</span>
                  {isSuperAdmin && (
                    <span className="admin-order-card-total">₴{parseFloat(resolveOrderTotal(order)).toFixed(2)}</span>
                  )}
                </div>
                {isSuperAdmin && renderPromoSummary(order)}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminOrders;
