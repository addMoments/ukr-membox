/*CREATE TYPE CART_ITEM_STATUS AS ENUM ('cart', 'pending', 'purchased', 'fulfilled', 'cancelled');

CREATE TABLE cart_items (
    cart_uid UUID NOT NULL REFERENCES carts(uid),
    product_uid UUID NOT NULL,
    quantity INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note TEXT DEFAULT '',
    status CART_ITEM_STATUS NOT NULL DEFAULT 'cart',
    UNIQUE (cart_uid, product_uid)
);

*/

import { Product } from "./products";

export type CartItemStatus = 'cart' | 'pending' | 'purchased' | 'fulfilled' | 'cancelled' | 'client-action' | 'admin-action' | 'shipped';

export interface CartItem {
  uid?: string;
  cart_uid?: string;
  product_uid: string;
  quantity: number;
  note?: string;
  created_at?: string;
  status?: CartItemStatus;
  tracking_number?: string;
  carrier?: string;
  buyer_config?: Record<string, any>;
}

export const getBtnTitle = (cartItem: CartItem, product: Product) => {
  if (product.fullfillment_type === 'digital') {
    return 'Use';
  } else {
    if (cartItem.status === 'client-action'){
      if (!cartItem.note){
        return 'Redeem';
      } else {
        return 'Answer';
      }
    } else {
      return 'View';
      
    }
  }
}