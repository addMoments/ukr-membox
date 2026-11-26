import { SERV_ROOT } from '../consts';
import { fetch as authFetch, FetchHttpError } from './core';
import type { Product } from '../types/products';
import type { ShippingAddress } from '../v2-partials/V2Checkout';

// Host panelinden paket yukseltme ve ek depolama (Excel 2.18). Backend: ukr-membox-serv
// src/routes/upgrade.go. Odeme normal checkout ile ayni LiqPay formundan gecer; dogrulanmis
// odeme yukseltmeyi uygular ve bekleme sayfasi hostu /event/<uid>?upgrade=done'a geri yollar.

export interface PackageInfo {
  id: string;
  display_name_en: string;
  display_name_uk: string;
  // products.options: storage_gb, media_count, guest_count, storage_days, guest_media_count ...
  options: Record<string, unknown>;
  granted_features: number[];
}

export interface UpgradeOption {
  id: string;
  kind: 'package' | 'storage' | 'time' | 'upload';
  // API price'i sayi olarak donuyor ama digerleri gibi once Number()'dan gecir (formatUah).
  price: number | string;
  display_name_en: string;
  display_name_uk: string;
  to_package?: string;
  to_package_info?: PackageInfo;
  extra_storage_gb?: number;
  extra_storage_months?: number;
  extra_upload_months?: number;
  // Paket yukseltmesinde o paketle ayni odemede alinabilecek ekler (/api/products bicimi; Fatih 23 Kasim 2026,
  // "Option 2"). Bos ya da yoksa yukseltme sayfasi 2. adimi atlar.
  addons?: Product[];
}

export interface UpgradeOptionsResponse {
  current_package: PackageInfo;
  window_open: boolean;
  options: UpgradeOption[];
  max_quantity: number;
}

export interface UpgradeItem {
  product_id: string;
  quantity: number;
}

export const fetchUpgradeOptions = async (packedUid: string): Promise<UpgradeOptionsResponse> => {
  const res = await authFetch(`${SERV_ROOT}/api/event/${packedUid}/upgrades`, {
    headers: { Accept: 'application/json' },
  });
  return res.json();
};

// Paketle birlikte alinan eklerin ayarlari (/addons ile ayni bicim).
export interface UpgradeAddonExtras {
  phone: string;
  buyer_configs: Record<string, string>;
  shipping_address?: ShippingAddress | null;
}

// Ne: Secilen kalemler icin odemeyi acar ve tarayiciyi LiqPay'e gonderir.
// Nasil: POST /api/event/<uid>/upgrade normal /api/purchase ile ayni cevabi doner
//        ({type: 'liqpay_form', data, signature}); form V2Checkout'taki gibi gonderilir.
//        Yerel ortamdaki mock saglayici {url} doner. Paket kaleminin yaninda ek urun kalemleri de
//        gonderilebilir (extras ile telefon, tasarim ayarlari ve Nova Poshta adresi).
//        promoCode yalniz free paketten yukseltmede (Fatih 24 Kasim 2026); %100 kodla tutar 0 ise sunucu
//        LiqPay'siz uygular ve {type: 'redirect', url} doner, asagidaki `url` dali onu izler.
export const startUpgradePayment = async (packedUid: string, items: UpgradeItem[], extras?: UpgradeAddonExtras, promoCode?: string): Promise<void> => {
  const res = await authFetch(`${SERV_ROOT}/api/event/${packedUid}/upgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      items,
      provider_id: 'liqpay',
      ...(promoCode ? { promo_code: promoCode } : {}),
      ...(extras ? {
        phone: extras.phone,
        buyer_configs: extras.buyer_configs,
        ...(extras.shipping_address ? { shipping_address: extras.shipping_address } : {}),
      } : {}),
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

// Backend hata kodu: UPGRADE_WINDOW_CLOSED, UPGRADE_NOT_OFFERED, UPGRADE_INVALID, UPGRADE_EMPTY; eklerle birlikte
// ADDON_NOT_OFFERED, ADDONS_INVALID, SHIPPING_ADDRESS_REQUIRED, INVALID_PHONE.
export const upgradeErrorCode = (err: unknown): string | null => {
  if (!(err instanceof FetchHttpError)) return null;
  if (!err.body || typeof err.body !== 'object') return null;
  return typeof err.body.code === 'string' ? err.body.code : null;
};
