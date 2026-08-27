import { get_key, rm_key, set_key } from "../utils/persistence"
import { CartItem } from "../types/carts";
import { Product } from "../types/products";
import {proxy} from "valtio"
import { SERV_ROOT } from "../consts";
import { textOr } from "../utils/admin_i18n";

const cartState = proxy({
    products: [] as Product[],
    cartItems: [] as CartItem[],
    init: false,
    total: 0,
    itemCount: 0
});

const setCartQty = async (productId: string, quantity: number) => {
    const cartIdx = cartState.cartItems.findIndex(item => item.product_uid === productId);
    if (cartIdx !== -1) {
        cartState.cartItems[cartIdx].quantity = quantity;
    } else {
        cartState.cartItems.push({product_uid: productId, quantity});
    }
    deriveCalc();
    saveCartState();
}

// Adet stepper'i olmayan add-on'lar (sesli misafir defteri, advertorial). Bunlar tek adet satilir.
const SINGLE_QUANTITY_ADDON_IDS = new Set(['audioGuestbook', 'audiobook', 'advertorial', 'sponsored']);
// 4'luk bloklar halinde basilan add-on'lar. Yalnizca QR kart; Welcome Board birer birer satilir.
const PACK_QTY_ADDON_IDS = new Set(['printedBanner']);
const PACK_QTY_STEP = 4;

// Ne: Bir urunun satis adedi kurallarini okur: en az kac adet ve kacar kacar artar.
// Nasil: Yalnizca PACK_QTY_ADDON_IDS icindeki add-on'lar (QR Card) 4/4 doner.
//        Diger urunler options.min_qty / qty_step okur, yoksa 1.
// Neden: QR kart tek sayfaya 4 adet basildigi icin 4'luk bloklarla satiliyor; Welcome Board
//        gibi tek parca basilan add-on'larda boyle bir kisit yok, 1 adet de satilabiliyor.
const getQtyRule = (product?: Pick<Product, 'options' | 'is_add_on' | 'id'> | null): { min: number; step: number } => {
    const toPositiveInt = (value: unknown) => {
        const parsed = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
    };
    const isPackAddon = Boolean(product?.is_add_on) && PACK_QTY_ADDON_IDS.has(product?.id || '');
    if (isPackAddon) {
        return { min: PACK_QTY_STEP, step: PACK_QTY_STEP };
    }
    return {
        min: toPositiveInt(product?.options?.min_qty),
        step: toPositiveInt(product?.options?.qty_step),
    };
};

// Ne: Serbest bir adedi urunun min_qty/qty_step kuralina oturtur.
// Nasil: min'in altini min'e cikarir, ustunu min + (step'in tam kati) degerine yuvarlar.
// Neden: Yalnizca stepper degil, eski cart state'inden geri yuklenen adetler de ayni kuraldan
//        gecsin; aksi halde kural eklenmeden once sepete atilmis 1 adet QR Card 1 olarak kalir.
const roundQtyToRule = (quantity: number, product?: Pick<Product, 'options' | 'is_add_on' | 'id'> | null): number => {
    const { min, step } = getQtyRule(product);
    if (quantity <= 0) return 0;
    if (quantity <= min) return min;
    return min + Math.round((quantity - min) / step) * step;
};

// Ne: Adet kurali tanimli urunler icin kullaniciya gosterilecek kisa uyari metnini uretir.
// Nasil: getQtyRule sonucundan okur; kural yoksa (min ve step 1) bos string doner, boylece
//        cagiran taraf ekstra kosul yazmadan render edebilir.
// Neden: Paket add-on sepete 1 degil 4 adet giriyor ve "-" tusu 4'un altinda urunu siliyor;
//        bunu soylemeyen bir stepper kullaniciya bozuk gorunuyor.
const getQtyRuleHint = (product?: Pick<Product, 'options' | 'is_add_on' | 'id'> | null): string => {
    const { min, step } = getQtyRule(product);
    if (min <= 1 && step <= 1) return '';
    return textOr(
        'common.qtyRule',
        `Minimum ${min}, in multiples of ${step}`,
        `Мінімум ${min}, кратно ${step}`,
        { min, step },
    );
};

const findProduct = (productId: string) => cartState.products.find(product => product.id === productId);

const getCartQty = (productId: string) => {
    const item = cartState.cartItems.find(item => item.product_uid === productId);
    return item ? item.quantity : 0;
}

const saveCartState = async () => {
    const state: Record<string, number> = {};

    cartState.cartItems.forEach(item => {
        if (!item.quantity){return}
        state[item.product_uid] = item.quantity;
    });

    await set_key("cart_state", state);
};

const loadCartState = async () => {
    const state = await get_key("cart_state").catch(() => null);
    if (!state) return;

    if (!cartState.products){
        throw new Error("Products not loaded");
    }

    Object.keys(state).forEach(productId => {
        const quantity = state[productId];
        const product = cartState.products.find(product => product.id === productId);
        if (product) {
            cartState.cartItems.push({product_uid: productId, quantity: roundQtyToRule(quantity, product)});
        }
    });
};

const getPaywallProducts = async (): Promise<Product[]> => {
    try {
        const res = await fetch(`${SERV_ROOT}/api/products`);
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}

const deriveCalc = ()=>{
    let total = 0;
    let itemCount = 0;
    for (let i=0; i<cartState.cartItems.length; i++){
        const item = cartState.cartItems[i];
        const product = cartState.products.find(product => product.id === item.product_uid);
        if (product) {
            total += product.price * item.quantity;
            itemCount += item.quantity;
        }
    }
    cartState.total = total;
    cartState.itemCount = itemCount;
}

const initCartState = async () => {
    if (cartState.init) return;
    cartState.init = true;

    try {
        const products = await getPaywallProducts();
        cartState.products = products;
        await loadCartState();
        deriveCalc();
    } catch (e) {
        console.error('[cart] initCartState failed:', e);
    }
}

const clearCartState = async () => {
    cartState.cartItems = [];
    cartState.total = 0;
    cartState.itemCount = 0;
    await rm_key("cart_state").catch(() => {});
}



export {
    getPaywallProducts,
    initCartState,
    clearCartState,
    cartState,
    setCartQty,
    getCartQty,
    getQtyRule,
    getQtyRuleHint,
    roundQtyToRule,
    findProduct
}