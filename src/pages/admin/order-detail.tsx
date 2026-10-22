import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetch as authFetch } from '../../client/core';
import { getAdminRole } from '../../client/admin';
import { S3_ROOT, SERV_ROOT, SITE_ROOT } from '../../consts';
import { saveUrl } from '../../utils/download';
import { adminText } from '../../utils/admin_i18n';
import AdminPageHeader from '../../v2-components/AdminPageHeader';
import V2Header from '../../v2-components/V2Header';
import { t } from '../../packages/i18n';
import { displayConfigFieldLabel, sortConfigFieldsLikeQrCard } from '../../utils/product_i18n';
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
  event_closed?: boolean;
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
  // Aktivasyon linki backend'de uretilir. Bos string = link uretilemiyor ve sebebi
  // activation_blocked_reason'da yazar (odeme onaylanmamis, basarisiz, alici e-postasi yok).
  activation_link?: string;
  activation_blocked_reason?: string;
  // Excel 2.18: siparis mevcut bir etkinligin yukseltmesiyse doludur. Bu siparisin kendi
  // etkinligi ve aktivasyon linki yoktur.
  upgrade?: {
    event_uid: string;
    event_packed_uid: string;
    event_name: string;
    paid: boolean;
    applied_at: string | null;
  };
}

const STATUS_OPTIONS = ['purchased', 'client-action', 'admin-action', 'shipped', 'fulfilled', 'cancelled'];
const CORE_PACKAGE_PRODUCT_IDS = ['standard', 'plus', 'premium'];
const at = adminText;

// Ne: Order item status value'sunu admin arayuzunde okunur label'a cevirir.
// Nasil: Select option value'su backend sabiti olarak kalir, gorunen metin adminText ile EN/UK olur.
// Neden: PATCH payload'i bozulmadan status secenekleri Ukraynaca arayuzde yerellesin.
function statusLabel(status: string) {
  const labels: Record<string, [string, string]> = {
    purchased: ['Purchased', 'Придбано'],
    'client-action': ['Client Action', 'Дія клієнта'],
    'admin-action': ['Admin Action', 'Дія адміністратора'],
    shipped: ['Shipped', 'Відправлено'],
    fulfilled: ['Fulfilled', 'Виконано'],
    cancelled: ['Cancelled', 'Скасовано'],
  };
  const [en, uk] = labels[status] || [status || '—', status || '—'];
  return at(`admin.status.${status || 'unknown'}`, en, uk);
}

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
      <div className="admin-order-account-title">{at('admin.orderDetail.paymentSummary', 'Payment Summary', 'Підсумок оплати')}</div>
      <div className="admin-order-account-grid">
        <div className="admin-order-account-metric">
          <span className="admin-order-account-label">{at('admin.partnerships.metrics.grossTotal', 'Gross Total', 'Валовий підсумок')}</span>
          <span className="admin-order-account-value">{formatPaymentAmount(summary.gross_total)}</span>
        </div>
        <div className="admin-order-account-metric">
          <span className="admin-order-account-label">{at('admin.orders.promoCode', 'Promo Code', 'Промокод')}</span>
          <span className="admin-order-account-value">{summary.promo_code_text_snapshot || '-'}</span>
        </div>
        <div className="admin-order-account-metric">
          <span className="admin-order-account-label">{at('admin.promoReport.discount', 'Discount', 'Знижка')}</span>
          <span className="admin-order-account-value">{formatPaymentAmount(summary.discount_amount)}</span>
        </div>
        <div className="admin-order-account-metric">
          <span className="admin-order-account-label">{at('admin.orderDetail.netPaid', 'Net Paid', 'Сплачено')}</span>
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
  const guestLimit = account.guest_limit === -1 ? at('admin.orderDetail.unlimited', 'Unlimited', 'Безлімітно') : String(account.guest_limit);
  const totalGuests = `${account.total_guest ?? 0} / ${guestLimit}`;
  const totalSize = typeof account.total_size_mb === 'number'
    ? `${Number(account.total_size_mb.toFixed(2)).toLocaleString('en-GB', { maximumFractionDigits: 2 })} MB`
    : '—';
  const expiration = account.storage_expiration
    ? new Date(account.storage_expiration).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="admin-order-account">
      <div className="admin-order-account-title">{at('admin.orderDetail.orderAccount', 'Order Account', 'Обліковий запис замовлення')}</div>
      <div className="admin-order-account-grid">
        <div className="admin-order-account-metric">
          <span className="admin-order-account-label">{at('admin.orderDetail.totalGuest', 'Total Guest', 'Усього гостей')}</span>
          <span className="admin-order-account-value">{totalGuests}</span>
        </div>
        <div className="admin-order-account-metric">
          <span className="admin-order-account-label">{at('admin.orderDetail.totalSize', 'Total Size', 'Загальний розмір')}</span>
          <span className="admin-order-account-value">{totalSize}</span>
        </div>
        <div className="admin-order-account-metric">
          <span className="admin-order-account-label">{at('admin.orderDetail.storageExpiration', 'Storage Expiration', 'Закінчення зберігання')}</span>
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

  const configFields = sortConfigFieldsLikeQrCard(item.product.options?.config_fields || []);
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
            <i className="fa-solid fa-print" /> {at('admin.orderDetail.printLabel', 'Print label', 'Друк етикетки')}
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
          <span>{at('admin.orderDetail.qty', 'qty', 'к-сть')}: {item.quantity}</span>
          {showFinancials && <span>₴{parseFloat(item.product.price || '0').toFixed(2)}</span>}
          <span className={`admin-item-fulfillment-badge ${item.product.fullfillment_type}`}>
            {item.product.fullfillment_type}
          </span>
        </div>

        {hasBuyerConfig && (
          <div className="admin-item-buyer-config">
            <div className="admin-item-buyer-config-title">{at('admin.orderDetail.buyerConfiguration', 'Buyer Configuration', 'Конфігурація покупця')}</div>
            {selectedDesign && (
              <div className="admin-item-buyer-config-row">
                <span className="admin-item-buyer-config-key">{at('admin.orderDetail.design', 'Design', 'Дизайн')}: </span>
                {selectedDesign.label}
              </div>
            )}
            {configFields.length > 0 ? configFields
              // footer_text bilgisini admin panel detayinda gecici olarak gizliyoruz.
              .filter(f => f.key !== 'footer_text')
              .map(f => (
              <div key={f.key} className="admin-item-buyer-config-row">
                <span className="admin-item-buyer-config-key">{displayConfigFieldLabel(f)}: </span>
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
              <label className="admin-control-label">{at('admin.orderDetail.status', 'Status', 'Статус')}</label>
              <select className="admin-control-select" value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>

            {showTracking && (
              <>
                <div className="admin-control-group">
                  <label className="admin-control-label">{at('admin.orderDetail.carrier', 'Carrier', 'Перевізник')}</label>
                  <input
                    className="admin-control-input"
                    value={carrier}
                    onChange={e => setCarrier(e.target.value)}
                    placeholder="e.g. nova_poshta, DHL"
                  />
                </div>
                <div className="admin-control-group">
                  <label className="admin-control-label">{at('admin.orderDetail.trackingNumber', 'Tracking Number', 'Номер відстеження')}</label>
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
              <label className="admin-control-label">{at('admin.orderDetail.adminNote', 'Admin Note', 'Нотатка адміна')}</label>
              <textarea
                className="admin-control-textarea"
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder={at('admin.orderDetail.internalNotes', 'Internal notes...', 'Внутрішні нотатки...')}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button className="admin-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? at('admin.common.saving', 'Saving...', 'Збереження...') : at('admin.common.save', 'Save', 'Зберегти')}
              </button>
              {saved && <span className="admin-save-success">✓ {at('admin.orderDetail.saved', 'Saved', 'Збережено')}</span>}
            </div>
          </>
        ) : (
          <>
            <div className="admin-readonly-group">
              <span className="admin-control-label">{at('admin.orderDetail.status', 'Status', 'Статус')}</span>
              <span className="admin-readonly-value">{statusLabel(item.status)}</span>
            </div>
            <div className="admin-readonly-group">
              <span className="admin-control-label">{at('admin.orderDetail.carrier', 'Carrier', 'Перевізник')}</span>
              <span className="admin-readonly-value">{item.carrier || '—'}</span>
            </div>
            <div className="admin-readonly-group">
              <span className="admin-control-label">{at('admin.orderDetail.trackingNumber', 'Tracking Number', 'Номер відстеження')}</span>
              <span className="admin-readonly-value">{item.tracking_number || '—'}</span>
              {renderTrackingLinks(item.carrier, item.tracking_number)}
            </div>
            {item.note && (
              <div className="admin-readonly-group">
                <span className="admin-control-label">{at('admin.orderDetail.note', 'Note', 'Нотатка')}</span>
                <span className="admin-readonly-value">{item.note}</span>
              </div>
            )}
            {item.admin_note && (
              <div className="admin-readonly-group">
                <span className="admin-control-label">{at('admin.orderDetail.adminNote', 'Admin Note', 'Нотатка адміна')}</span>
                <span className="admin-readonly-value">{item.admin_note}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Ne: Siparisin aktivasyon (signup) mailini yeniden gonderen kart.
// Nasil: Admin ucuna POST atar, sonucu satir ici bir mesajla gosterir.
// Neden: Mail alicinin tarafinda kaybolabiliyor; destegin elinde baska bir yol yoktu.
// Ne: Yukseltme siparisinin durumu: hangi etkinlik, odendi mi, uygulandi mi. Odenmis ama
//     uygulanamamissa (odeme donusunde hata) "Simdi uygula" yukseltmeyi uygular.
// Neden: Yukseltme siparisinde aktivasyon linki ve etkinlik QR'i anlamsiz; panelin bunun yerine
//        yukseltmenin etkinlige islenip islenmedigini gostermesi gerekiyor (Excel 2.18).
function UpgradeCard({
  purchaseUid,
  upgrade,
  onApplied,
}: {
  purchaseUid: string;
  upgrade: NonNullable<OrderDetail['upgrade']>;
  onApplied: () => void;
}) {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  const apply = async () => {
    setApplying(true);
    setError('');
    try {
      const res = await authFetch(`${SERV_ROOT}/api/admin/orders/${purchaseUid}/apply-upgrade`, { method: 'POST' });
      if (!res.ok) {
        setError((await res.text()).trim() || at('admin.orderDetail.upgradeApplyFailed', 'Could not apply the upgrade', 'Не вдалося застосувати покращення'));
        return;
      }
      onApplied();
    } catch {
      setError(at('admin.orderDetail.upgradeApplyFailed', 'Could not apply the upgrade', 'Не вдалося застосувати покращення'));
    } finally {
      setApplying(false);
    }
  };

  let state: string;
  if (upgrade.applied_at) {
    state = at('admin.orderDetail.upgradeApplied', 'Applied to the event on {{date}}.', 'Застосовано до події {{date}}.', {
      date: new Date(upgrade.applied_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    });
  } else if (upgrade.paid) {
    state = at('admin.orderDetail.upgradePaidNotApplied', 'Paid, but not applied to the event yet.', 'Оплачено, але ще не застосовано до події.');
  } else {
    state = at('admin.orderDetail.upgradeNotPaid', 'Payment has not been confirmed.', 'Оплату не підтверджено.');
  }

  return (
    <div className="admin-resend-activation">
      <div className="admin-resend-activation-text">
        <h3 className="admin-resend-activation-title">
          {at('admin.orderDetail.upgradeTitle', 'Upgrade of an existing event', 'Покращення наявної події')}
        </h3>
        <p className="admin-resend-activation-hint">
          {upgrade.event_name || at('admin.orderDetail.untitledEvent', 'Untitled event', 'Подія без назви')} · {upgrade.event_packed_uid}
        </p>
        <p className={upgrade.paid && !upgrade.applied_at ? 'admin-resend-activation-err' : 'admin-resend-activation-hint'}>{state}</p>
        {error && <p className="admin-resend-activation-err">{error}</p>}
      </div>
      {upgrade.paid && !upgrade.applied_at && (
        <button type="button" className="admin-save-btn" onClick={apply} disabled={applying}>
          {applying
            ? at('admin.orderDetail.upgradeApplying', 'Applying…', 'Застосування…')
            : at('admin.orderDetail.upgradeApply', 'Apply now', 'Застосувати зараз')}
        </button>
      )}
    </div>
  );
}

function ResendActivationCard({
  purchaseUid,
  buyerEmail,
  activationLink,
  blockedReason,
}: {
  purchaseUid: string;
  buyerEmail: string;
  activationLink: string;
  blockedReason: string;
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, copyLink] = useCopyText(activationLink);

  const resend = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await authFetch(`${SERV_ROOT}/api/admin/orders/${purchaseUid}/resend-activation`, { method: 'POST' });
      if (!res.ok) {
        // Backend kisa ve okunabilir bir sebep donduruyor (odeme onaylanmadi, mail yok, vb).
        const reason = (await res.text()).trim();
        setResult({ ok: false, text: reason || at('admin.orderDetail.resendFailed', 'Could not send', 'Не вдалося надіслати') });
        return;
      }
      setResult({
        ok: true,
        text: at('admin.orderDetail.resendSent', 'Sent to', 'Надіслано на') + ' ' + buyerEmail,
      });
    } catch {
      setResult({ ok: false, text: at('admin.orderDetail.resendFailed', 'Could not send', 'Не вдалося надіслати') });
    } finally {
      setSending(false);
    }
  };

  // Link uretilemiyorsa buton hic cizilmez, yalnizca sebep yazilir. Onceki hali butonu
  // her sipariste gosteriyordu; odemesi tamamlanmamis bir siparis icin basildiginda
  // sunucu 409 donuyordu. Musteri bunu bildirdi: "Resend is available although there is
  // no purchase".
  if (!activationLink) {
    return (
      <div className="admin-resend-activation">
        <div className="admin-resend-activation-text">
          <div className="admin-order-account-title">
            {at('admin.orderDetail.resendTitle', 'Activation email', 'Лист активації')}
          </div>
          <p className="admin-resend-activation-hint">
            {at(
              'admin.orderDetail.resendUnavailable',
              'There is no activation link for this order yet.',
              'Для цього замовлення ще немає посилання для активації.',
            )}
            {blockedReason ? ` (${blockedReason})` : ''}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-resend-activation">
      <div className="admin-resend-activation-text">
        <div className="admin-order-account-title">
          {at('admin.orderDetail.resendTitle', 'Activation email', 'Лист активації')}
        </div>
        <p className="admin-resend-activation-hint">
          {at(
            'admin.orderDetail.resendHint',
            'Sends the account setup link to the buyer again. Use it when the original email never arrived.',
            'Повторно надсилає покупцю посилання для створення облікового запису. Скористайтеся, якщо початковий лист не надійшов.',
          )}
        </p>

        {/* Linkin kendisi: mail hic ulasmadiginda destek elemani linki ekrandan okuyup
            musteriye verebilsin. Bu ekrandaki QR artik etkinligin kendi QR'i (EventQrCard);
            musteri 14 Ekim'de giris linkinin QR'ini "etkinlik kodu degil" diye bildirdi. */}
        <div className="admin-activation-link-row">
          <code className="admin-activation-link">{activationLink}</code>
          <button type="button" className="admin-activation-copy-btn" onClick={copyLink}>
            {copied
              ? at('admin.orderDetail.linkCopied', 'Copied', 'Скопійовано')
              : at('admin.orderDetail.linkCopy', 'Copy link', 'Копіювати')}
          </button>
        </div>

        {result && (
          <p className={result.ok ? 'admin-resend-activation-ok' : 'admin-resend-activation-err'}>{result.text}</p>
        )}
      </div>

      <div className="admin-activation-actions">
        <button type="button" className="admin-save-btn" onClick={resend} disabled={sending || !purchaseUid}>
          {sending
            ? at('admin.orderDetail.resendSending', 'Sending…', 'Надсилання…')
            : at('admin.orderDetail.resend', 'Resend', 'Надіслати ще раз')}
        </button>
      </div>
    </div>
  );
}

// Panoya kopyalar; clipboard API'si yoksa (http, eski Safari) gecici textarea. 2 sn "kopyalandi" durumu.
function useCopyText(text: string): [boolean, () => Promise<void>] {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return [copied, copy];
}

// Ne: Siparise bagli etkinligin QR kodu: misafirlerin okuttugu, QR kartlara basilan kod.
// Nasil: Hostun QR sayfasindan indirdigi dosyanin aynisi (S3 /events/<packed>/qr.png, hostun
//        renk/logo ayarlariyla) ve misafir linki (/l/q<packed>). Etkinlik yoksa ya da kapaliysa
//        sebep yazilir.
// Neden: Excel 2.2, musteri 14 Ekim: "QR code is not event code. QR code is sign-in code for client."
//        Bu ekrandaki eski QR musterinin giris linkini kodluyordu; baski ve destek icin gereken etkinlik QR'i.
function EventQrCard({ account, hasActivationLink }: { account: OrderAccount | null; hasActivationLink: boolean }) {
  const packed = account?.event_packed_uid || '';
  const guestLink = packed ? `${SITE_ROOT}/l/q${packed}` : '';
  const [copied, copyLink] = useCopyText(guestLink);
  const [qrFailed, setQrFailed] = useState(false);
  // Host QR'i yeniden olusturdugunda dosya adi ayni kalir; tarayici eskisini gostermesin.
  const [stamp] = useState(() => Date.now());
  const qrUrl = packed ? `${S3_ROOT}/events/${packed}/qr.png?t=${stamp}` : '';

  const title = at('admin.orderDetail.eventQrTitle', 'Event QR code', 'QR-код події');
  let note = '';
  if (!packed) {
    note = hasActivationLink
      ? at('admin.orderDetail.eventQrNotYet', 'The client has not created the event yet. Its QR code appears here once they set up their account with the activation link above.', 'Клієнт ще не створив подію. QR-код з’явиться тут, щойно клієнт створить обліковий запис за посиланням для активації вище.')
      : at('admin.orderDetail.eventQrNone', 'There is no event for this order yet.', 'Для цього замовлення ще немає події.');
  } else if (account?.event_closed) {
    note = at('admin.orderDetail.eventQrClosed', 'This event is closed, so its QR code now opens a "this event is closed" page.', 'Цю подію закрито, тож її QR-код тепер відкриває сторінку «Подію закрито».');
  }

  return (
    <div className="admin-resend-activation admin-event-qr">
      <div className="admin-resend-activation-text">
        <div className="admin-order-account-title">{title}</div>
        {note ? (
          <p className="admin-resend-activation-hint">{note}</p>
        ) : (
          <>
            <p className="admin-resend-activation-hint">
              {at(
                'admin.orderDetail.eventQrHint',
                'The code guests scan to open the event: the same file the client downloads from their QR page, with their colours and logo. Use it for printed QR cards and the welcome board.',
                'Код, який гості сканують, щоб відкрити подію: той самий файл, що клієнт завантажує на своїй сторінці QR, з його кольорами та логотипом. Використовуйте його для друку QR-карток і вітального банера.',
              )}
            </p>
            <div className="admin-activation-link-row">
              <code className="admin-activation-link">{guestLink}</code>
              <button type="button" className="admin-activation-copy-btn" onClick={copyLink}>
                {copied
                  ? at('admin.orderDetail.linkCopied', 'Copied', 'Скопійовано')
                  : at('admin.orderDetail.linkCopy', 'Copy link', 'Копіювати')}
              </button>
            </div>
            {qrFailed && (
              <p className="admin-resend-activation-err">
                {at('admin.orderDetail.eventQrMissing', 'The QR image could not be loaded. The client can regenerate it on their QR page.', 'Не вдалося завантажити зображення QR. Клієнт може створити його знову на своїй сторінці QR.')}
              </p>
            )}
          </>
        )}
      </div>

      {!note && !qrFailed && (
        <div className="admin-activation-actions">
          <img
            className="admin-activation-qr"
            src={qrUrl}
            alt={title}
            onError={() => setQrFailed(true)}
          />
          <button
            type="button"
            className="admin-save-btn"
            onClick={() => { saveUrl(qrUrl, `qr-${packed}.png`).catch(() => window.open(qrUrl, '_blank')); }}
          >
            {at('admin.orderDetail.eventQrDownload', 'Download PNG', 'Завантажити PNG')}
          </button>
        </div>
      )}
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
          breadcrumbs={[{ label: at('admin.orders.title', 'Orders', 'Замовлення'), to: '/admin/orders' }, { label: `${at('admin.orderDetail.order', 'Order', 'Замовлення')} #${uid?.slice(0, 8)}` }]}
          title={`${at('admin.orderDetail.order', 'Order', 'Замовлення')} #${uid?.slice(0, 8)}`}
        />

        {loading && <div className="admin-empty">{at('admin.common.loading', 'Loading...', 'Завантаження...')}</div>}

        {!loading && !order && <div className="admin-empty">{at('admin.orderDetail.notFound', 'Order not found.', 'Замовлення не знайдено.')}</div>}

        {order && (
          <>
            <div className="admin-order-meta">
              <div className="admin-order-meta-item">
                <span className="admin-order-meta-label">{at('admin.orderDetail.buyerEmail', 'Buyer Email', 'Email покупця')}</span>
                <span className="admin-order-meta-value">{order.buyer_email || '—'}</span>
              </div>
              {order.buyer_name && (
                <div className="admin-order-meta-item">
                  <span className="admin-order-meta-label">{at('admin.common.name', 'Name', 'Ім\'я')}</span>
                  <span className="admin-order-meta-value">{order.buyer_name}</span>
                </div>
              )}
              <div className="admin-order-meta-item">
                <span className="admin-order-meta-label">{at('admin.orderDetail.date', 'Date', 'Дата')}</span>
                <span className="admin-order-meta-value">{formatDate(order.created_at)}</span>
              </div>
              <div className="admin-order-meta-item">
                <span className="admin-order-meta-label">{at('admin.orderDetail.provider', 'Provider', 'Провайдер')}</span>
                <span className="admin-order-meta-value">{order.provider}</span>
              </div>
              {order.shipping_address && (
                <div className="admin-order-meta-item">
                  <span className="admin-order-meta-label">{at('admin.orderDetail.shippingAddress', 'Shipping Address', 'Адреса доставки')}</span>
                  <span className="admin-order-meta-value">
                    {order.shipping_address.full_name} · {order.shipping_address.phone}<br />
                    {order.shipping_address.city_name} — {order.shipping_address.warehouse_name}
                  </span>
                </div>
              )}
            </div>

            {order.upgrade ? (
              <UpgradeCard purchaseUid={uid || ''} upgrade={order.upgrade} onApplied={load} />
            ) : (
              <>
                <ResendActivationCard
                  purchaseUid={uid || ''}
                  buyerEmail={order.buyer_email}
                  activationLink={order.activation_link || ''}
                  blockedReason={order.activation_blocked_reason || ''}
                />

                <EventQrCard account={order.order_account} hasActivationLink={!!order.activation_link} />
              </>
            )}

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
