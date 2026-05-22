import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetch as authFetch } from '../../client/core';
import { getAdminRole } from '../../client/admin';
import { SERV_ROOT } from '../../consts';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import V2Header from '../../v2-components/V2Header';
import { t } from '../../packages/i18n';
import '../../v2-styles/AdminPageHeader.css';
import '../../v2-styles/AdminOrders.css';

interface ProductOptions {
  image?: string;
  icon?: string;
  designs?: { id: string; label: string; image: string }[];
  config_fields?: { key: string; label: string }[];
}

interface OrderItem {
  uid: string;
  cart_uid: string;
  quantity: string;
  status: string;
  note: string;
  admin_note: string;
  tracking_number: string;
  carrier: string;
  np_waybill_ref: string;
  buyer_config: Record<string, any>;
  shipped_at: string;
  fulfilled_at: string;
  created_at: string;
  product: {
    id: string;
    price?: string;
    display_name_en?: string;
    display_name_uk?: string;
    options: ProductOptions;
    fullfillment_type: string;
  };
}

interface OrderAccount {
  event_uid: string;
  event_packed_uid: string;
  total_guest: number;
  guest_limit: number;
  total_size_mb: number | null;
  storage_expiration: string | null;
}

interface ShippingAddress {
  full_name: string;
  phone: string;
  city_name: string;
  city_ref: string;
  warehouse_name: string;
  warehouse_ref: string;
}

interface PaymentSummary {
  gross_total: string;
  discount_amount: string;
  net_total: string;
  promo_code_uid: string | null;
  promo_code_text_snapshot: string | null;
}

interface OrderDetail {
  uid: string;
  created_at: string;
  buyer_email: string;
  buyer_name: string;
  provider: string;
  shipping_address?: ShippingAddress;
  payment_summary?: PaymentSummary;
  items: OrderItem[];
  order_account: OrderAccount | null;
}

const STATUS_OPTIONS = ['purchased', 'client-action', 'admin-action', 'shipped', 'fulfilled', 'cancelled'];
const CORE_PACKAGE_PRODUCT_IDS = ['standard', 'plus', 'premium'];

interface OrderAccountMetricsProps {
  account: OrderAccount;
}

interface PaymentSummaryCardProps {
  summary: PaymentSummary;
}

// Ne: Payment summary tutarlarini admin detay ekraninda para formatina cevirir.
// Nasil: Backend string/number benzeri degeri parseFloat ile okur, gecersizse 0 kabul eder.
// Neden: Gross, discount ve net paid alanlari tek formatta gorunsun.
function formatPaymentAmount(value: string) {
  return `₴${parseFloat(value || '0').toFixed(2)}`;
}

// Ne: Super admin icin promo destekli odeme ozetini gosterir.
// Nasil: Backend payment_summary alanindan gross, promo code, discount ve net paid metriklerini kart olarak render eder.
// Neden: Siparis detayinda hangi promo ile onceki tutardan ne kadar dusuldugu acik gorunsun.
function PaymentSummaryCard({ summary }: PaymentSummaryCardProps) {
  return (
    <div className="admin-payment-summary">
      <div className="admin-order-account-title">Payment Summary</div>
      <div className="admin-order-account-grid">
        <div className="admin-order-account-metric">
          <span className="admin-order-account-label">Gross Total</span>
          <span className="admin-order-account-value">{formatPaymentAmount(summary.gross_total)}</span>
        </div>
        <div className="admin-order-account-metric">
          <span className="admin-order-account-label">Promo Code</span>
          <span className="admin-order-account-value">{summary.promo_code_text_snapshot || '-'}</span>
        </div>
        <div className="admin-order-account-metric">
          <span className="admin-order-account-label">Discount</span>
          <span className="admin-order-account-value">{formatPaymentAmount(summary.discount_amount)}</span>
        </div>
        <div className="admin-order-account-metric">
          <span className="admin-order-account-label">Net Paid</span>
          <span className="admin-order-account-value">{formatPaymentAmount(summary.net_total)}</span>
        </div>
      </div>
    </div>
  );
}

// Ne: Order/event bazli hesap kullanim metriklerini admin order detayinda gosterir.
// Nasil: Guest limit, toplam storage ve expiration tarihini backend order_account alanindan formatlayarak kart/pill olarak render eder.
// Neden: Bu bilgiler finansal degil; super admin olmayan order admin de siparisin event hesabini operasyonel olarak gorebilsin.
function OrderAccountMetrics({ account }: OrderAccountMetricsProps) {
  const guestLimit = account.guest_limit === -1 ? 'Unlimited' : String(account.guest_limit);
  const totalGuests = `${account.total_guest ?? 0} / ${guestLimit}`;
  const totalSize = typeof account.total_size_mb === 'number'
    ? `${Number(account.total_size_mb.toFixed(2)).toLocaleString('en-GB', { maximumFractionDigits: 2 })} MB`
    : '—';
  const expiration = account.storage_expiration
    ? new Date(account.storage_expiration).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="admin-order-account">
      <div className="admin-order-account-title">Order Account</div>
      <div className="admin-order-account-grid">
        <div className="admin-order-account-metric">
          <span className="admin-order-account-label">Total Guest</span>
          <span className="admin-order-account-value">{totalGuests}</span>
        </div>
        <div className="admin-order-account-metric">
          <span className="admin-order-account-label">Total Size</span>
          <span className="admin-order-account-value">{totalSize}</span>
        </div>
        <div className="admin-order-account-metric">
          <span className="admin-order-account-label">Storage Expiration</span>
          <span className="admin-order-account-value">{expiration}</span>
        </div>
      </div>
    </div>
  );
}

interface ItemCardProps {
  item: OrderItem;
  orderAccount?: OrderAccount | null;
  showFinancials: boolean;
  canEditItems: boolean;
  onSaved: () => void;
}

// Ne: Siparis kaleminin operasyonel detaylarini ve guncelleme kontrollerini gosterir.
// Nasil: Fiyat alanini sadece showFinancials true ise render eder; canEditItems false ise operasyonel alanlari read-only gosterir.
// Neden: Order admin siparis bilgisini gorebilsin ama backend'in yasakladigi item update PATCH aksiyonunu UI'dan tetikleyemesin.
function ItemCard({ item, orderAccount, showFinancials, canEditItems, onSaved }: ItemCardProps) {
  const [status, setStatus] = useState(item.status);
  const [tracking, setTracking] = useState(item.tracking_number || '');
  const [carrier, setCarrier] = useState(item.carrier || '');
  const [adminNote, setAdminNote] = useState(item.admin_note || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Ne: Admin order detayinda gorunecek urun adini belirler.
  // Nasil: Backend display_name alanlarini aktif dile gore once kullanir; yoksa eski translation/id fallback'ine duser.
  // Neden: Admin products ekranindan guncellenen paket adlari order detayinda eski dil dosyasi degerlerine takilmasin.
  const resolveProductName = () => {
    const display = t('products.' + item.product.id, { returnObjects: true }) as { name?: string };
    const isUk = t('lang_code') === 'uk';
    return (
      isUk
        ? (item.product.display_name_uk || item.product.display_name_en || display?.name || item.product.id)
        : (item.product.display_name_en || item.product.display_name_uk || display?.name || item.product.id)
    );
  };
  const productName = resolveProductName();
  const showTracking = status === 'admin-action' || status === 'shipped' || status === 'fulfilled';

  const configFields = item.product.options?.config_fields || [];
  const designs = item.product.options?.designs || [];
  const hasBuyerConfig = Object.keys(item.buyer_config || {}).length > 0;

  const selectedDesignId = item.buyer_config?.design_id;
  const selectedDesign = designs.find(d => d.id === selectedDesignId);
  const previewImage = selectedDesign?.image || item.product.options?.image;
  const renderTrackingLinks = (currentCarrier: string, currentTracking: string) => (
    currentCarrier === 'nova_poshta' && currentTracking ? (
      <div className="admin-np-actions">
        <a
          className="admin-np-track-link"
          href={`https://novaposhta.ua/tracking/?cargo=${currentTracking}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <i className="fa-solid fa-magnifying-glass" /> Track shipment
        </a>
        {item.np_waybill_ref && (
          <a
            className="admin-np-print-link"
            href={`https://my.novaposhta.ua/orders/printDocument/orders[]/${item.np_waybill_ref}/type/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className="fa-solid fa-print" /> Print label
          </a>
        )}
      </div>
    ) : null
  );

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await authFetch(`${SERV_ROOT}/api/admin/orders/items/${item.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, tracking_number: tracking, carrier, admin_note: adminNote }),
      });
      setSaved(true);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-item-card">
      <div className="admin-item-image">
        {previewImage ? (
          <img src={previewImage} alt={productName} />
        ) : (
          <i className={item.product.options?.icon || 'fa-solid fa-box'} />
        )}
      </div>

      <div className="admin-item-info">
        <div className="admin-item-name">{productName}</div>
        <div className="admin-item-meta">
          <span>qty: {item.quantity}</span>
          {showFinancials && <span>₴{parseFloat(item.product.price || '0').toFixed(2)}</span>}
          <span className={`admin-item-fulfillment-badge ${item.product.fullfillment_type}`}>
            {item.product.fullfillment_type}
          </span>
        </div>

        {hasBuyerConfig && (
          <div className="admin-item-buyer-config">
            <div className="admin-item-buyer-config-title">Buyer Configuration</div>
            {selectedDesign && (
              <div className="admin-item-buyer-config-row">
                <span className="admin-item-buyer-config-key">Design: </span>
                {selectedDesign.label}
              </div>
            )}
            {configFields.length > 0 ? configFields
              // footer_text bilgisini admin panel detayinda gecici olarak gizliyoruz.
              .filter(f => f.key !== 'footer_text')
              .map(f => (
              <div key={f.key} className="admin-item-buyer-config-row">
                <span className="admin-item-buyer-config-key">{f.label}: </span>
                {item.buyer_config[f.key] || '—'}
              </div>
            )) : Object.entries(item.buyer_config).filter(([k]) => k !== 'design_id' && k !== 'footer_text').map(([k, v]) => (
              <div key={k} className="admin-item-buyer-config-row">
                <span className="admin-item-buyer-config-key">{k}: </span>
                {String(v)}
              </div>
            ))}
          </div>
        )}

        {orderAccount && <OrderAccountMetrics account={orderAccount} />}
      </div>

      <div className="admin-item-controls">
        {canEditItems ? (
          <>
            <div className="admin-control-group">
              <label className="admin-control-label">Status</label>
              <select className="admin-control-select" value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {showTracking && (
              <>
                <div className="admin-control-group">
                  <label className="admin-control-label">Carrier</label>
                  <input
                    className="admin-control-input"
                    value={carrier}
                    onChange={e => setCarrier(e.target.value)}
                    placeholder="e.g. nova_poshta, DHL"
                  />
                </div>
                <div className="admin-control-group">
                  <label className="admin-control-label">Tracking Number</label>
                  <input
                    className="admin-control-input"
                    value={tracking}
                    onChange={e => setTracking(e.target.value)}
                    placeholder="e.g. 20400048799000"
                  />
                  {renderTrackingLinks(carrier, tracking)}
                </div>
              </>
            )}

            <div className="admin-control-group">
              <label className="admin-control-label">Admin Note</label>
              <textarea
                className="admin-control-textarea"
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder="Internal notes..."
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button className="admin-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              {saved && <span className="admin-save-success">✓ Saved</span>}
            </div>
          </>
        ) : (
          <>
            <div className="admin-readonly-group">
              <span className="admin-control-label">Status</span>
              <span className="admin-readonly-value">{item.status || '—'}</span>
            </div>
            <div className="admin-readonly-group">
              <span className="admin-control-label">Carrier</span>
              <span className="admin-readonly-value">{item.carrier || '—'}</span>
            </div>
            <div className="admin-readonly-group">
              <span className="admin-control-label">Tracking Number</span>
              <span className="admin-readonly-value">{item.tracking_number || '—'}</span>
              {renderTrackingLinks(item.carrier, item.tracking_number)}
            </div>
            {item.note && (
              <div className="admin-readonly-group">
                <span className="admin-control-label">Note</span>
                <span className="admin-readonly-value">{item.note}</span>
              </div>
            )}
            {item.admin_note && (
              <div className="admin-readonly-group">
                <span className="admin-control-label">Admin Note</span>
                <span className="admin-readonly-value">{item.admin_note}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AdminOrderDetail() {
  const { uid } = useParams<{ uid: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Ne: Siparis detayini backend'den yeniden yukler.
  // Nasil: Detay endpointinden gelen cevabi local state'e yazar.
  // Neden: Kalem kaydedildikten sonra ekrandaki operasyonel bilgiler guncel kalsin.
  const load = useCallback(() => {
    authFetch(`${SERV_ROOT}/api/admin/orders/${uid}`)
      .then(res => res.json())
      .then(data => {
        setOrder(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [uid]);

  useEffect(() => {
    getAdminRole()
      .then((role) => setIsSuperAdmin(role.is_super_admin))
      .catch(() => setIsSuperAdmin(false));
    load();
  }, [load]);

  const formatDate = (str: string) => {
    if (!str) return '—';
    return new Date(str).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const corePackageItemUid = order?.items?.find(item => CORE_PACKAGE_PRODUCT_IDS.includes(item.product.id))?.uid;
  const shouldShowFallbackOrderAccount = !!order?.order_account && !corePackageItemUid;

  return (
    <div className="admin-layout">
      <V2Header />
      <div className="admin-container">
        <AdminPageHeader
          breadcrumbs={[{ label: 'Orders', to: '/admin/orders' }, { label: `Order #${uid?.slice(0, 8)}` }]}
          title={`Order #${uid?.slice(0, 8)}`}
        />

        {loading && <div className="admin-empty">Loading...</div>}

        {!loading && !order && <div className="admin-empty">Order not found.</div>}

        {order && (
          <>
            <div className="admin-order-meta">
              <div className="admin-order-meta-item">
                <span className="admin-order-meta-label">Buyer Email</span>
                <span className="admin-order-meta-value">{order.buyer_email || '—'}</span>
              </div>
              {order.buyer_name && (
                <div className="admin-order-meta-item">
                  <span className="admin-order-meta-label">Name</span>
                  <span className="admin-order-meta-value">{order.buyer_name}</span>
                </div>
              )}
              <div className="admin-order-meta-item">
                <span className="admin-order-meta-label">Date</span>
                <span className="admin-order-meta-value">{formatDate(order.created_at)}</span>
              </div>
              <div className="admin-order-meta-item">
                <span className="admin-order-meta-label">Provider</span>
                <span className="admin-order-meta-value">{order.provider}</span>
              </div>
              {order.shipping_address && (
                <div className="admin-order-meta-item">
                  <span className="admin-order-meta-label">Shipping Address</span>
                  <span className="admin-order-meta-value">
                    {order.shipping_address.full_name} · {order.shipping_address.phone}<br />
                    {order.shipping_address.city_name} — {order.shipping_address.warehouse_name}
                  </span>
                </div>
              )}
            </div>

            {isSuperAdmin && order.payment_summary && <PaymentSummaryCard summary={order.payment_summary} />}

            {shouldShowFallbackOrderAccount && <OrderAccountMetrics account={order.order_account!} />}

            <div className="admin-item-cards">
              {(order.items || []).map(item => (
                <ItemCard
                  key={item.uid}
                  item={item}
                  orderAccount={item.uid === corePackageItemUid ? order.order_account : null}
                  showFinancials={isSuperAdmin}
                  canEditItems={isSuperAdmin}
                  onSaved={load}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminOrderDetail;
