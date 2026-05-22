import { useRef } from 'react';
import { Product } from '../types/products';
import { CartItem } from '../types/carts';
import { t } from '../packages/i18n';
import '../v2-styles/PurchasedAddonsBox.css';

export interface ProductDisplay {
  name: string;
  description: string;
  features?: string[];
  instruction?: string;
}

interface PurchasedAddon {
  product: Product;
  cartItem: CartItem;
}

interface PurchasedAddonsBoxProps {
  addons: PurchasedAddon[];
  onRedeem: (product: Product, cartItem: CartItem) => void;
}

function PurchasedAddonsBox({ addons, onRedeem }: PurchasedAddonsBoxProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollerRef.current) return;
    const scrollAmount = 300;
    scrollerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  if (addons.length === 0) {
    return null;
  }


  const getBtnTitle = (cartItem: CartItem, product: Product) => {
    if (product.fullfillment_type === 'digital') {
      return t('addons.use');
    } else {
      if (cartItem.status === 'client-action'){
        if (!cartItem.note){
          return t('addons.redeem');
        } else {
          return t('addons.answer');
        }
      } else {
        return t('addons.view');

      }
    }
  }

  const getStatusPill = (cartItem: CartItem, product: Product) => {
    if (product.fullfillment_type === 'digital') return null;
    switch (cartItem.status) {
      case 'purchased':
      case 'client-action':
        return { label: t('addons.statusPreparing'), color: '#92400e', bg: '#fef3c7' };
      case 'admin-action':
        return { label: t('addons.statusProcessing'), color: '#1e40af', bg: '#dbeafe' };
      case 'shipped':
        return { label: t('addons.statusShipped'), color: '#5b21b6', bg: '#ede9fe' };
      case 'fulfilled':
        return { label: t('addons.statusDelivered'), color: '#166534', bg: '#dcfce7' };
      case 'cancelled':
        return { label: t('addons.statusCancelled'), color: '#991b1b', bg: '#fee2e2' };
      default:
        return null;
    }
  }

  // Ne: Satin alinmis fiziksel add-on kartinda gosterilecek en dogru gorseli bulur.
  // Nasil: buyer_config.design_id varsa product.options.designs listesinden secili tasarimi arar; yoksa urunun genel gorseline duser.
  // Neden: Welcome Board ve QR Card statik tasarim secimiyle calistigi icin event dashboard'da secilen tasarim gorunmelidir.
  const resolveAddonImage = (product: Product, cartItem: CartItem) => {
    const designs = product.options?.designs || [];
    const selectedDesign = designs.find((design: { id: string; image?: string }) => {
      return design.id === cartItem.buyer_config?.design_id;
    });
    return selectedDesign?.image || product.options?.image || '';
  };


  return (
    <div className="pab">
      <div className="pab-header">
        <h2 className="pab-title">{t('addons.purchasedTitle')}</h2>
        <div className="pab-nav">
          <button 
            className="pab-nav-btn" 
            onClick={() => scroll('left')}
            aria-label={t('addons.scrollLeft')}
          >
            <i className="fa-solid fa-chevron-left" />
          </button>
          <button 
            className="pab-nav-btn" 
            onClick={() => scroll('right')}
            aria-label={t('addons.scrollRight')}
          >
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>
      </div>
      <div className="pab-scroller" ref={scrollerRef}>
        {addons.filter(x => x.product.fullfillment_type === "physical").map(({ product, cartItem }) => {
          const display: ProductDisplay = t("products." + product.id, { returnObjects: true }) as ProductDisplay;
          const addonImage = resolveAddonImage(product, cartItem);
          return (
            <div key={product.id} className="pab-card">
              {cartItem.quantity > 1 && (
                <span className="pab-card-badge">x{cartItem.quantity}</span>
              )}
              <div className="pab-card-image">
                {addonImage ? (
                  <img src={addonImage} alt={display.name} />
                ) : (
                  <div className="pab-card-image-placeholder">
                    <i className={product.options?.icon || "fa-solid fa-gift"} />
                  </div>
                )}
              </div>
              <h3 className="pab-card-title">{display.name}</h3>
              {(() => {
                const pill = getStatusPill(cartItem, product);
                return pill ? (
                  <span className="pab-status-pill" style={{ color: pill.color, background: pill.bg }}>
                    {pill.label}
                  </span>
                ) : null;
              })()}
              <button
                className="pab-redeem-btn"
                onClick={() => onRedeem(product, cartItem)}
              >
                {getBtnTitle(cartItem, product)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PurchasedAddonsBox;
