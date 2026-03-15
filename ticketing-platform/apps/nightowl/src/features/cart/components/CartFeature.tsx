import type { CartItem, EventSummary, ShoppingCart } from '../../events/types';
import { CartItemsPanel } from './CartItemsPanel';

export function CartFeature({
  busyKey,
  cart,
  onClearCart,
  onUpdateCartItem,
  visibleEvents,
}: {
  busyKey: string | null;
  cart: ShoppingCart;
  onClearCart: () => Promise<void> | void;
  onUpdateCartItem: (item: CartItem, nextQuantity: number) => Promise<void> | void;
  visibleEvents: EventSummary[];
}) {
  return (
    <CartItemsPanel
      busyKey={busyKey}
      cart={cart}
      onClearCart={() => void onClearCart()}
      onUpdateCartItem={(item, nextQuantity) => void onUpdateCartItem(item, nextQuantity)}
      visibleEvents={visibleEvents}
    />
  );
}
