import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import ProductIcon from '../v2-components/ProductIcon';
import '../v2-styles/Checkout.css';
import { SERV_ROOT } from '../consts';
import { cartState, initCartState, setCartQty } from '../client/cart';
import { useSnapshot } from 'valtio';
import { t } from '../packages/i18n';
import { fetch } from '../client/core';
import { whoAmI } from '../client/auth';
import { pgREST } from '../client/postgrest';
import { get_key } from '../utils/persistence';
import { Product } from '../types/products';
import { getPromoErrorMessage, validatePromoCode } from '../client/promo';
import { PromoValidationResponse } from '../types/promo';
import { markMetaEventOnce, trackMetaAddToCart } from '../client/meta-pixel';

interface ShippingAddress {
  full_name: string;
  phone: string;
  city_ref: string;       // NP DeliveryCity UUID
  city_name: string;      // display only
  warehouse_ref: string;  // NP Warehouse UUID
  warehouse_name: string; // display only
}

interface ConfigField {
  key: string;
  label: string;
  type?: string;
  maxLength?: number;
}

interface Overlay {
  type: 'text' | 'qr';
  field_key?: string;   // for type=text: which config field to read
  value?: string;       // for type=qr: static value (placeholder)
  x: number;           // 0–1 relative position
  y: number;
  font_size?: number;
  color?: string;
  align?: CanvasTextAlign;
  size?: number;        // for qr: pixel size
  font_weight?: string;
  font_family?: string;
  max_width?: number;  // 0–1 relative to canvas width, default 0.7
  placeholder?: string;
}

interface Design {
  id: string;
  label: string;
  image: string;
  overlays?: Overlay[];
}

interface ProductDisplayFields {
  id: string;
  display_name_en?: string;
  display_name_uk?: string;
  display_description_en?: string;
  display_description_uk?: string;
}

// Per-product config state: { [productId]: { design_id?: string, [key]: string } }
type BuyerConfigsState = Record<string, Record<string, string>>;

const SINGLE_QUANTITY_ADDON_IDS = new Set(['audioGuestbook', 'audiobook', 'advertorial', 'sponsored']);

// Ne: Cart item listesinden Meta AddToCart icin tekrar kullanilabilir signature uretir.
// Nasil: Quantity'si pozitif urunleri product_uid:quantity formatinda siralayip pipe ile birlestirir.
// Neden: Ayni cart checkout refresh'lerinde ikinci kez AddToCart sayilmasin.
function buildMetaCartSignature(cartItems: ReadonlyArray<{ product_uid: string; quantity: number }>) {
  return cartItems
    .filter(item => item.quantity > 0)
    .map(item => `${item.product_uid}:${item.quantity}`)
    .sort()
    .join('|');
}

function V2Checkout() {
  const cart = useSnapshot(cartState);
  const currentLang = String(t('lang_code') || 'en');
  const checkoutSummaryRef = useRef<HTMLDivElement | null>(null);
  const addToCartTrackedRef = useRef(false);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [buyerConfigs, setBuyerConfigs] = useState<BuyerConfigsState>({});
  const [userEmail, setUserEmail] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoValidationResponse | null>(null);
  const [promoApplying, setPromoApplying] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    initCartState();
    whoAmI()
      .then(claims => pgREST(`/users?uid=eq.${claims.ui}&select=mail`))
      .then((rows: { mail: string }[]) => { if (rows?.[0]?.mail) setUserEmail(rows[0].mail); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!cart.init) return;
    cart.cartItems.forEach((item) => {
      if (item.quantity > 1 && SINGLE_QUANTITY_ADDON_IDS.has(item.product_uid)) {
        setCartQty(item.product_uid, 1);
      }
    });
  }, [cart.cartItems, cart.init]);

  useEffect(() => {
    if (!cart.init || addToCartTrackedRef.current) return;
    const cartSignature = buildMetaCartSignature(cart.cartItems);
    if (!cartSignature) return;

    addToCartTrackedRef.current = true;
    if (!markMetaEventOnce(`meta_add_to_cart_tracked_${cartSignature}`)) return;

    // Ne: Checkout'a dolu cart ile gelindiginde Meta AddToCart event'i yollar.
    // Nasil: Cart signature guard'i gecerse toplam tutar ve UAH currency ile event tetiklenir.
    // Neden: Kullanici checkout asamasina ilerlediginde sepet aksiyonu olculsun ama refresh cift saymasin.
    trackMetaAddToCart({
      value: cart.total,
      currency: 'UAH',
    });
  }, [cart.cartItems, cart.init, cart.total]);

  useEffect(() => {
    if (!appliedPromo) return;
    setAppliedPromo(null);
    setPromoMessage(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.total]);

  const handleRemoveItem = (productId: string) => {
    setCartQty(productId, 0);
  };

  const handleConfigChange = (productId: string, key: string, value: string) => {
    setBuyerConfigs(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), [key]: value },
    }));
  };

  // Ne: Checkout tutarlarini summary kartinda standart para formatina cevirir.
  // Nasil: Bos/gecersiz degeri 0 kabul edip iki ondalikli hryvnia string'i dondurur.
  // Neden: Cart total ve promo response tutarlari ayni gorunumle render edilsin.
  const formatMoney = (value: number) => `₴${Number(value || 0).toFixed(2)}`;

  // Ne: Promo input degistiginde onceki apply sonucunu gecersiz kilar.
  // Nasil: Uncontrolled input kendi degerini tutar; state'te sadece basarili backend cevabi ve mesaj temizlenir.
  // Neden: Kullanici kodu sildiginde veya degistirdiginde purchase request'e eski promo yanlislikla eklenmesin.
  const clearAppliedPromo = () => {
    if (appliedPromo) setAppliedPromo(null);
    if (promoMessage) setPromoMessage(null);
  };

  // Ne: Checkout summary'deki promo kodunu backend'e dogrulatir.
  // Nasil: Form disi uncontrolled input degerini name ile okur ve mevcut cart_state'i purchase_info olarak yollar.
  // Neden: Indirim hesabi sadece backend'de yapilsin; add-on fiyatlari frontend'de indirim hesabina dahil edilmesin.
  const handleApplyPromo = async () => {
    const promoInput = document.querySelector('input[name="promo_code"]') as HTMLInputElement | null;
    const promoCode = promoInput?.value.trim() || '';

    if (!promoCode) {
      setAppliedPromo(null);
      setPromoMessage({ ok: false, text: 'Promo code is required' });
      return;
    }

    const cartStateData = await get_key("cart_state");
    if (!cartStateData) {
      setAppliedPromo(null);
      setPromoMessage({ ok: false, text: t('checkout.cartNotFound') });
      return;
    }

    setPromoApplying(true);
    setPromoMessage({ ok: true, text: 'Applying promo code...' });
    try {
      const result = await validatePromoCode({
        promo_code: promoCode,
        purchase_info: cartStateData,
      });
      setAppliedPromo(result);
      setPromoMessage({ ok: true, text: `Promo code ${result.promo_code_text_snapshot} applied.` });
    } catch (err) {
      setAppliedPromo(null);
      setPromoMessage({ ok: false, text: getPromoErrorMessage(err) });
    } finally {
      setPromoApplying(false);
    }
  };

  // Derive display items from cart state
  const displayItems = cart.cartItems
    .filter(item => item.quantity > 0)
    .map(item => {
      const product = cart.products.find(p => p.id === item.product_uid);
      return product ? { product, quantity: item.quantity } : null;
    })
    .filter(Boolean) as { product: typeof cart.products[0]; quantity: number }[];

  // Ne: Promo yuzdesinin baz alacagi premium paket tutarini hesaplar.
  // Nasil: Sepetteki premium urun adetini ve fiyatini toplar, add-on urunleri bilerek disarida birakir.
  // Neden: Promo indirimi yalnizca premium pakete uygulandigi icin yuzde hesaplamasi gross total uzerinden sapmasin.
  const premiumSubtotal = displayItems.reduce((sum, { product, quantity }) => {
    return product.id === 'premium' ? sum + product.price * quantity : sum;
  }, 0);

  // Ne: Uygulanan promo indiriminin yuzdelik karsiligini gosterim icin uretir.
  // Nasil: Backend'in discount_amount degerini premiumSubtotal'a boler ve tam sayiysa decimalsiz, degilse tek ondalikli formatlar.
  // Neden: Checkout summary'de tutarin yaninda kullanici hangi oranda indirim aldigini gorebilsin.
  const promoDiscountPercent = appliedPromo && premiumSubtotal > 0
    ? ((appliedPromo.discount_amount / premiumSubtotal) * 100)
    : null;
  const formattedPromoDiscountPercent = promoDiscountPercent === null
    ? ''
    : (Number.isInteger(promoDiscountPercent) ? promoDiscountPercent.toFixed(0) : promoDiscountPercent.toFixed(1));

  const hasPhysical = displayItems.some(({ product }) => product.fullfillment_type === 'physical');

  // Ne: Checkout ekraninda urun adi/aciklamasini backend display_* alanlarindan secer.
  // Nasil: Aktif dile gore ilgili display_name/display_description alanini dener, bossa diger dil fallback'ine gecer.
  // Neden: Services and Prices ile ayni veri kaynagindan beslenip i18n products fallback farkini ortadan kaldirmak.
  const resolveDisplayTexts = (product: ProductDisplayFields) => {
    const isUk = currentLang === 'uk';
    const name = isUk
      ? (product.display_name_uk || product.display_name_en)
      : (product.display_name_en || product.display_name_uk);
    const description = isUk
      ? (product.display_description_uk || product.display_description_en)
      : (product.display_description_en || product.display_description_uk);
    return { name, description };
  };

  const handleCompleteOrder = (e: React.FormEvent) => {
    e.preventDefault();

    const qs = (x: string) => document.querySelector(x);
    const email = (qs('input[name="email"]') as HTMLInputElement)?.value;
    if (!email) {
      alert(t('checkout.enterEmail'));
      return;
    }

    if (hasPhysical && !shippingAddress) {
      alert('Please add a shipping address for physical items.');
      return;
    }

    // Validate all physical products have required config fields filled
    for (const { product } of displayItems) {
      if (product.fullfillment_type !== 'physical') continue;
      const configFields: ConfigField[] = product.options?.config_fields || [];
      const designs: Design[] = product.options?.designs || [];
      const cfg = buyerConfigs[product.id] || {};

      if (designs.length > 0 && !cfg.design_id && !designs[0]?.id) {
        const resolvedName = resolveDisplayTexts(product).name || product.id;
        alert(`Please select a design for "${resolvedName}".`);
        return;
      }
      const selectedDesignId = cfg.design_id || designs[0]?.id || '';
      const selectedDesign = designs.find((d: Design) => d.id === selectedDesignId);
      const activeFieldKeys = new Set<string>((selectedDesign?.overlays || []).map((ov: Overlay) => ov.field_key).filter((k): k is string => !!k));
      // Ne: Odeme oncesi hangi konfigurasyon alanlarinin zorunlu oldugunu belirler.
      // Nasil: Overlay'li tasarimlarda yalnizca preview'da kullanilan alanlari, statik tasarimlarda tum config_fields alanlarini kontrol eder.
      // Neden: Checkout'ta gorunen alanlar ile submit validasyonu ayni kurala bagli kalsin.
      const fieldsToValidate = (activeFieldKeys.size > 0 ? configFields.filter(f => activeFieldKeys.has(f.key)) : configFields)
        // footer_text sorusu gecici olarak kapali.
        .filter(f => f.key !== 'footer_text');
      for (const field of fieldsToValidate) {
        if (!cfg[field.key]?.trim()) {
          const resolvedName = resolveDisplayTexts(product).name || product.id;
          alert(`Please fill "${field.label}" for "${resolvedName}".`);
          return;
        }
      }
    }

    (async () => {
      const cartStateData = await get_key("cart_state");
      if (!cartStateData) {
        alert(t('checkout.cartNotFound'));
        return;
      }

      // Ne: Checkout state'ini backend'in bekledigi buyer_configs payload formatina cevirir.
      // Nasil: Her fiziksel urun icin kullanici degerlerini JSON string yapar; design secimi varsa dokunulmamis default design_id'yi de ekler.
      // Neden: Event add-on detayinda secilen statik tasarim, kullanici dropdown'a hic dokunmasa bile bulunabilsin.
      const serializedConfigs: Record<string, string> = {};
      for (const { product } of displayItems) {
        const cfg = buyerConfigs[product.id] || {};
        const designs: Design[] = product.options?.designs || [];
        const normalizedCfg = {
          ...(designs.length > 0 ? { design_id: cfg.design_id || designs[0]?.id || '' } : {}),
          ...cfg,
        };
        if (Object.keys(normalizedCfg).length > 0) {
          serializedConfigs[product.id] = JSON.stringify(normalizedCfg);
        }
      }

      fetch(`${SERV_ROOT}/api/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: "liqpay",
          purchase_info: cartStateData,
          email: email,
          buyer_configs: serializedConfigs,
          ...(appliedPromo ? { promo_code: appliedPromo.promo_code_text_snapshot } : {}),
          ...(shippingAddress ? { shipping_address: shippingAddress } : {}),
        }),
      }).then(res => res.json()).then(data => {
        if (data.type === 'liqpay_form') {
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = 'https://www.liqpay.ua/api/3/checkout';
          form.acceptCharset = 'utf-8';
          ['data', 'signature'].forEach(k => {
            const inp = document.createElement('input');
            inp.type = 'hidden';
            inp.name = k;
            inp.value = data[k];
            form.appendChild(inp);
          });
          document.body.appendChild(form);
          form.submit();
        } else if (data.url) {
          window.location.href = data.url;
        }
      }).catch(err => {
        alert(err.message);
      });
    })();
  };

  const scrollToCheckoutSummaryOnMobile = () => {
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    window.setTimeout(() => {
      const target = checkoutSummaryRef.current;
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY - 16;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 0);
  };

  return (
    <div className="checkout-page">
      <V2Header />

      <div className="checkout-marquee">
        <div className="checkout-marquee-content">
          <span className="checkout-marquee-text">{t('checkout.marqueeText')}</span>
          <span className="checkout-marquee-text">{t('checkout.marqueeText')}</span>
          <span className="checkout-marquee-text">{t('checkout.marqueeText')}</span>
          <span className="checkout-marquee-text">{t('checkout.marqueeText')}</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="checkout-main">
        <div className="checkout-grid">
          {/* Cart Items */}
          <div className="checkout-items">
            {displayItems.map(({ product, quantity }) => (
              <CartItemCard
                key={product.id}
                product={product as unknown as Product}
                displayName={resolveDisplayTexts(product).name || product.id}
                displayDescription={resolveDisplayTexts(product).description || ''}
                quantity={quantity}
                config={buyerConfigs[product.id] || {}}
                onConfigChange={(key, val) => handleConfigChange(product.id, key, val)}
                onQtyChange={(qty) => setCartQty(product.id, qty)}
                onRemove={() => handleRemoveItem(product.id)}
              />
            ))}
          </div>

          <div className="checkout-summary" ref={checkoutSummaryRef}>
            <h2 className="checkout-summary-title">{t('checkout.orderSummary')}</h2>

            <div className="checkout-summary-rows">
              <div className="checkout-summary-row">
                <span className="checkout-summary-row-label">{appliedPromo ? 'Gross total' : t('checkout.subtotal')}</span>
                <span className="checkout-summary-row-value">{formatMoney(appliedPromo?.gross_total ?? cart.total)}</span>
              </div>
              <div className="checkout-summary-row checkout-summary-row-divider">
                <span className="checkout-summary-row-label">{t('checkout.shipping')}</span>
                <span className="checkout-summary-free-badge">{t('checkout.novaPoshtaRates')}</span>
              </div>
              {appliedPromo && (
                <div className="checkout-summary-row checkout-summary-discount-row">
                  <span className="checkout-summary-row-label">Promo discount</span>
                  <span className="checkout-summary-row-value">
                    -{formatMoney(appliedPromo.discount_amount)}
                    {formattedPromoDiscountPercent ? ` (-${formattedPromoDiscountPercent}%)` : ''}
                  </span>
                </div>
              )}
              <div className="checkout-summary-total">
                <span className="checkout-summary-total-label">{appliedPromo ? 'Net total' : t('checkout.total')}</span>
                <span className="checkout-summary-total-value">{formatMoney(appliedPromo?.net_total ?? cart.total)}</span>
              </div>
            </div>

            <div className="checkout-promo-section">
              <label className="checkout-email-label">Promo code</label>
              <div className="checkout-promo-row">
                <input
                  name="promo_code"
                  className="checkout-promo-input"
                  placeholder="SUMMER10"
                  autoComplete="off"
                  onChange={clearAppliedPromo}
                />
                <button
                  type="button"
                  className="checkout-promo-apply-btn"
                  onClick={handleApplyPromo}
                  disabled={promoApplying}
                >
                  {promoApplying ? 'Applying...' : 'Apply'}
                </button>
              </div>
              {promoMessage && (
                <p className={promoMessage.ok ? 'checkout-promo-message-ok' : 'checkout-promo-message-error'}>
                  {promoMessage.text}
                </p>
              )}
            </div>

            {hasPhysical && (
              <div className="checkout-shipping-section">
                <div className="checkout-shipping-header">
                  <span className="checkout-email-label">Shipping Address</span>
                  <button
                    type="button"
                    className="checkout-address-btn"
                    onClick={() => setShowAddressModal(true)}
                  >
                    {shippingAddress ? 'Edit' : '+ Add Shipping Address'}
                  </button>
                </div>
                {shippingAddress && (
                  <div className="checkout-address-preview">
                    <div className="checkout-address-preview-name">{shippingAddress.full_name}</div>
                    <div className="checkout-address-preview-line">{shippingAddress.city_name} — {shippingAddress.warehouse_name}</div>
                    <div className="checkout-address-preview-line">{shippingAddress.phone}</div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleCompleteOrder}>
              <div className="checkout-email-group">
                <label className="checkout-email-label">{t('checkout.deliveryEmail')}</label>
                <div className="checkout-email-input-wrap">
                  <input
                    type="email"
                    className="checkout-email-input"
                    placeholder={t('checkout.emailPlaceholder')}
                    name='email'
                    defaultValue={userEmail}
                  />
                </div>
              </div>

              <p className="checkout-info-text">
                {t('checkout.emailInfo')}
              </p>

              <button type="submit" className="checkout-complete-btn">
                <span className="checkout-complete-btn-text">{t('checkout.completeOrder')}</span>
                <div className="checkout-complete-btn-icon">
                  <i className="fa-solid fa-arrow-right"></i>
                </div>
              </button>
            </form>
          </div>
        </div>
      </main>

      <V2Footer />

      {showAddressModal && (
        <AddressModal
          initial={shippingAddress}
          onConfirm={(addr) => {
            setShippingAddress(addr);
            setShowAddressModal(false);
            scrollToCheckoutSummaryOnMobile();
          }}
          onClose={() => setShowAddressModal(false)}
        />
      )}
    </div>
  );
}

interface BannerCanvasProps {
  design: Design;
  config: Record<string, string>;
}

function BannerCanvas({ design, config }: BannerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);

  const A4_W = 2480;
  const A4_H = 3508;

  const drawOverlays = async (ctx: CanvasRenderingContext2D) => {
    const bgImg = bgImgRef.current;
    if (!bgImg) return;
    ctx.clearRect(0, 0, A4_W, A4_H);
    ctx.drawImage(bgImg, 0, 0, A4_W, A4_H);

    const overlays: Overlay[] = design.overlays || [];
    for (const overlay of overlays) {
      const x = overlay.x * A4_W;
      const y = overlay.y * A4_H;

      if (overlay.type === 'text') {
        const rawText = overlay.field_key ? (config[overlay.field_key] || '') : '';
        const text = overlay.field_key === 'event_date' && rawText
          ? new Date(rawText + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
          : rawText;
        const displayText = text || overlay.placeholder || '';
        if (!displayText) continue;
        const weight = overlay.font_weight || '700';
        const size = ((overlay.font_size || 48) / 1000) * A4_H;
        const family = overlay.font_family || 'sans-serif';
        ctx.font = `${weight} ${size}px ${family}`;
        ctx.fillStyle = overlay.color || '#ffffff';
        ctx.textAlign = overlay.align || 'center';
        ctx.textBaseline = 'middle';
        const maxWidth = (overlay.max_width || 0.7) * A4_W;
        const lineHeight = size * 1.3;
        const words = displayText.split(' ');
        const lines: string[] = [];
        let current = '';
        for (const word of words) {
          const test = current ? `${current} ${word}` : word;
          if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = word;
          } else {
            current = test;
          }
        }
        if (current) lines.push(current);
        const totalHeight = lines.length * lineHeight;
        lines.forEach((line, i) => {
          ctx.fillText(line, x, y - totalHeight / 2 + i * lineHeight + lineHeight / 2);
        });
      } else if (overlay.type === 'qr') {
        const qrSize = ((overlay.size || 120) / 1000) * A4_W;
        const qrValue = overlay.value || 'https://placeholder.qr';
        const qrCanvas = document.createElement('canvas');
        await QRCode.toCanvas(qrCanvas, qrValue, { width: qrSize, margin: 1, color: { dark: overlay.color || '#000000', light: '#00000000' } });
        ctx.drawImage(qrCanvas, x - qrSize / 2, y - qrSize / 2, qrSize, qrSize);
      }
    }
  };

  // When design changes: load the new background image then draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = A4_W;
    canvas.height = A4_H;
    bgImgRef.current = null;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = design.image;
    img.onload = () => {
      bgImgRef.current = img;
      drawOverlays(ctx);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.image]);

  // When config changes: reuse cached image, just redraw overlays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImgRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawOverlays(ctx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  return (
    <canvas
      ref={canvasRef}
      className="checkout-item-banner-canvas"
    />
  );
}

interface CartItemCardProps {
  product: Product;
  displayName: string;
  displayDescription: string;
  quantity: number;
  config: Record<string, string>;
  onConfigChange: (key: string, value: string) => void;
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
}

function CartItemCard({ product, displayName, displayDescription, quantity, config, onConfigChange, onQtyChange, onRemove }: CartItemCardProps) {
  const isPhysical = product.fullfillment_type === 'physical';
  const isAddOn = !!product.is_add_on;
  const showQuantityStepper = isAddOn && !SINGLE_QUANTITY_ADDON_IDS.has(product.id);
  const designs: Design[] = product.options?.designs || [];
  const configFields: ConfigField[] = product.options?.config_fields || [];

  const selectedDesignId = config.design_id || designs[0]?.id || '';
  const selectedDesign = designs.find(d => d.id === selectedDesignId);
  const previewImage = selectedDesign?.image || product.options?.image;
  // Ne: Secili tasarimin eski canvas overlay preview akisini kullanip kullanmadigini soyler.
  // Nasil: Backend design.overlays alanini dolu gonderdiyse true kabul eder.
  // Neden: Welcome Board ve QR Card gibi yeni statik tasarimlarda gorsel uzerine text/QR basilmamali.
  const designUsesOverlayPreview = (design?: Design) => {
    return Boolean(design?.overlays?.length);
  };
  const overlayPlaceholders: Record<string, string> = {};
  const activeFieldKeys = new Set<string>();
  for (const ov of selectedDesign?.overlays || []) {
    if (ov.field_key) {
      activeFieldKeys.add(ov.field_key);
      if (ov.placeholder) overlayPlaceholders[ov.field_key] = ov.placeholder;
    }
  }
  // Ne: Checkout'ta kullanicidan istenecek urun konfigurasyon alanlarini belirler.
  // Nasil: Overlay'li eski tasarimlarda sadece preview'da kullanilan alanlari gosterir; overlay yoksa backend config_fields listesinin tamamini kullanir.
  // Neden: Yeni statik fiziksel add-on akislarinda gorsel sabit kalir ama form alanlari buyer_config olarak saklanmaya devam etmelidir.
  const visibleConfigFields = designUsesOverlayPreview(selectedDesign)
    ? configFields.filter(f => activeFieldKeys.has(f.key))
    : configFields;

  return (
    <div className={`checkout-item${isPhysical && designs.length > 0 ? ' checkout-item--physical' : ''}`}>
      {isPhysical && selectedDesign && designUsesOverlayPreview(selectedDesign) ? (
        <BannerCanvas design={selectedDesign} config={config} />
      ) : isPhysical && selectedDesign?.image ? (
        <img
          className="checkout-item-design-preview"
          src={selectedDesign.image}
          alt={selectedDesign.label || displayName}
        />
      ) : previewImage ? (
        <div
          className="checkout-item-image"
          style={{ backgroundImage: `url("${previewImage}")` }}
        />
      ) : product.options?.icon ? (
        <ProductIcon icon={product.options.icon} size={96} />
      ) : null}
      <div className="checkout-item-content">
        <div className="checkout-item-header">
          <div className="checkout-item-info">
            <h3 className="checkout-item-name">{displayName}</h3>
            <p className="checkout-item-description">{displayDescription}</p>
          </div>
          <span className="checkout-item-price">₴{(product.price * quantity).toFixed(2)}</span>
        </div>

        {isPhysical && (designs.length > 0 || visibleConfigFields.length > 0) && (
          <div className="checkout-item-config">
            {designs.length > 0 && (
              <div className="checkout-item-config-field">
                <label className="checkout-item-config-label">Design</label>
                <select
                  className="checkout-item-config-select"
                  value={selectedDesignId}
                  onChange={e => onConfigChange('design_id', e.target.value)}
                >
                  {designs.map(d => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>
            )}
            {visibleConfigFields.map(field => {
              // footer_text sorusunu checkout'ta gecici olarak gizliyoruz.
              if (field.key === 'footer_text') return null;
              return (
                <div key={field.key} className="checkout-item-config-field">
                  <label className="checkout-item-config-label">{field.label}</label>
                  {field.key === 'event_date' ? (
                    <input
                      type="date"
                      className="checkout-item-config-textarea"
                      value={config[field.key] || ''}
                      onChange={e => onConfigChange(field.key, e.target.value)}
                    />
                  ) : (
                    <textarea
                      className="checkout-item-config-textarea"
                      value={config[field.key] || ''}
                      onChange={e => onConfigChange(field.key, e.target.value)}
                      maxLength={field.maxLength}
                      rows={2}
                      placeholder={overlayPlaceholders[field.key] || field.label}
                    />
                  )}
                  {field.maxLength && field.key !== 'event_date' && (
                    <span className="checkout-item-config-count">
                      {(config[field.key] || '').length} / {field.maxLength}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="checkout-item-footer">
          {showQuantityStepper ? (
            <div className="checkout-item-stepper">
              <button
                type="button"
                className="checkout-item-stepper-btn"
                onClick={() => quantity > 1 ? onQtyChange(quantity - 1) : onRemove()}
              >−</button>
              <span className="checkout-item-stepper-count">{quantity}</span>
              <button
                type="button"
                className="checkout-item-stepper-btn"
                onClick={() => onQtyChange(quantity + 1)}
              >+</button>
            </div>
          ) : null}
          <button className="checkout-item-remove" onClick={onRemove}>{t('checkout.remove')}</button>
        </div>
      </div>
    </div>
  );
}

interface NPSettlement {
  Ref: string;
  DeliveryCity: string;
  MainDescription: string;
  Present: string;
  Area: string;
  Region: string;
  Warehouses: number;
}

interface NPWarehouse {
  Ref: string;
  Description: string;
  ShortAddress: string;
  Number: string;
}

interface AddressModalProps {
  initial: ShippingAddress | null;
  onConfirm: (addr: ShippingAddress) => void;
  onClose: () => void;
}

function validateNamePart(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required`;
  if (/\d/.test(trimmed)) return `${label} must not contain numbers`;
  if (trimmed.length < 2) return `${label} must be at least 2 characters`;
  return '';
}

function AddressModal({ initial, onConfirm, onClose }: AddressModalProps) {
  const nameParts = initial?.full_name?.trim().split(/\s+/) || [];
  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [submitted, setSubmitted] = useState(false);

  // City search
  const [cityQuery, setCityQuery] = useState(initial?.city_name || '');
  const [cityResults, setCityResults] = useState<NPSettlement[]>([]);
  const [selectedCity, setSelectedCity] = useState<NPSettlement | null>(
    initial?.city_ref ? { Ref: '', DeliveryCity: initial.city_ref, MainDescription: initial.city_name, Present: initial.city_name, Area: '', Region: '', Warehouses: 0 } : null
  );
  const [cityLoading, setCityLoading] = useState(false);

  // Branch selection
  const [warehouses, setWarehouses] = useState<NPWarehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<NPWarehouse | null>(
    initial?.warehouse_ref ? { Ref: initial.warehouse_ref, Description: initial.warehouse_name, ShortAddress: '', Number: '' } : null
  );
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [branchQuery, setBranchQuery] = useState('');
  const [branchResults, setBranchResults] = useState<NPWarehouse[]>([]);

  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When modal opens with a pre-selected city, fetch its warehouses so branch search works
  useEffect(() => {
    if (!initial?.city_ref) return;
    setWarehousesLoading(true);
    window.fetch(`${SERV_ROOT}/api/np/warehouses?city_ref=${initial.city_ref}`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setWarehouses(list);
        // If user already typed something, populate results now that data is loaded
        setBranchResults(prev => {
          const q = branchQuery.trim().toLowerCase();
          if (!q) return prev;
          return list.filter((w: NPWarehouse) =>
            w.Description.toLowerCase().includes(q) || w.Number.includes(q)
          ).slice(0, 15);
        });
      })
      .catch(() => setWarehouses([]))
      .finally(() => setWarehousesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizePhone = (raw: string) =>
    raw.replace(/\D/g, '').replace(/^0/, '380').replace(/^380380/, '380');

  const isPhoneValid = (raw: string) => {
    const n = normalizePhone(raw);
    return /^380\d{9}$/.test(n);
  };

  // Derived errors — only shown after first submit attempt
  const firstNameError = submitted ? validateNamePart(firstName, 'First name') : '';
  const lastNameError = submitted ? validateNamePart(lastName, 'Last name') : '';
  const phoneError = submitted && !isPhoneValid(phone)
    ? 'Enter a valid Ukrainian mobile number (e.g. +380 99 123 45 67)' : '';
  const cityError = submitted && !selectedCity
    ? 'Select a city from the dropdown' : '';
  const warehouseError = submitted && selectedCity && !selectedWarehouse
    ? 'Select a Nova Poshta branch' : '';

  // Also show phone error while typing (after first interaction)
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneInlineError = phoneTouched && phone && !isPhoneValid(phone)
    ? 'Enter a valid Ukrainian mobile number (e.g. +380 99 123 45 67)' : '';

  const searchCities = (q: string) => {
    setCityQuery(q);
    setSelectedCity(null);
    setWarehouses([]);
    setSelectedWarehouse(null);
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    if (q.length < 2) { setCityResults([]); return; }
    cityDebounceRef.current = setTimeout(async () => {
      setCityLoading(true);
      try {
        const res = await window.fetch(`${SERV_ROOT}/api/np/settlements?q=${encodeURIComponent(q)}&limit=10`);
        const data = await res.json();
        setCityResults(Array.isArray(data) ? data : []);
      } catch {
        setCityResults([]);
      } finally {
        setCityLoading(false);
      }
    }, 350);
  };

  const selectCity = async (city: NPSettlement) => {
    setSelectedCity(city);
    setCityQuery(city.Present || city.MainDescription);
    setCityResults([]);
    setSelectedWarehouse(null);
    setBranchQuery('');
    setBranchResults([]);
    setWarehousesLoading(true);
    try {
      const res = await window.fetch(`${SERV_ROOT}/api/np/warehouses?city_ref=${city.DeliveryCity}`);
      const data = await res.json();
      setWarehouses(Array.isArray(data) ? data : []);
    } catch {
      setWarehouses([]);
    } finally {
      setWarehousesLoading(false);
    }
  };

  const searchBranches = (q: string) => {
    setBranchQuery(q);
    setSelectedWarehouse(null);
    if (!q.trim()) {
      setBranchResults([]);
      return;
    }
    const lower = q.toLowerCase();
    setBranchResults(warehouses.filter(w =>
      w.Description.toLowerCase().includes(lower) || w.Number.includes(q)
    ).slice(0, 15));
  };

  const selectBranch = (wh: NPWarehouse) => {
    setSelectedWarehouse(wh);
    setBranchQuery(wh.Description);
    setBranchResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (validateNamePart(firstName, 'First name') || validateNamePart(lastName, 'Last name')) return;
    if (!isPhoneValid(phone)) return;
    if (!selectedCity) return;
    if (!selectedWarehouse) return;
    onConfirm({
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      phone: normalizePhone(phone),
      city_ref: selectedCity.DeliveryCity,
      city_name: selectedCity.MainDescription,
      warehouse_ref: selectedWarehouse.Ref,
      warehouse_name: selectedWarehouse.Description,
    });
  };

  return (
    <div className="addr-modal-overlay" onClick={onClose}>
      <div className="addr-modal" onClick={e => e.stopPropagation()}>
        <div className="addr-modal-header">
          <h3 className="addr-modal-title">Shipping Address</h3>
          <button className="addr-modal-close" onClick={onClose} type="button">✕</button>
        </div>
        <div className="addr-np-notice">
          <i className="fa-solid fa-truck-fast" />
          <span>Delivery via Nova Poshta — you will pick up the order from the nearest branch.</span>
        </div>
        <form className="addr-modal-form" onSubmit={handleSubmit}>
          <div className="addr-field-row">
            <div className="addr-field-group">
              <label className="addr-label">FIRST NAME</label>
              <input
                className={`addr-input${firstNameError ? ' addr-input--error' : ''}`}
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Іван"
              />
              {firstNameError && <span className="addr-field-error">{firstNameError}</span>}
            </div>
            <div className="addr-field-group">
              <label className="addr-label">LAST NAME</label>
              <input
                className={`addr-input${lastNameError ? ' addr-input--error' : ''}`}
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Петренко"
              />
              {lastNameError && <span className="addr-field-error">{lastNameError}</span>}
            </div>
          </div>

          <div className="addr-field-group">
            <label className="addr-label">PHONE</label>
            <input
              className={`addr-input${(phoneError || phoneInlineError) ? ' addr-input--error' : ''}`}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onBlur={() => setPhoneTouched(true)}
              placeholder="+380 XX XXX XX XX"
            />
            {(phoneError || phoneInlineError) && (
              <span className="addr-field-error">{phoneError || phoneInlineError}</span>
            )}
          </div>

          <div className="addr-field-group" style={{ position: 'relative' }}>
            <label className="addr-label">CITY</label>
            <input
              className={`addr-input${cityError ? ' addr-input--error' : ''}`}
              value={cityQuery}
              onChange={e => searchCities(e.target.value)}
              placeholder="Start typing a city..."
              autoComplete="off"
            />
            {cityLoading && <div className="addr-dropdown-hint">Searching...</div>}
            {cityResults.length > 0 && (
              <ul className="addr-dropdown">
                {cityResults.map(c => (
                  <li key={c.DeliveryCity} className="addr-dropdown-item" onClick={() => selectCity(c)}>
                    {c.Present || c.MainDescription}
                    {c.Warehouses > 0 && <span className="addr-dropdown-sub"> · {c.Warehouses} branches</span>}
                  </li>
                ))}
              </ul>
            )}
            {cityError && <span className="addr-field-error">{cityError}</span>}
          </div>

          {selectedCity && (
            <div className="addr-field-group" style={{ position: 'relative' }}>
              <label className="addr-label">NOVA POSHTA PICKUP BRANCH</label>
              {warehousesLoading ? (
                <div className="addr-dropdown-hint">Loading branches...</div>
              ) : (
                <>
                  <input
                    className={`addr-input${warehouseError ? ' addr-input--error' : ''}`}
                    value={branchQuery}
                    onChange={e => searchBranches(e.target.value)}
                    placeholder="Search by branch number or address..."
                    autoComplete="off"
                  />
                  {branchResults.length > 0 && (
                    <ul className="addr-dropdown">
                      {branchResults.map(w => (
                        <li key={w.Ref} className="addr-dropdown-item" onClick={() => selectBranch(w)}>
                          №{w.Number} — {w.Description}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {warehouseError && <span className="addr-field-error">{warehouseError}</span>}
            </div>
          )}

          <button type="submit" className="addr-confirm-btn">
            Confirm Address
          </button>
        </form>
      </div>
    </div>
  );
}

export default V2Checkout;
