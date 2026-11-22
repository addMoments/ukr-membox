import { SERV_ROOT } from '../consts';
import { fetch as authFetch } from './core';
import { Product } from '../types/products';
import type { ShippingAddress } from '../v2-partials/V2Checkout';
import { UpgradeItem } from './upgrades';

// Sonradan ek urun (add-on) satin alma (Fatih 20 Kasim 2026: her ucretli etkinlik, dijital ve fiziksel;
// free alamaz, yukseltince alabilir). Backend: ukr-membox-serv src/routes/event-addons.go.
// Odeme checkout ile ayni LiqPay formundan gecer; dogrulanmis odeme siparisi etkinlige isler ve
// bekleme sayfasi hostu /event/<uid>?addons=done'a geri yollar.

export interface AddonOptionsResponse {
  current_package: string;
  // false: free paket (once yukseltmeli)
  can_buy: boolean;
  window_open: boolean;
  // /api/products ile ayni bicim; etkinlikte zaten olan dijital ekler (Premium'un reklam alani) listede yok.
  options: Product[];
}

export const fetchAddonOptions = async (packedUid: string): Promise<AddonOptionsResponse> => {
  const res = await authFetch(`${SERV_ROOT}/api/event/${packedUid}/addons`, {
    headers: { Accept: 'application/json' },
  });
  return res.json();
};

export interface AddonPurchaseRequest {
  items: UpgradeItem[];
  phone: string;
  // product_id -> config alanlarinin JSON metni (design_id dahil), checkout ile ayni bicim
  buyer_configs: Record<string, string>;
  shipping_address?: ShippingAddress | null;
}

// Backend hata kodlari: ADDONS_FREE_PACKAGE, ADDON_NOT_OFFERED, ADDONS_INVALID, ADDONS_EMPTY,
// SHIPPING_ADDRESS_REQUIRED, INVALID_PHONE, UPGRADE_WINDOW_CLOSED (upgradeErrorCode ile okunur).
export const startAddonPayment = async (packedUid: string, req: AddonPurchaseRequest): Promise<void> => {
  const res = await authFetch(`${SERV_ROOT}/api/event/${packedUid}/addons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      provider_id: 'liqpay',
      items: req.items,
      phone: req.phone,
      buyer_configs: req.buyer_configs,
      ...(req.shipping_address ? { shipping_address: req.shipping_address } : {}),
    }),
  });
  const data = await res.json();
  if (data.type === 'liqpay_form') {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://www.liqpay.ua/api/3/checkout';
    form.acceptCharset = 'utf-8';
    ['data', 'signature'].forEach((k) => {
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
};
