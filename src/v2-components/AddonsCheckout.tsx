import { useState } from 'react';
import ProductIcon from './ProductIcon';
import {
  AddressModal,
  CartItemCard,
  ConfigField,
  Design,
  Overlay,
  ShippingAddress,
  isContactPhoneValid,
  normalizeContactPhone,
} from '../v2-partials/V2Checkout';
import { UpgradeItem } from '../client/upgrades';
import { getQtyRule } from '../client/cart';
import { Product } from '../types/products';
import { t } from '../packages/i18n';
import { textOr } from '../utils/admin_i18n';
import { displayConfigFieldLabel } from '../utils/product_i18n';
import { addonImages } from '../utils/addon_images';
import { formatUah } from '../utils/money';
import '../v2-styles/Checkout.css';
import '../v2-styles/EventAddons.css';

// Ek urun secme ve odeme blogu: secilen ekler checkout'taki kartla (tasarim, metin alanlari, adet), eklenebilecekler
// kutucuk olarak, sagda ozet + telefon + (fiziksel urun varsa) Nova Poshta adresi. Iki yerde kullanilir:
//   - /event/<uid>/addons: ucretli etkinlige sonradan ek (Fatih 20 Kasim 2026); en az bir ek secilmeli.
//   - /event/<uid>/upgrade 2. adim: free paketten yukseltirken paketle birlikte ek (Fatih 23 Kasim 2026, "Option 2");
//     ekler istege bagli, ozetin basinda paket satiri (leadRows), ek secilmezse yalniz paket odenir.
// Sayfa sarmalayicisi "checkout-page event-addons-page" olmali (stiller ona bagli).

export interface AddonsCheckoutPayload {
  items: UpgradeItem[];
  phone: string;
  // product_id -> config alanlarinin JSON metni (design_id dahil), checkout ile ayni bicim
  buyer_configs: Record<string, string>;
  shipping_address: ShippingAddress | null;
}

interface LeadRow {
  key: string;
  label: string;
  amount: number;
}

interface Props {
  options: Product[];
  // Ozetin basindaki sabit satirlar (yukseltmede paket) ve toplamlari.
  leadRows?: LeadRow[];
  // true: ek secmeden de odenebilir (yukseltme), false: en az bir ek gerekir (/addons).
  allowEmpty?: boolean;
  payLabel: (total: number, selectedCount: number) => string;
  onPay: (payload: AddonsCheckoutPayload) => Promise<void>;
  errorMessage: (err: unknown) => string;
}

const isUk = () => t('lang_code') === 'uk';
const displayName = (p: Product) => (isUk() ? p.display_name_uk || p.display_name_en : p.display_name_en || p.display_name_uk) || p.id;
const displayDescription = (p: Product) => (isUk()
  ? p.display_description_uk || p.display_description_en
  : p.display_description_en || p.display_description_uk) || '';

function AddonsCheckout({ options, leadRows = [], allowEmpty = false, payLabel, onPay, errorMessage }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [configs, setConfigs] = useState<Record<string, Record<string, string>>>({});
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState<ShippingAddress | null>(null);
  const [showAddress, setShowAddress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selected = options.filter((p) => (quantities[p.id] || 0) > 0);
  const available = options.filter((p) => !(quantities[p.id] > 0));
  const hasPhysical = selected.some((p) => p.fullfillment_type === 'physical');
  const leadTotal = leadRows.reduce((sum, row) => sum + row.amount, 0);
  const total = leadTotal + selected.reduce((sum, p) => sum + Number(p.price || 0) * quantities[p.id], 0);
  // Telefon ve adres yalniz ek secilince istenir (yalniz paket odemesinde gerekmez).
  const needsContact = selected.length > 0 || !allowEmpty;

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
    if (selected.length === 0) {
      return allowEmpty ? '' : textOr('eventHome.addons.choose', 'Choose at least one add-on.', 'Оберіть хоча б одну послугу.');
    }
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
      await onPay({
        items: selected.map((p) => ({ product_id: p.id, quantity: quantities[p.id] })),
        phone: selected.length > 0 ? normalizeContactPhone(phone) : '',
        buyer_configs: buyerConfigs,
        shipping_address: hasPhysical ? address : null,
      });
      // Tarayici LiqPay'e gidiyor; dugme kilitli kalir.
    } catch (err) {
      setBusy(false);
      setError(errorMessage(err));
    }
  };

  return (
    <>
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
            {leadRows.map((row) => (
              <div key={row.key} className="checkout-summary-row">
                <span className="checkout-summary-row-label">{row.label}</span>
                <span className="checkout-summary-row-value">{formatUah(row.amount)}</span>
              </div>
            ))}
            {selected.length === 0 ? (
              <p className="event-addons-summary-empty">
                {allowEmpty
                  ? textOr('eventHome.addons.optional', 'No add-ons selected. They are optional.', 'Послуги не обрано. Вони необов’язкові.')
                  : textOr('eventHome.addons.choose', 'Choose at least one add-on.', 'Оберіть хоча б одну послугу.')}
              </p>
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

          {needsContact && (
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
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError('');
                  }}
                />
              </div>
            </div>
          )}

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

          <button type="button" className="checkout-complete-btn" disabled={busy || (!allowEmpty && selected.length === 0)} onClick={pay}>
            <span className="checkout-complete-btn-text">
              {busy
                ? textOr('eventHome.freeUpgrade.opening', 'Opening payment…', 'Відкриваємо оплату…')
                : payLabel(total, selected.length)}
            </span>
            <div className="checkout-complete-btn-icon">
              <i className="fa-solid fa-arrow-right"></i>
            </div>
          </button>
        </div>
      </div>

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
    </>
  );
}

export default AddonsCheckout;
