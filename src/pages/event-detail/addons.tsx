import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import V2Header from '../../v2-components/V2Header';
import V2Footer from '../../v2-components/V2Footer';
import ProductIcon from '../../v2-components/ProductIcon';
import {
  AddressModal,
  CartItemCard,
  ConfigField,
  Design,
  Overlay,
  ShippingAddress,
  isContactPhoneValid,
  normalizeContactPhone,
} from '../../v2-partials/V2Checkout';
import { AddonOptionsResponse, fetchAddonOptions, startAddonPayment } from '../../client/addons';
import { upgradeErrorCode } from '../../client/upgrades';
import { getQtyRule } from '../../client/cart';
import { Product } from '../../types/products';
import { t } from '../../packages/i18n';
import { textOr } from '../../utils/admin_i18n';
import { displayConfigFieldLabel } from '../../utils/product_i18n';
import { addonImages } from '../../utils/addon_images';
import { formatUah } from '../../utils/money';
import '../../v2-styles/Checkout.css';
import '../../v2-styles/EventAddons.css';

// Etkinlige sonradan ek urun (Fatih 20 Kasim 2026: "every event ... digital and physical"; Premium'un reklam
// alani zaten var, gosterilmez; free alamaz, yukseltince alabilir). Panodaki "Add-ons" kartindan gelinir.
// Secenekler sunucudan (event-addons.go: etkinlikte zaten olan dijital ekler listede yok). Secilen ekler
// checkout'taki kartla (tasarim, metin alanlari, adet) gosterilir; fiziksel urun varsa Nova Poshta adresi
// istenir. Odeme LiqPay; dogrulaninca host /event/<uid>?addons=done'a doner, ekler "Your add-ons"
// kutusunda gorunur.

const isUk = () => t('lang_code') === 'uk';
const displayName = (p: Product) => (isUk() ? p.display_name_uk || p.display_name_en : p.display_name_en || p.display_name_uk) || p.id;
const displayDescription = (p: Product) => (isUk()
  ? p.display_description_uk || p.display_description_en
  : p.display_description_en || p.display_description_uk) || '';

const errorMessage = (err: unknown) => {
  switch (upgradeErrorCode(err)) {
    case 'UPGRADE_WINDOW_CLOSED':
      return t('eventHome.upgrade.errors.windowClosed');
    case 'ADDON_NOT_OFFERED':
      return textOr('eventHome.addons.errors.notOffered', 'This add-on is no longer available for your event. Please reload the page.', 'Ця послуга більше недоступна для вашої події. Оновіть сторінку.');
    case 'ADDONS_FREE_PACKAGE':
      return textOr('eventHome.addons.errors.free', 'Add-ons are available after you upgrade your free package.', 'Додаткові послуги доступні після покращення безкоштовного пакета.');
    case 'SHIPPING_ADDRESS_REQUIRED':
      return textOr('checkout.shipping.addressRequired', 'Please add a shipping address for physical items.', 'Будь ласка, додайте адресу доставки для фізичних товарів.');
    case 'INVALID_PHONE':
      return textOr('checkout.phoneInvalid', 'Please enter a valid phone number, e.g. +380 99 123 45 67.', 'Введіть коректний номер телефону, наприклад +380 99 123 45 67.');
    default:
      return t('eventHome.upgrade.errors.generic');
  }
};

function EventAddons() {
  const { uid: packedUid = '' } = useParams<{ uid: string }>();
  const [data, setData] = useState<AddonOptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [configs, setConfigs] = useState<Record<string, Record<string, string>>>({});
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState<ShippingAddress | null>(null);
  const [showAddress, setShowAddress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = textOr('eventHome.addons.pageTitle', 'Add-ons for your event - AddMoments', 'Додаткові послуги - AddMoments');
  }, []);

  useEffect(() => {
    if (!packedUid) return;
    let cancelled = false;
    fetchAddonOptions(packedUid)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [packedUid]);

  const options = useMemo(() => data?.options || [], [data]);
  const selected = options.filter((p) => (quantities[p.id] || 0) > 0);
  const available = options.filter((p) => !(quantities[p.id] > 0));
  const hasPhysical = selected.some((p) => p.fullfillment_type === 'physical');
  const total = selected.reduce((sum, p) => sum + Number(p.price || 0) * quantities[p.id], 0);
  const eventHref = `/event/${packedUid}`;

  const add = (product: Product) => {
    setError('');
    setQuantities((prev) => ({ ...prev, [product.id]: getQtyRule(product).min }));
  };
  const remove = (id: string) => {
    setQuantities((prev) => ({ ...prev, [id]: 0 }));
  };
  const setConfig = (id: string, key: string, value: string) => {
    setConfigs((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [key]: value } }));
  };

  // Checkout'taki kurallarin aynisi (V2Checkout handleCompleteOrder): tasarim ve gorunen metin alanlari dolu olmali.
  const validate = (): string => {
    if (selected.length === 0) return textOr('eventHome.addons.choose', 'Choose at least one add-on.', 'Оберіть хоча б одну послугу.');
    if (!isContactPhoneValid(phone)) {
      return phone.trim()
        ? textOr('checkout.phoneInvalid', 'Please enter a valid phone number, e.g. +380 99 123 45 67.', 'Введіть коректний номер телефону, наприклад +380 99 123 45 67.')
        : textOr('checkout.enterPhone', 'Please enter your phone number.', 'Будь ласка, введіть номер телефону.');
    }
    if (hasPhysical && !address) {
      return textOr('checkout.shipping.addressRequired', 'Please add a shipping address for physical items.', 'Будь ласка, додайте адресу доставки для фізичних товарів.');
    }
    for (const product of selected) {
      if (product.fullfillment_type !== 'physical') continue;
      const fields: ConfigField[] = product.options?.config_fields || [];
      const designs: Design[] = product.options?.designs || [];
      const cfg = configs[product.id] || {};
      const design = designs.find((d) => d.id === (cfg.design_id || designs[0]?.id));
      const overlayKeys = new Set((design?.overlays || []).map((ov: Overlay) => ov.field_key).filter(Boolean));
      const required = (overlayKeys.size > 0 ? fields.filter((f) => overlayKeys.has(f.key)) : fields)
        .filter((f) => f.key !== 'footer_text');
      for (const field of required) {
        if (!cfg[field.key]?.trim()) {
          const name = displayName(product);
          const label = displayConfigFieldLabel(field);
          return textOr('checkout.fillField', `Please fill "${label}" for "${name}".`, `Будь ласка, заповніть «${label}» для «${name}».`, { field: label, product: name });
        }
      }
    }
    return '';
  };

  const pay = async () => {
    if (busy) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const buyerConfigs: Record<string, string> = {};
    for (const product of selected) {
      const designs: Design[] = product.options?.designs || [];
      const cfg = {
        ...(designs.length > 0 ? { design_id: configs[product.id]?.design_id || designs[0]?.id || '' } : {}),
        ...(configs[product.id] || {}),
      };
      if (Object.keys(cfg).length > 0) buyerConfigs[product.id] = JSON.stringify(cfg);
    }
    setBusy(true);
    setError('');
    try {
      await startAddonPayment(packedUid, {
        items: selected.map((p) => ({ product_id: p.id, quantity: quantities[p.id] })),
        phone: normalizeContactPhone(phone),
        buyer_configs: buyerConfigs,
        shipping_address: hasPhysical ? address : null,
      });
      // Tarayici LiqPay'e gidiyor; dugme kilitli kalir.
    } catch (err) {
      setBusy(false);
      setError(errorMessage(err));
    }
  };

  const backLink = (
    <Link to={eventHref} className="event-addons-back">
      <i className="fa-solid fa-arrow-left" />
      {textOr('eventHome.freeUpgrade.back', 'Back to your event', 'Назад до події')}
    </Link>
  );

  let body;
  if (loading) {
    body = <p className="event-addons-empty">{textOr('eventHome.addons.loading', 'Loading add-ons…', 'Завантаження послуг…')}</p>;
  } else if (data && !data.can_buy) {
    body = (
      <p className="event-addons-empty">
        {textOr('eventHome.addons.errors.free', 'Add-ons are available after you upgrade your free package.', 'Додаткові послуги доступні після покращення безкоштовного пакета.')}
        {' '}
        <Link to={`/event/${packedUid}/upgrade`}>{textOr('eventHome.addons.upgradeLink', 'Upgrade your package', 'Покращити пакет')}</Link>
      </p>
    );
  } else if (!data || !data.window_open || options.length === 0) {
    body = (
      <p className="event-addons-empty">
        {textOr('eventHome.addons.unavailable', 'There are no add-ons for this event right now.', 'Для цієї події зараз немає додаткових послуг.')}
      </p>
    );
  } else {
    body = (
      <div className="checkout-grid">
        <div className="checkout-items">
          {selected.map((product) => (
            <CartItemCard
              key={product.id}
              product={product}
              displayName={displayName(product)}
              displayDescription={displayDescription(product)}
              quantity={quantities[product.id]}
              config={configs[product.id] || {}}
              onConfigChange={(key, value) => setConfig(product.id, key, value)}
              onQtyChange={(qty) => setQuantities((prev) => ({ ...prev, [product.id]: Math.min(qty, 10) }))}
              onRemove={() => remove(product.id)}
            />
          ))}

          {available.length > 0 && (
            <section className="event-addons-available" aria-label={textOr('eventHome.addons.availableTitle', 'Available add-ons', 'Доступні послуги')}>
              {selected.length > 0 && (
                <h2 className="event-addons-available-title">{textOr('eventHome.addons.more', 'Add more', 'Додати ще')}</h2>
              )}
              <div className="event-addons-grid">
                {available.map((product) => {
                  const image = addonImages(product.options, false).image;
                  return (
                    <div key={product.id} className="event-addons-tile">
                      {image ? (
                        <div className="event-addons-tile-image" style={{ backgroundImage: `url("${image}")` }} />
                      ) : (
                        <div className="event-addons-tile-icon"><ProductIcon icon={product.options?.icon || 'fa-solid fa-gift'} size={48} /></div>
                      )}
                      <div className="event-addons-tile-body">
                        <h3 className="event-addons-tile-name">{displayName(product)}</h3>
                        {displayDescription(product) && <p className="event-addons-tile-desc">{displayDescription(product)}</p>}
                        <div className="event-addons-tile-foot">
                          <span className="event-addons-tile-price">{formatUah(product.price)}</span>
                          <button type="button" className="event-addons-tile-add" onClick={() => add(product)}>
                            {textOr('eventHome.addons.add', 'Add', 'Додати')}
                          </button>
                        </div>
                        {product.fullfillment_type === 'physical' && (
                          <span className="event-addons-tile-note">
                            <i className="fa-solid fa-truck" /> {textOr('eventHome.addons.delivery', 'Printed and delivered by Nova Poshta', 'Друк і доставка Новою Поштою')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="checkout-summary">
          <h2 className="checkout-summary-title">{t('checkout.orderSummary')}</h2>
          <div className="checkout-summary-rows">
            {selected.length === 0 ? (
              <p className="event-addons-summary-empty">{textOr('eventHome.addons.choose', 'Choose at least one add-on.', 'Оберіть хоча б одну послугу.')}</p>
            ) : selected.map((product) => (
              <div key={product.id} className="checkout-summary-row">
                <span className="checkout-summary-row-label">
                  {displayName(product)}{quantities[product.id] > 1 ? ` × ${quantities[product.id]}` : ''}
                </span>
                <span className="checkout-summary-row-value">{formatUah(Number(product.price) * quantities[product.id])}</span>
              </div>
            ))}
            <div className="checkout-summary-total">
              <span className="checkout-summary-total-label">{t('checkout.total')}</span>
              <span className="checkout-summary-total-value">{formatUah(total)}</span>
            </div>
          </div>

          <div className="checkout-email-group checkout-phone-group">
            <label className="checkout-email-label" htmlFor="addons-phone">{textOr('checkout.phoneLabel', 'Phone number', 'Номер телефону')}</label>
            <div className="checkout-email-input-wrap">
              <input
                id="addons-phone"
                type="tel"
                className="checkout-email-input"
                placeholder="+380 99 123 45 67"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          {hasPhysical && (
            <div className="checkout-shipping-section">
              <p className="checkout-shipping-note">
                {textOr(
                  'checkout.shipping.novaPoshtaNote',
                  'If you order physical items, such as QR cards or welcome board, they will be shipped via Nova Poshta, and their rates will be applied. Due to size limitations, your order may be redirected to suitable branch.',
                  'Якщо ви замовите фізичні товари, як-от QR-картки чи вітальний банер, їх буде надіслано службою Nova Poshta, і буде застосовано її тарифи. Великі замовлення можуть бути перенаправлені до відповідного відділення.',
                )}
              </p>
              <div className="checkout-shipping-header">
                <span className="checkout-email-label">{textOr('checkout.shipping.addressTitle', 'Shipping Address', 'Адреса доставки')}</span>
                <button type="button" className="checkout-address-btn" onClick={() => setShowAddress(true)}>
                  {address
                    ? textOr('checkout.shipping.edit', 'Edit', 'Редагувати')
                    : textOr('checkout.shipping.addAddress', '+ Add Shipping Address', '+ Додати адресу доставки')}
                </button>
              </div>
              {address && (
                <div className="checkout-address-preview">
                  <div className="checkout-address-preview-name">{address.full_name}</div>
                  <div className="checkout-address-preview-line">{address.city_name} — {address.warehouse_name}</div>
                  <div className="checkout-address-preview-line">{address.phone}</div>
                </div>
              )}
            </div>
          )}

          {error && <p className="event-addons-error" role="alert">{error}</p>}

          <button type="button" className="checkout-complete-btn" disabled={busy || selected.length === 0} onClick={pay}>
            <span className="checkout-complete-btn-text">
              {busy
                ? textOr('eventHome.freeUpgrade.opening', 'Opening payment…', 'Відкриваємо оплату…')
                : textOr('eventHome.addons.pay', 'Pay {{price}}', 'Сплатити {{price}}', { price: formatUah(total) })}
            </span>
            <div className="checkout-complete-btn-icon">
              <i className="fa-solid fa-arrow-right"></i>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page event-addons-page">
      <V2Header />
      <main className="checkout-main">
        {backLink}
        <header className="event-addons-head">
          <h1 className="event-addons-title">{textOr('eventHome.addons.title', 'Add-ons for your event', 'Додаткові послуги для вашої події')}</h1>
          <p className="event-addons-subtitle">
            {textOr('eventHome.addons.subtitle', 'Add extras to your event at any time.', 'Додайте послуги до своєї події будь-коли.')}
          </p>
        </header>
        {body}
      </main>
      <V2Footer />

      {showAddress && (
        <AddressModal
          initial={address}
          onConfirm={(addr) => {
            setAddress(addr);
            if (!phone.trim() && addr.phone) setPhone(normalizeContactPhone(addr.phone));
            setShowAddress(false);
          }}
          onClose={() => setShowAddress(false)}
        />
      )}
    </div>
  );
}

export default EventAddons;
