import { get_key, rm_key, set_key } from "../utils/persistence"
import { CartItem } from "../types/carts";
import { Product } from "../types/products";
import {proxy} from "valtio"
import { SERV_ROOT } from "../consts";

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
            cartState.cartItems.push({product_uid: productId, quantity});
        }
    });
};

const getPaywallProducts = async (): Promise<Product[]> => {
    const res = await fetch(`${SERV_ROOT}/api/products`);
    return res.json();
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

    const products = await getPaywallProducts();
    cartState.products = products;
    await loadCartState();
    deriveCalc();
    console.log(cartState, 'cartState init');
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
    getCartQty
}