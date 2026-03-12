import { Pressable, Text, View } from 'react-native';

import type { CartItem, EventSummary, OrderSummary, PaymentIntentSummary, ShoppingCart } from '../../types';
import { formatCurrency, formatShortDateTime } from '../../utils';
import { EmptyState, QuantityControl, SummaryRow } from '../EventUi';
import { styles } from '../eventsScreenStyles';

export function CartPanel({
  busyKey,
  cart,
  currentOrder,
  isStripeConfigured,
  onClearCart,
  onCreateOrder,
  onPreparePayment,
  onUpdateCartItem,
  paymentIntent,
  visibleEvents,
}: {
  busyKey: string | null;
  cart: ShoppingCart;
  currentOrder: OrderSummary | null;
  isStripeConfigured: boolean;
  onClearCart: () => void;
  onCreateOrder: () => void;
  onPreparePayment: () => void;
  onUpdateCartItem: (item: CartItem, nextQuantity: number) => void;
  paymentIntent: PaymentIntentSummary | null;
  visibleEvents: EventSummary[];
}) {
  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Checkout lane</Text>
        <Text style={styles.eventDescription}>
          Create an order from the cart first, then open Stripe checkout in-app. Ticket passes appear after the Stripe
          webhook confirms payment.
        </Text>
        {!isStripeConfigured ? (
          <Text style={styles.eventDescription}>
            In-app card capture is disabled because `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is missing.
          </Text>
        ) : null}

        <View style={styles.checkoutRow}>
          <Pressable
            disabled={!cart.items.length || busyKey === 'checkout:create-order'}
            onPress={onCreateOrder}
            style={[
              styles.primaryButton,
              !cart.items.length || busyKey === 'checkout:create-order' ? styles.buttonDisabled : null,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {busyKey === 'checkout:create-order' ? 'Creating order...' : 'Create order'}
            </Text>
          </Pressable>

          <Pressable
            disabled={!currentOrder || busyKey === 'checkout:payment-intent'}
            onPress={onPreparePayment}
            style={[
              styles.secondaryButton,
              !currentOrder || busyKey === 'checkout:payment-intent' ? styles.buttonDisabled : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {busyKey === 'checkout:payment-intent'
                ? 'Opening Stripe...'
                : isStripeConfigured
                  ? 'Pay with Stripe'
                  : 'Prepare Stripe'}
            </Text>
          </Pressable>
        </View>

        {currentOrder ? (
          <View style={styles.checkoutSummary}>
            <SummaryRow label="Order" value={currentOrder.id.slice(0, 8)} />
            <SummaryRow label="Status" value={currentOrder.status} />
            <SummaryRow label="Total" value={formatCurrency(currentOrder.totalCents, currentOrder.currency)} />
            <SummaryRow label="Created" value={formatShortDateTime(currentOrder.createdAt)} />
          </View>
        ) : null}

        {paymentIntent ? (
          <View style={styles.checkoutSummary}>
            <SummaryRow label="Intent" value={paymentIntent.paymentIntentId.slice(0, 10)} />
            <SummaryRow label="Stripe status" value={paymentIntent.status} />
            <SummaryRow label="Client secret" value={paymentIntent.clientSecret ? 'Ready' : 'Unavailable'} />
          </View>
        ) : null}
      </View>

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
    </>
  );
}
