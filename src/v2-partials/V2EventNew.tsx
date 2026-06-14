import { useEffect } from 'react';
import { useLoading } from '../contexts/LoadingContext';
import '../v2-styles/EventNew.css';
import { t } from '../packages/i18n';
import { S3_ROOT } from '../consts';
import { Link } from 'react-router-dom';
import { cartState, getCartQty, initCartState, setCartQty } from '../client/cart';
import { useSnapshot } from 'valtio';
import ProductIcon from '../v2-components/ProductIcon';
import V2SignInForm from './V2SignInForm';
import { signInEmail } from '../client/auth';
import { resolvePostSignInRedirect } from '../client/admin';
import { FormState } from '../utils/form_event_parse';
import { LoadingSpinner } from '../contexts/LoadingContext';

interface V2EventNewProps {
  showSignInSection?: boolean;
  onLoadingComplete?: () => void;
}

const PREMIUM_PACKAGE_ID = 'premium';
const SPONSORED_ADDON_ID = 'advertorial';

const isSponsoredIncludedInPremium = (product?: { sponsored_included?: boolean; advertorial_included?: boolean }) => {
  return product?.sponsored_included === true || product?.advertorial_included === true;
};

function V2EventNew({ showSignInSection = false, onLoadingComplete }: V2EventNewProps) {
  const cart = useSnapshot(cartState);
  const currentLang = String(t('lang_code') || 'en');
  const { isLoading } = useLoading();

  const handleSignIn = async (formData: FormState) => {
    try {
      // Services/prices icinden login olan eski panel admin eventsizse no-access ekranina alinmali.
      const result = await signInEmail(
        { email: formData.email, password: formData.password },
        { blockRedirects: true }
      );
      window.location.href = await resolvePostSignInRedirect(result);
    } catch (error) {
      console.error('Sign in error:', error);
      alert(error instanceof Error ? error.message : t('auth.signInFailed'));
    }
  };

  useEffect(() => {
    console.log('[V2EventNew] Mounting, cart.init:', cart.init);
    const initialize = async () => {
      const startTime = Date.now();
      console.log('[V2EventNew] Starting initialization');
      await initCartState();
      console.log('[V2EventNew] Cart initialized, setting loading to false');
      // Ensure loader shows for at least 1 second
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
      }
      console.log('[V2EventNew] Total loading time:', Date.now() - startTime);
      onLoadingComplete?.();
    };
    initialize();
  }, [onLoadingComplete]);

  useEffect(() => {
    if (!cart.init) return;
    const premiumProduct = cart.products.find(p => p.id === PREMIUM_PACKAGE_ID);
    if (
      isSponsoredIncludedInPremium(premiumProduct)
      && getCartQty(PREMIUM_PACKAGE_ID) > 0
      && getCartQty(SPONSORED_ADDON_ID) > 0
    ) {
      setCartQty(SPONSORED_ADDON_ID, 0);
    }
  }, [cart.cartItems, cart.init, cart.products]);

  if (isLoading) {
    console.log('[V2EventNew] Rendering LoadingSpinner (isLoading:', isLoading, ')');
    return <LoadingSpinner />;
  }

  const packageOrder = ['standard', 'plus', 'premium'];
  const corePackages = cart.products
    .filter(p => !p.is_add_on && p.is_enabled)
    .sort((a, b) => {
      const aIdx = packageOrder.indexOf(a.id);
      const bIdx = packageOrder.indexOf(b.id);

      if (aIdx === -1 && bIdx === -1) {
        return a.priority - b.priority;
      }
      if (aIdx === -1) {
        return 1;
      }
      if (bIdx === -1) {
        return -1;
      }
      return aIdx - bIdx;
    });
  const addOns = cart.products.filter(p => p.is_add_on && p.is_enabled);

  const { total, itemCount } = cart;

  const hasCoreSelected = corePackages.some(p => getCartQty(p.id) > 0);
  const premiumProduct = corePackages.find(p => p.id === PREMIUM_PACKAGE_ID);
  const isPremiumSelected = getCartQty(PREMIUM_PACKAGE_ID) > 0;
  const isPremiumSponsoredIncluded = isSponsoredIncludedInPremium(premiumProduct);

  const coreClick = (id: string) => {
    const val = getCartQty(id) > 0 ? 0 : 1;
    if (val) {
      corePackages.forEach(corePackage => {
        if (id !== corePackage.id) setCartQty(corePackage.id, 0);
      });
      if (id === PREMIUM_PACKAGE_ID && isPremiumSponsoredIncluded) setCartQty(SPONSORED_ADDON_ID, 0);
    }
    setCartQty(id, val);
  };

  const addonClick = (id: string) => {
    if (id === SPONSORED_ADDON_ID && isPremiumSelected && isPremiumSponsoredIncluded) return;
    setCartQty(id, getCartQty(id) > 0 ? 0 : 1);
  };

  // Ne: Backend'in display_* alanlarindan gosterilecek isim/aciklama cikarir.
  // Nasil: Aktif dile gore once display_name/display_description alanlarini dener, yoksa diger dil fallback'ine gecer.
  // Neden: product.id teknik anahtar oldugu icin, kullaniciya gorunen metni id'den degil backend'in editable alanlarindan gostermek gerekir.
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

  // Ne: Backend'den gelen display_bullets metnini kartta kullanilacak madde listesine cevirir.
  // Nasil: Aktif dile gore display_bullets_en/uk secilir, newline (\n) ile bolunur ve bos satirlar temizlenir.
  // Neden: Paket maddeleri artik backend tarafindan manuel yonetiliyor; alan bos ise frontend fallback uretmemeli.
  const resolveDisplayBullets = (product: ProductDisplayFields): string[] => {
    const isUk = currentLang === 'uk';
    const rawBullets = isUk
      ? (product.display_bullets_uk || product.display_bullets_en || '')
      : (product.display_bullets_en || product.display_bullets_uk || '');

    if (!rawBullets.trim()) return [];
    return rawBullets
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  };

  return (
    <>
      {showSignInSection && <V2SignInForm onSubmit={handleSignIn} compact />}
      <div className="event-new-page">
      {/* Hero Section */}
      <main className="event-new-main">
        {/* Core Packages Section */}
        <section className="event-new-section">
          <div className="event-new-section-header">
            <div>
              <h2 className="event-new-section-title">{t('paywall.corePackages')}</h2>
              <p className="event-new-section-subtitle">{t('paywall.corePackagesSubtitle')}</p>
            </div>
          </div>

          <div className="event-new-packages-grid">
            {corePackages.map((pkg) => {
              const cartQty = cart.cartItems.find(item => item.product_uid === pkg.id)?.quantity ?? 0;
              return (
                <PackageCard
                  key={pkg.id}
                  id={pkg.id}
                  displayName={resolveDisplayTexts(pkg).name}
                  displayDescription={resolveDisplayTexts(pkg).description}
                  displayBullets={resolveDisplayBullets(pkg)}
                  price={pkg.price}
                  tagText={pkg.options.tagText}
                  isSelected={cartQty > 0}
                  onSelect={() => coreClick(pkg.id)}
                />
              );
            })}
          </div>
        </section>

        {/* Add-ons Section */}
        {addOns.length > 0 && (
          <section className="event-new-section event-new-section-border">
            <div className="event-new-section-header">
              <div>
                <h2 className="event-new-section-title">{t('paywall.addOns')}</h2>
                <p className="event-new-section-subtitle">{t('paywall.addOnsSubtitle')}</p>
              </div>
            </div>

            <div className="event-new-addons-grid">
              {addOns.map((addOn) => {
                const isSponsoredAdvertorial = addOn.id === SPONSORED_ADDON_ID;
                return (
                  <AddOnCard
                    key={addOn.id}
                    id={addOn.id}
                    displayName={resolveDisplayTexts(addOn).name}
                    displayDescription={resolveDisplayTexts(addOn).description}
                    price={addOn.price}
                    icon={addOn.options?.icon}
                    image={addOn.options?.image}
                    mobileImage={addOn.options?.mobile_image}
                    isSponsoredAdvertorial={isSponsoredAdvertorial}
                    isSelected={getCartQty(addOn.id) > 0}
                    isDisabled={isSponsoredAdvertorial && isPremiumSelected && isPremiumSponsoredIncluded}
                    onToggle={() => addonClick(addOn.id)}
                  />
                );
              })}
            </div>
          </section>
        )}
      </main>

      <header className="event-new-hero">
        <div className="event-new-hero-container">
          <div className="event-new-hero-content">
            <span className="event-new-hero-badge">{t('paywall.heroBadge')}</span>
            <h1 className="event-new-hero-title">
              {t('paywall.heroTitle')}
            </h1>
            <p className="event-new-hero-subtitle">
              {t('paywall.heroSubtitle')}
            </p>
          </div>
          <div className="event-new-hero-image">
            <img
              src={S3_ROOT + "/ui/event-new-image.jpg"}
              alt={t('paywall.heroImageAlt')}
            />
            <div className="event-new-hero-image-overlay"></div>
          </div>
        </div>
      </header>

      {/* Fixed Checkout Bar */}
      <div className="event-new-checkout-bar">
        <div className="event-new-checkout-bar-inner">
          <div className="event-new-checkout-info">
            <div className="event-new-checkout-total">
              <span className="event-new-checkout-total-label">{t('paywall.selectedTotal')}</span>
              <span className="event-new-checkout-total-amount">₴{total.toFixed(2)}</span>
            </div>
            <div className="event-new-checkout-divider"></div>
            <span className="event-new-checkout-items">{t('paywall.itemsSelected', { count: itemCount })}</span>
          </div>
          <Link
            style={{ textDecoration: 'none', pointerEvents: hasCoreSelected ? undefined : 'none' }}
            to={hasCoreSelected ? "/checkout" : "#"}
            className={`event-new-checkout-btn${hasCoreSelected ? '' : ' disabled'}`}
          >
            {t('paywall.proceedToCheckout')}
          </Link>
        </div>
      </div>

      {/* Spacing for checkout bar */}
      <div className="event-new-footer-spacing"></div>
      </div>
    </>
  );
}

interface ProductDisplayFields {
  display_name_en?: string;
  display_name_uk?: string;
  display_description_en?: string;
  display_description_uk?: string;
  display_bullets_en?: string;
  display_bullets_uk?: string;
}

interface PackageCardProps {
  id: string;
  displayName?: string;
  displayDescription?: string;
  displayBullets?: string[];
  price: number;
  tagText?: string;
  isSelected: boolean;
  onSelect: () => void;
}

function PackageCard({ id, displayName, displayDescription, displayBullets, price, tagText, isSelected, onSelect }: PackageCardProps) {
  const cardClass = `event-new-package-card ${tagText ? 'recommended' : ''} ${isSelected ? 'selected' : ''}`;
  const resolvedName = displayName || id;
  const resolvedDescription = displayDescription || '';
  const resolvedFeatures = Array.isArray(displayBullets) ? displayBullets : [];

  return (
    <div className={cardClass} onClick={onSelect}>
      {tagText && (
        <div className="event-new-package-badge">{tagText}</div>
      )}
      <div className="event-new-package-header">
        <h3 className="event-new-package-name">{resolvedName}</h3>
        <div className="event-new-package-price">
          <span className="event-new-package-price-amount">₴{price}</span>
          <span className="event-new-package-price-unit">{"UAH"}</span>
        </div>
        <p className="event-new-package-description">{resolvedDescription}</p>
      </div>
      {resolvedFeatures.length > 0 && (
        <ul className="event-new-package-features">
          {resolvedFeatures.map((feature, index) => (
            <li key={index} className="event-new-package-feature">
              <i className="fa-solid fa-check event-new-package-feature-icon"></i>
              {feature}
            </li>
          ))}
        </ul>
      )}
      <div className="event-new-package-footer">
        <span className="event-new-package-select-label">{t('paywall.selectPackage')}</span>
        <input
          type="checkbox"
          className="event-new-checkbox"
          checked={isSelected}
          onChange={onSelect}
          style={{ pointerEvents: 'none' }}
        />
      </div>
    </div>
  );
}

interface AddOnCardProps {
  id: string;
  displayName?: string;
  displayDescription?: string;
  price: number;
  icon?: string;
  image?: string;
  mobileImage?: string;
  isSponsoredAdvertorial?: boolean;
  isSelected: boolean;
  isDisabled?: boolean;
  onToggle: () => void;
}

function AddOnCard({ id, displayName, displayDescription, price, icon, image, mobileImage, isSponsoredAdvertorial = false, isSelected, isDisabled = false, onToggle }: AddOnCardProps) {
  const cardClass = [
    'event-new-addon-card',
    image ? 'event-new-addon-card-image' : '',
    isSponsoredAdvertorial ? 'event-new-addon-card-sponsored' : '',
    isSelected ? 'selected' : '',
    isDisabled ? 'disabled' : '',
  ].filter(Boolean).join(' ');
  const resolvedName = displayName || id;
  const resolvedDescription = displayDescription || '';
  const hasMobileImage = Boolean(mobileImage);

  // Ne: Sponsored Ad Slot add-on'u icin desktop'ta banner'a donusecek ozel markup'u render eder.
  // Nasil: Desktop icin options.image, mobil icin varsa options.mobile_image yoksa image fallback'ini picture ile kullanir.
  // Neden: Admin panelden web ve mobil gorseller ayri yonetilebilirken advertorial add-on'u webde tum satiri kaplayabilsin.
  if (isSponsoredAdvertorial) {
    return (
      <div className={cardClass} onClick={isDisabled ? undefined : onToggle}>
        {image ? (
          <div className="event-new-sponsored-addon-image">
            <picture>
              {hasMobileImage && <source media="(max-width: 767px)" srcSet={mobileImage} />}
              <img src={image} alt={resolvedName} />
            </picture>
          </div>
        ) : (
          <div className="event-new-sponsored-addon-placeholder">
            {icon ? <ProductIcon icon={icon} /> : <i className="fa-solid fa-bullhorn" />}
            <div>
              <h3 className="event-new-addon-name">{resolvedName}</h3>
              <p className="event-new-addon-description">{resolvedDescription}</p>
            </div>
          </div>
        )}
        <div className="event-new-sponsored-addon-footer">
          <span className="event-new-addon-price">₴{price}</span>
          <input
            type="checkbox"
            className="event-new-checkbox"
            checked={isSelected}
            onChange={isDisabled ? undefined : onToggle}
            disabled={isDisabled}
            style={{ pointerEvents: 'none' }}
          />
        </div>
      </div>
    );
  }

  const inner = (
    <>
      {icon && !image && <ProductIcon icon={icon} />}
      <h3 className="event-new-addon-name">{resolvedName}</h3>
      <p className="event-new-addon-description">{resolvedDescription}</p>
      <div className="event-new-addon-footer">
        <span className="event-new-addon-price">₴{price}</span>
        <input
          type="checkbox"
          className="event-new-checkbox"
          checked={isSelected}
          onChange={isDisabled ? undefined : onToggle}
          disabled={isDisabled}
          style={{ pointerEvents: 'none' }}
        />
      </div>
    </>
  );

  return (
    <div className={cardClass} onClick={isDisabled ? undefined : onToggle}>
      {image ? (
        <>
          <div className="event-new-addon-image-wrap">
            <picture>
              {hasMobileImage && <source media="(max-width: 767px)" srcSet={mobileImage} />}
              <img src={image} alt={resolvedName} />
            </picture>
          </div>
          <div className="event-new-addon-content">{inner}</div>
        </>
      ) : inner}
    </div>
  );
}

export default V2EventNew;
