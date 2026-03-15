import { Pressable, Text, View } from 'react-native';

import { EmptyState, QuantityControl, SummaryRow } from '../../../core/ui/components';
import type { CartItem, EventSummary, ShoppingCart } from '../../events/types';
import { formatCurrency } from '../../events/utils';
import { styles } from '../../events/components/eventsScreenStyles';

export function CartItemsPanel({
  busyKey,
  cart,
  onClearCart,
  onUpdateCartItem,
  visibleEvents,
}: {
  busyKey: string | null;
  cart: ShoppingCart;
  onClearCart: () => void;
  onUpdateCartItem: (item: CartItem, nextQuantity: number) => void;
  visibleEvents: EventSummary[];
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Cart</Text>
        <Pressable onPress={onClearCart} disabled={busyKey === 'cart:clear'}>
          <Text style={styles.clearText}>{busyKey === 'cart:clear' ? 'Clearing...' : 'Clear'}</Text>
        </Pressable>
      </View>

      {cart.items.length ? (
        <>
          <View style={styles.stack}>
            {cart.items.map((item) => (
              <View key={item.id} style={styles.cartItemCard}>
                <View style={styles.cartItemCopy}>
                  <Text style={styles.cartItemTitle}>{item.name}</Text>
                  <Text style={styles.cartItemMeta}>
                    {(visibleEvents.find((event) => event.id === item.eventId)?.title ?? 'Event item')}{' '}
                    {item.category ? `· ${item.category}` : ''}
                  </Text>
                  <Text style={styles.cartItemMeta}>{formatCurrency(item.unitPriceCents, 'usd')} each</Text>
                </View>

                <QuantityControl
                  quantity={item.quantity}
                  onDecrease={() => onUpdateCartItem(item, item.quantity - 1)}
                  onIncrease={() => onUpdateCartItem(item, item.quantity + 1)}
                  disabled={busyKey === `cart:${item.id}`}
                />
              </View>
            ))}
          </View>

          <View style={styles.cartFooter}>
            <SummaryRow label="Items" value={String(cart.items.reduce((sum, item) => sum + item.quantity, 0))} />
            <SummaryRow label="Total" value={formatCurrency(cart.totalCents, 'usd')} emphasis />
          </View>
        </>
      ) : (
        <EmptyState
          title="Cart is empty"
          description="Add a ticket or an event extra from the Discover tab."
        />
      )}
    </View>
  );
}
