import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import V2Header from '../v2-components/V2Header';
import V2Footer from '../v2-components/V2Footer';
import ProductIcon from '../v2-components/ProductIcon';
import '../v2-styles/Checkout.css';
import { SERV_ROOT } from '../consts';
import { cartState, getQtyRule, getQtyRuleHint, initCartState, roundQtyToRule, setCartQty } from '../client/cart';
import { useSnapshot } from 'valtio';
import { t } from '../packages/i18n';
import { fetch } from '../client/core';
import { whoAmI } from '../client/auth';
import { pgREST } from '../client/postgrest';
import { get_key } from '../utils/persistence';
import { Product } from '../types/products';
import { getPromoErrorMessage, validatePromoCode } from '../client/promo';
import { textOr } from '../utils/admin_i18n';
import { displayConfigFieldLabel, localizedLabel, sortConfigFieldsLikeQrCard } from '../utils/product_i18n';
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
  label_uk?: string;
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
  label_uk?: string;
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

// Paket sirasi ve premium kurallari Services & Prices sayfasindakiyle ayni olmali; yukseltme
// teklifi (2.11) oradaki secim mantiginin aynisini uyguluyor.
const CORE_PACKAGE_ORDER = ['standard', 'plus', 'premium'];
const PREMIUM_PACKAGE_ID = 'premium';
const SPONSORED_ADDON_ID = 'advertorial';

const isSponsoredIncludedInPremium = (product?: { sponsored_included?: boolean; advertorial_included?: boolean }) => {
  return product?.sponsored_included === true || product?.advertorial_included === true;
};

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
  // Ne: "Baska bir sey eklemek ister misiniz?" modali (2.11).
  // Nasil: Odeme butonuna ilk basista, tum dogrulamalar gectikten sonra bir kez aciliyor;
  //        upsellAskedRef ayni checkout'ta ikinci kez sorulmasini engelliyor.
  // Neden: Musteri odemeden once yukseltme ve add-on'larin bir kez daha hatirlatilmasini istedi.
  const [showUpsell, setShowUpsell] = useState(false);
  const upsellAskedRef = useRef(false);
  const pendingEmailRef = useRef('');
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
        return;
      }
      // Ne: Sepetten geri yuklenen adedi urunun min_qty/qty_step kuralina oturtur.
      // Neden: Kural urun kaydina sonradan eklendiginde, daha once 1 adet olarak kaydedilmis
      //        QR Card sepette 1 olarak kalir ve checkout gecerli olmayan bir adet gonderir.
      const product = cart.products.find(p => p.id === item.product_uid);
      const corrected = roundQtyToRule(item.quantity, product);
      if (item.quantity > 0 && corrected !== item.quantity) {
        setCartQty(item.product_uid, corrected);
      }
    });
  }, [cart.cartItems, cart.products, cart.init]);

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
      setPromoMessage({ ok: false, text: textOr('checkout.promoRequired', 'Please enter a promo code', 'Будь ласка, введіть промокод') });
      return;
    }

    const cartStateData = await get_key("cart_state");
    if (!cartStateData) {
      setAppliedPromo(null);
      setPromoMessage({ ok: false, text: t('checkout.cartNotFound') });
      return;
    }

    setPromoApplying(true);
    setPromoMessage({ ok: true, text: textOr('checkout.promoApplyingMessage', 'Applying promo code...', 'Застосовуємо промокод...') });
    try {
      const result = await validatePromoCode({
        promo_code: promoCode,
        purchase_info: cartStateData,
      });
      setAppliedPromo(result);
      setPromoMessage({ ok: true, text: textOr(
        'checkout.promoApplied',
        `Promo code ${result.promo_code_text_snapshot} applied.`,
        `Промокод ${result.promo_code_text_snapshot} застосовано.`,
        { code: result.promo_code_text_snapshot },
      ) });
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

  // Ne: Odeme oncesi teklif edilebilecek yukseltme ve sepette olmayan add-on'lari hesaplar (2.11).
  // Nasil: Ana paket siralamasi Services & Prices sayfasindakiyle ayni; sepetteki paketin bir ustu
  //        teklif ediliyor. Premium'a dahil olan sponsorlu add-on listeye alinmiyor.
  // Neden: Modalin ne gosterecegi ve hic acilip acilmayacagi tek kaynaktan gelsin.
  const corePackagesSorted = cart.products
    .filter(p => !p.is_add_on && p.is_enabled)
    .sort((a, b) => {
      const aIdx = CORE_PACKAGE_ORDER.indexOf(a.id);
      const bIdx = CORE_PACKAGE_ORDER.indexOf(b.id);
      if (aIdx === -1 && bIdx === -1) return a.priority - b.priority;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  const currentCorePackage = displayItems.find(({ product }) => !product.is_add_on)?.product;
  const currentCoreIndex = currentCorePackage
    ? corePackagesSorted.findIndex(p => p.id === currentCorePackage.id)
    : -1;
  const nextCorePackage = currentCoreIndex >= 0 && currentCoreIndex < corePackagesSorted.length - 1
    ? corePackagesSorted[currentCoreIndex + 1]
    : null;
  const premiumProduct = cart.products.find(p => p.id === PREMIUM_PACKAGE_ID);
  const isPremiumInCart = cart.cartItems.some(item => item.product_uid === PREMIUM_PACKAGE_ID && item.quantity > 0);
  const isInCart = (productId: string) => cart.cartItems.some(item => item.product_uid === productId && item.quantity > 0);

  const upgradeOffer = nextCorePackage && currentCorePackage
    ? {
        id: nextCorePackage.id,
        name: resolveDisplayTexts(nextCorePackage).name || nextCorePackage.id,
        description: resolveDisplayTexts(nextCorePackage).description || '',
        fromName: resolveDisplayTexts(currentCorePackage).name || currentCorePackage.id,
        // Not: API price'i STRING dondururken ("1790.00") Product tipi number diyor. Aritmetik
        //      calisiyor (JS coercion) ama .toFixed() cagirmak patlar; bu yuzden fiyatlar
        //      modala formatMoney'den gecmis metin olarak veriliyor.
        priceDiffLabel: formatMoney(Math.max(0, Number(nextCorePackage.price) - Number(currentCorePackage.price))),
      }
    : null;

  const upsellAddOns = cart.products
    .filter(p =>
      p.is_add_on
      && p.is_enabled
      && !isInCart(p.id)
      && !(p.id === SPONSORED_ADDON_ID && isPremiumInCart && isSponsoredIncludedInPremium(premiumProduct))
    )
    .map(p => ({
      id: p.id,
      name: resolveDisplayTexts(p).name || p.id,
      priceLabel: formatMoney(Number(p.price)),
      icon: p.options?.icon as string | undefined,
      image: p.options?.image as string | undefined,
      qtyHint: getQtyRuleHint(p),
    }));

  const hasUpsellOffers = Boolean(upgradeOffer) || upsellAddOns.length > 0;

  // Ne: Modaldan yukseltme secildiginde sepeti gunceller.
  // Nasil: Diger ana paketleri sifirlar, secileni 1 adet yapar; premium'a gecildiginde ve
  //        sponsorlu add-on pakete dahilse onu sepetten cikarir.
  // Neden: Services & Prices sayfasindaki coreClick ile ayni kurallar gecerli olmali.
  // Not: setCartQty sepeti IndexedDB'ye yaziyor ve async. Modaldan ekleme yapip hemen
  //      "odemeye devam" denirse placeOrder'in okudugu cart_state eski kalmasin diye await ediliyor.
  const applyUpgrade = async (packageId: string) => {
    for (const pkg of corePackagesSorted) {
      if (pkg.id !== packageId) await setCartQty(pkg.id, 0);
    }
    await setCartQty(packageId, 1);
    if (packageId === PREMIUM_PACKAGE_ID && isSponsoredIncludedInPremium(premiumProduct)) {
      await setCartQty(SPONSORED_ADDON_ID, 0);
    }
  };

  // Add-on sepete 1 degil urunun min_qty degeriyle giriyor; paket add-on icin bu 4.
  const addUpsellAddOn = async (productId: string) => {
    await setCartQty(productId, getQtyRule(cart.products.find(p => p.id === productId)).min);
  };

  // Ne: Dogrulamalar bittikten sonra asil odeme akisini calistirir.
  // Neden: Upsell modali (2.11) araya girdigi icin gonderim, dogrulamadan ayri cagrilabilmeli;
  //        modaldaki "odemeye devam et" ayni fonksiyonu tetikliyor.
  const placeOrder = (email: string) => {
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

  const handleCompleteOrder = (e: React.FormEvent) => {
    e.preventDefault();

    const qs = (x: string) => document.querySelector(x);
    const email = (qs('input[name="email"]') as HTMLInputElement)?.value;
    if (!email) {
      alert(t('checkout.enterEmail'));
      return;
    }

    if (hasPhysical && !shippingAddress) {
      alert(textOr('checkout.shipping.addressRequired', 'Please add a shipping address for physical items.', 'Будь ласка, додайте адресу доставки для фізичних товарів.'));
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
        alert(textOr(
          'checkout.selectDesign',
          `Please select a design for "${resolvedName}".`,
          `Будь ласка, оберіть дизайн для «${resolvedName}».`,
          { product: resolvedName },
        ));
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
          const fieldLabel = displayConfigFieldLabel(field);
          alert(textOr(
            'checkout.fillField',
            `Please fill "${fieldLabel}" for "${resolvedName}".`,
            `Будь ласка, заповніть «${fieldLabel}» для «${resolvedName}».`,
            { field: fieldLabel, product: resolvedName },
          ));
          return;
        }
      }
    }

    // Ne: Odemeye gitmeden once bir kez "eklemek istediginiz baska bir sey var mi?" diye sorar.
    // Nasil: Yalnizca teklif edilecek bir sey varsa ve bu checkout'ta daha once sorulmadiysa acilir;
    //        modal kapatilinca ikinci basista dogrudan odemeye gidilir.
    // Neden: 2.11 — musteri odeme oncesi yukseltme/add-on hatirlatmasi istedi, ama her basista
    //        sormak odeme onunde engel olurdu.
    if (!upsellAskedRef.current && hasUpsellOffers) {
      upsellAskedRef.current = true;
      pendingEmailRef.current = email;
      setShowUpsell(true);
      return;
    }

    placeOrder(email);
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
              {/* Ayirici, Total'in hemen ustundeki satirda durmali: promo varsa indirim satiri,
                  yoksa ara toplam. Onceden bu is "Shipping" satirindaydi, o satir asagi tasindi. */}
              <div className={`checkout-summary-row${appliedPromo ? '' : ' checkout-summary-row-divider'}`}>
                <span className="checkout-summary-row-label">{appliedPromo ? textOr('checkout.grossTotal', 'Gross total', 'Загальна сума') : t('checkout.subtotal')}</span>
                <span className="checkout-summary-row-value">{formatMoney(appliedPromo?.gross_total ?? cart.total)}</span>
              </div>
              {appliedPromo && (
                <div className="checkout-summary-row checkout-summary-discount-row checkout-summary-row-divider">
                  <span className="checkout-summary-row-label">{textOr('checkout.promoDiscount', 'Promo discount', 'Знижка за промокодом')}</span>
                  <span className="checkout-summary-row-value">
                    -{formatMoney(appliedPromo.discount_amount)}
                    {formattedPromoDiscountPercent ? ` (-${formattedPromoDiscountPercent}%)` : ''}
                  </span>
                </div>
              )}
              <div className="checkout-summary-total">
                <span className="checkout-summary-total-label">{appliedPromo ? textOr('checkout.netTotal', 'Net total', 'До сплати') : t('checkout.total')}</span>
                <span className="checkout-summary-total-value">{formatMoney(appliedPromo?.net_total ?? cart.total)}</span>
              </div>
            </div>

            <div className="checkout-promo-section">
              <label className="checkout-email-label">{textOr('checkout.promoLabel', 'Promo code', 'Промокод')}</label>
              <div className="checkout-promo-row">
                <input
                  name="promo_code"
                  className="checkout-promo-input"
                  placeholder={t('checkout.promoPlaceholder')}
                  autoComplete="off"
                  onChange={clearAppliedPromo}
                />
                <button
                  type="button"
                  className="checkout-promo-apply-btn"
                  onClick={handleApplyPromo}
                  disabled={promoApplying}
                >
                  {promoApplying
                    ? textOr('checkout.promoApplyingButton', 'Applying...', 'Застосовуємо...')
                    : textOr('checkout.promoApply', 'Apply', 'Застосувати')}
                </button>
              </div>
              {promoMessage && (
                <p className={promoMessage.ok ? 'checkout-promo-message-ok' : 'checkout-promo-message-error'}>
                  {promoMessage.text}
                </p>
              )}
            </div>

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

              {/* Ne: Kargo aciklamasi ve adres bloğu, siparişi tamamlama butonunun hemen ustunde.
                  Nasil: Aciklama her sepette gorunur ("fiziksel urun siparis ederseniz..." diye
                  kosullu yazilmis); adres alani yalnizca sepette fiziksel urun varsa render edilir.
                  Neden: Musteri 2.9 icin bu iki blogun ozet tablosundan alinip odeme butonunun
                  hemen ustune tasinmasini istedi; boylece adres, ihtiyac duyuldugu anda goze
                  carpiyor ve "Shipping / At Nova Poshta rates" satiri dijital-only sepetlerde
                  yaniltici gorunmuyor. */}
              <div className="checkout-shipping-section">
                <p className="checkout-shipping-note">
                  {textOr(
                    'checkout.shipping.novaPoshtaNote',
                    'If you order physical items, such as QR cards or welcome board, they will be shipped via Nova Poshta, and NP rates will be applied.',
                    'Якщо ви замовите фізичні товари, як-от QR-картки чи вітальний банер, їх буде надіслано службою Nova Poshta, і буде застосовано її тарифи.',
                  )}
                </p>
                {hasPhysical && (
                  <>
                    <div className="checkout-shipping-header">
                      <span className="checkout-email-label">{textOr('checkout.shipping.addressTitle', 'Shipping Address', 'Адреса доставки')}</span>
                      <button
                        type="button"
                        className="checkout-address-btn"
                        onClick={() => setShowAddressModal(true)}
                      >
                        {shippingAddress
                          ? textOr('checkout.shipping.edit', 'Edit', 'Редагувати')
                          : textOr('checkout.shipping.addAddress', '+ Add Shipping Address', '+ Додати адресу доставки')}
                      </button>
                    </div>
                    {shippingAddress && (
                      <div className="checkout-address-preview">
                        <div className="checkout-address-preview-name">{shippingAddress.full_name}</div>
                        <div className="checkout-address-preview-line">{shippingAddress.city_name} — {shippingAddress.warehouse_name}</div>
                        <div className="checkout-address-preview-line">{shippingAddress.phone}</div>
                      </div>
                    )}
                  </>
                )}
              </div>

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

      {showUpsell && (
        <UpsellModal
          upgrade={upgradeOffer}
          addOns={upsellAddOns}
          total={formatMoney(cart.total)}
          onUpgrade={applyUpgrade}
          onAddAddOn={addUpsellAddOn}
          onContinue={() => {
            setShowUpsell(false);
            placeOrder(pendingEmailRef.current);
          }}
          onClose={() => setShowUpsell(false)}
        />
      )}

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
  // Not: Paket add-on'lar (QR Card, Welcome Board) 4'er 4'er artar; satir fiyati adet * birim.
  const { min: minQty, step: qtyStep } = getQtyRule(product);
  const qtyRuleHint = getQtyRuleHint(product);
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
  const visibleConfigFields = sortConfigFieldsLikeQrCard(
    designUsesOverlayPreview(selectedDesign)
      ? configFields.filter(f => activeFieldKeys.has(f.key))
      : configFields,
  );

  return (
    <div className={`checkout-item${isPhysical && designs.length > 0 ? ' checkout-item--physical' : ''}`}>
      {isPhysical && selectedDesign && designUsesOverlayPreview(selectedDesign) ? (
        <BannerCanvas design={selectedDesign} config={config} />
      ) : isPhysical && selectedDesign?.image ? (
        <img
          className="checkout-item-design-preview"
          src={selectedDesign.image}
          alt={localizedLabel(selectedDesign) || displayName}
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
                <label className="checkout-item-config-label">{textOr('checkout.design', 'Design', 'Дизайн')}</label>
                <select
                  className="checkout-item-config-select"
                  value={selectedDesignId}
                  onChange={e => onConfigChange('design_id', e.target.value)}
                >
                  {designs.map(d => (
                    <option key={d.id} value={d.id}>{localizedLabel(d)}</option>
                  ))}
                </select>
              </div>
            )}
            {visibleConfigFields.map(field => {
              // footer_text sorusunu checkout'ta gecici olarak gizliyoruz.
              if (field.key === 'footer_text') return null;
              return (
                <div key={field.key} className="checkout-item-config-field">
                  <label className="checkout-item-config-label">{displayConfigFieldLabel(field)}</label>
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
                      placeholder={overlayPlaceholders[field.key] || displayConfigFieldLabel(field)}
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
            <div className="checkout-item-stepper-group">
              <div className="checkout-item-stepper">
                <button
                  type="button"
                  className="checkout-item-stepper-btn"
                  onClick={() => quantity - qtyStep >= minQty ? onQtyChange(quantity - qtyStep) : onRemove()}
                >−</button>
                <span className="checkout-item-stepper-count">{quantity}</span>
                <button
                  type="button"
                  className="checkout-item-stepper-btn"
                  onClick={() => onQtyChange(quantity + qtyStep)}
                >+</button>
              </div>
              {qtyRuleHint && <span className="checkout-item-qty-rule">{qtyRuleHint}</span>}
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

interface UpsellAddOnOffer {
  id: string;
  name: string;
  priceLabel: string;
  icon?: string;
  image?: string;
  qtyHint?: string;
}

interface UpsellModalProps {
  upgrade: { id: string; name: string; description: string; fromName: string; priceDiffLabel: string } | null;
  addOns: UpsellAddOnOffer[];
  total: string;
  onUpgrade: (packageId: string) => void | Promise<void>;
  onAddAddOn: (productId: string) => void | Promise<void>;
  onContinue: () => void;
  onClose: () => void;
}

// Ne: Odemeye gecmeden once yukseltme ve eksik add-on'lari bir kez hatirlatan modal (2.11).
// Nasil: Teklifler prop olarak plain veri halinde geliyor; secim yapildiginda sepet aninda
//        guncelleniyor ve modal kalan teklifleri yeniden hesaplayarak yeniden ciziliyor.
// Neden: Musteri odeme oncesi "yukseltmek ya da add-on eklemek ister misiniz?" adimini istedi.
//        Modal odemeyi engellemiyor: "odemeye devam et" her zaman bir tik uzakta.
function UpsellModal({ upgrade, addOns, total, onUpgrade, onAddAddOn, onContinue, onClose }: UpsellModalProps) {
  const nothingLeft = !upgrade && addOns.length === 0;

  return (
    <div className="upsell-backdrop" onClick={onClose}>
      <div className="upsell-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <button type="button" className="upsell-close" onClick={onClose} aria-label={t('guestGuestbook.cancel')}>
          <i className="fa-solid fa-xmark" />
        </button>

        <div className="upsell-head">
          <h3 className="upsell-title">
            {textOr('checkout.upsell.title', 'Anything else for your event?', 'Щось іще для вашої події?')}
          </h3>
          <p className="upsell-subtitle">
            {textOr(
              'checkout.upsell.subtitle',
              'You can still upgrade your package or add extras. Nothing is charged until you continue.',
              'Ви ще можете підвищити пакет або додати додатки. Оплата відбудеться лише після переходу далі.',
            )}
          </p>
        </div>

        <div className="upsell-body">
          {nothingLeft && (
            <p className="upsell-empty">
              <i className="fa-solid fa-circle-check" />
              {textOr('checkout.upsell.allSet', 'You have everything we offer — you are all set.', 'У вас є все, що ми пропонуємо — усе готово.')}
            </p>
          )}

          {upgrade && (
            <div className="upsell-upgrade">
              <span className="upsell-upgrade-tag">
                {textOr('checkout.upsell.upgradeTag', 'Upgrade', 'Підвищення')}
              </span>
              <div className="upsell-upgrade-main">
                <p className="upsell-upgrade-name">
                  {upgrade.fromName} <i className="fa-solid fa-arrow-right" /> {upgrade.name}
                </p>
                {upgrade.description && (
                  <p className="upsell-upgrade-desc">{upgrade.description}</p>
                )}
              </div>
              <button type="button" className="upsell-upgrade-btn" onClick={() => onUpgrade(upgrade.id)}>
                +{upgrade.priceDiffLabel}
              </button>
            </div>
          )}

          {addOns.length > 0 && (
            <>
              <p className="upsell-section-label">
                {textOr('checkout.upsell.addOnsLabel', 'Add-ons', 'Додатки')}
              </p>
              <ul className="upsell-addons">
                {addOns.map(addOn => (
                  <li key={addOn.id} className="upsell-addon">
                    {addOn.image
                      ? <div className="upsell-addon-thumb" style={{ backgroundImage: `url("${addOn.image}")` }} />
                      : <div className="upsell-addon-thumb upsell-addon-thumb--icon">
                          {addOn.icon ? <ProductIcon icon={addOn.icon} size={22} /> : <i className="fa-solid fa-gift" />}
                        </div>
                    }
                    <div className="upsell-addon-info">
                      <p className="upsell-addon-name">{addOn.name}</p>
                      <p className="upsell-addon-price">
                        {addOn.priceLabel}{addOn.qtyHint ? ` · ${addOn.qtyHint}` : ''}
                      </p>
                    </div>
                    <button type="button" className="upsell-addon-btn" onClick={() => onAddAddOn(addOn.id)}>
                      <i className="fa-solid fa-plus" />
                      {textOr('checkout.upsell.add', 'Add', 'Додати')}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="upsell-foot">
          <div className="upsell-total">
            <span className="upsell-total-label">{t('checkout.total')}</span>
            <span className="upsell-total-value">{total}</span>
          </div>
          <button type="button" className="upsell-continue" onClick={onContinue}>
            {textOr('checkout.upsell.continue', 'Continue to payment', 'Перейти до оплати')}
            <i className="fa-solid fa-arrow-right" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface AddressModalProps {
  initial: ShippingAddress | null;
  onConfirm: (addr: ShippingAddress) => void;
  onClose: () => void;
}

type NameErrorCode = '' | 'required' | 'digits' | 'tooShort';

// Ne: Ad/soyad alanindaki hatayi hazir metin yerine kod olarak dondurur.
// Neden: Mesaj eskiden `${label} is required` seklinde birlestiriliyordu. Ukraynacada alan
//        adi cumle icinde cekime giriyor ("Вкажіть ім'я" / "Ім'я не може містити цифри"),
//        yani parca birlestirme cevrilemiyor; her alan+durum kombinasyonu tam cumle olarak
//        NAME_ERRORS icinde duruyor.
function validateNamePart(value: string): NameErrorCode {
  const trimmed = value.trim();
  if (!trimmed) return 'required';
  if (/\d/.test(trimmed)) return 'digits';
  if (trimmed.length < 2) return 'tooShort';
  return '';
}

const NAME_ERRORS: Record<'firstName' | 'lastName', Record<Exclude<NameErrorCode, ''>, { key: string; en: string; uk: string }>> = {
  firstName: {
    required: { key: 'checkout.shipping.firstNameRequired', en: 'First name is required', uk: "Вкажіть ім'я" },
    digits: { key: 'checkout.shipping.firstNameDigits', en: 'First name must not contain numbers', uk: "Ім'я не може містити цифри" },
    tooShort: { key: 'checkout.shipping.firstNameTooShort', en: 'First name must be at least 2 characters', uk: "Ім'я має містити щонайменше 2 символи" },
  },
  lastName: {
    required: { key: 'checkout.shipping.lastNameRequired', en: 'Last name is required', uk: 'Вкажіть прізвище' },
    digits: { key: 'checkout.shipping.lastNameDigits', en: 'Last name must not contain numbers', uk: 'Прізвище не може містити цифри' },
    tooShort: { key: 'checkout.shipping.lastNameTooShort', en: 'Last name must be at least 2 characters', uk: 'Прізвище має містити щонайменше 2 символи' },
  },
};

const nameErrorText = (field: 'firstName' | 'lastName', code: NameErrorCode): string => {
  if (!code) return '';
  const entry = NAME_ERRORS[field][code];
  return textOr(entry.key, entry.en, entry.uk);
};

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
  const phoneInvalidText = () => textOr(
    'checkout.shipping.phoneInvalid',
    'Enter a valid Ukrainian mobile number (e.g. +380 99 123 45 67)',
    'Введіть коректний український номер (наприклад, +380 99 123 45 67)',
  );

  const firstNameError = submitted ? nameErrorText('firstName', validateNamePart(firstName)) : '';
  const lastNameError = submitted ? nameErrorText('lastName', validateNamePart(lastName)) : '';
  const phoneError = submitted && !isPhoneValid(phone) ? phoneInvalidText() : '';
  const cityError = submitted && !selectedCity
    ? textOr('checkout.shipping.cityRequired', 'Select a city from the dropdown', 'Оберіть місто зі списку') : '';
  const warehouseError = submitted && selectedCity && !selectedWarehouse
    ? textOr('checkout.shipping.branchRequired', 'Select a Nova Poshta branch', 'Оберіть відділення Нової Пошти') : '';

  // Also show phone error while typing (after first interaction)
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneInlineError = phoneTouched && phone && !isPhoneValid(phone) ? phoneInvalidText() : '';

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
    if (validateNamePart(firstName) || validateNamePart(lastName)) return;
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
          <h3 className="addr-modal-title">{textOr('checkout.shipping.addressTitle', 'Shipping Address', 'Адреса доставки')}</h3>
          <button className="addr-modal-close" onClick={onClose} type="button">✕</button>
        </div>
        <div className="addr-np-notice">
          <i className="fa-solid fa-truck-fast" />
          <span>{textOr(
            'checkout.shipping.npNotice',
            'Delivery via Nova Poshta — you will pick up the order from the nearest branch.',
            'Доставка Новою Поштою — ви заберете замовлення у найближчому відділенні.',
          )}</span>
        </div>
        <form className="addr-modal-form" onSubmit={handleSubmit}>
          <div className="addr-field-row">
            <div className="addr-field-group">
              <label className="addr-label">{textOr('checkout.shipping.firstName', 'FIRST NAME', "ІМ'Я")}</label>
              <input
                className={`addr-input${firstNameError ? ' addr-input--error' : ''}`}
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Іван"
              />
              {firstNameError && <span className="addr-field-error">{firstNameError}</span>}
            </div>
            <div className="addr-field-group">
              <label className="addr-label">{textOr('checkout.shipping.lastName', 'LAST NAME', 'ПРІЗВИЩЕ')}</label>
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
            <label className="addr-label">{textOr('checkout.shipping.phone', 'PHONE', 'ТЕЛЕФОН')}</label>
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
            <label className="addr-label">{textOr('checkout.shipping.city', 'CITY', 'МІСТО')}</label>
            <input
              className={`addr-input${cityError ? ' addr-input--error' : ''}`}
              value={cityQuery}
              onChange={e => searchCities(e.target.value)}
              placeholder={textOr('checkout.shipping.cityPlaceholder', 'Start typing a city...', 'Почніть вводити місто...')}
              autoComplete="off"
            />
            {cityLoading && <div className="addr-dropdown-hint">{textOr('checkout.shipping.searching', 'Searching...', 'Пошук...')}</div>}
            {cityResults.length > 0 && (
              <ul className="addr-dropdown">
                {cityResults.map(c => (
                  <li key={c.DeliveryCity} className="addr-dropdown-item" onClick={() => selectCity(c)}>
                    {c.Present || c.MainDescription}
                    {c.Warehouses > 0 && <span className="addr-dropdown-sub"> · {textOr(
                      'checkout.shipping.branchCount',
                      `${c.Warehouses} branches`,
                      `відділень: ${c.Warehouses}`,
                      { count: c.Warehouses },
                    )}</span>}
                  </li>
                ))}
              </ul>
            )}
            {cityError && <span className="addr-field-error">{cityError}</span>}
          </div>

          {selectedCity && (
            <div className="addr-field-group" style={{ position: 'relative' }}>
              <label className="addr-label">{textOr('checkout.shipping.branch', 'NOVA POSHTA PICKUP BRANCH', 'ВІДДІЛЕННЯ НОВОЇ ПОШТИ')}</label>
              {warehousesLoading ? (
                <div className="addr-dropdown-hint">{textOr('checkout.shipping.loadingBranches', 'Loading branches...', 'Завантаження відділень...')}</div>
              ) : (
                <>
                  <input
                    className={`addr-input${warehouseError ? ' addr-input--error' : ''}`}
                    value={branchQuery}
                    onChange={e => searchBranches(e.target.value)}
                    placeholder={textOr('checkout.shipping.branchPlaceholder', 'Search by branch number or address...', 'Пошук за номером відділення або адресою...')}
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
            {textOr('checkout.shipping.confirm', 'Confirm Address', 'Підтвердити адресу')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default V2Checkout;
