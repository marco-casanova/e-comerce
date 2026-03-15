import { Pressable, Text, View } from 'react-native';

import { SummaryRow } from '../../../core/ui/components';
import type { CheckoutPaymentMethod } from '../../events/hooks/experienceTypes';
import type { OrderSummary, PaymentIntentSummary, ShoppingCart } from '../../events/types';
import { formatCurrency, formatShortDateTime } from '../../events/utils';
import { styles } from '../../events/components/eventsScreenStyles';

export function CheckoutLanePanel({
  busyKey,
  cart,
  currentOrder,
  isPlatformWalletSupported,
  isStripeConfigured,
  onCheckout,
  onSelectPaymentMethod,
  paymentIntent,
  selectedPaymentMethod,
}: {
  busyKey: string | null;
  cart: ShoppingCart;
  currentOrder: OrderSummary | null;
  isPlatformWalletSupported: boolean;
  isStripeConfigured: boolean;
  onCheckout: () => void;
  onSelectPaymentMethod: (method: CheckoutPaymentMethod) => void;
  paymentIntent: PaymentIntentSummary | null;
  selectedPaymentMethod: CheckoutPaymentMethod;
}) {
  const checkoutAmountCents =
    currentOrder && currentOrder.status === 'pending_payment' ? currentOrder.totalCents : cart.totalCents;
  const checkoutCurrency = currentOrder?.currency ?? 'usd';
  const canCheckout = Boolean(cart.items.length || (currentOrder && currentOrder.status === 'pending_payment'));

  return (
    <View testID="checkout-panel" style={styles.panel}>
      <Text style={styles.panelTitle}>Checkout lane</Text>
      <Text style={styles.eventDescription}>
        Confirm the total, then pay in one Stripe flow. Stripe will collect the required details like card info and
        billing name securely.
      </Text>
      <View style={styles.checkoutAmountCard}>
        <Text style={styles.checkoutAmountLabel}>Amount to pay</Text>
        <Text testID="checkout-amount-value" style={styles.checkoutAmountValue}>
          {formatCurrency(checkoutAmountCents, checkoutCurrency)}
        </Text>
        <Text style={styles.checkoutAmountLabel}>Choose payment method</Text>
        <View style={styles.checkoutMethodRow}>
          <Pressable
            testID="checkout-method-wallet"
            onPress={() => onSelectPaymentMethod('wallet')}
            disabled={!isPlatformWalletSupported}
            style={[
              styles.checkoutMethodChip,
              selectedPaymentMethod === 'wallet' ? styles.checkoutMethodChipActive : null,
              !isPlatformWalletSupported ? styles.buttonDisabled : null,
            ]}
          >
            <Text
              style={[
                styles.checkoutMethodChipText,
                selectedPaymentMethod === 'wallet' ? styles.checkoutMethodChipTextActive : null,
              ]}
            >
              Apple / Google Pay
            </Text>
          </Pressable>
          <Pressable
            testID="checkout-method-card"
            onPress={() => onSelectPaymentMethod('card')}
            style={[
              styles.checkoutMethodChip,
              selectedPaymentMethod === 'card' ? styles.checkoutMethodChipActive : null,
            ]}
          >
            <Text
              style={[
                styles.checkoutMethodChipText,
                selectedPaymentMethod === 'card' ? styles.checkoutMethodChipTextActive : null,
              ]}
            >
              Card and others
            </Text>
          </Pressable>
        </View>
      </View>
      {!isStripeConfigured ? (
        <Text style={styles.eventDescription}>
          In-app Stripe checkout is disabled because `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is missing.
        </Text>
      ) : null}
      {selectedPaymentMethod === 'wallet' && !isPlatformWalletSupported ? (
        <Text style={styles.eventDescription}>Apple Pay / Google Pay is not available on this device right now.</Text>
      ) : null}

      <Pressable
        disabled={!canCheckout || busyKey === 'checkout:pay'}
        onPress={onCheckout}
        testID="checkout-pay-button"
        style={[styles.primaryButton, !canCheckout || busyKey === 'checkout:pay' ? styles.buttonDisabled : null]}
      >
        <Text style={styles.primaryButtonText}>
          {busyKey === 'checkout:pay'
            ? selectedPaymentMethod === 'wallet'
              ? 'Opening wallet checkout...'
              : 'Opening Stripe checkout...'
            : isStripeConfigured
              ? selectedPaymentMethod === 'wallet'
                ? `Pay ${formatCurrency(checkoutAmountCents, checkoutCurrency)} with wallet`
                : `Pay ${formatCurrency(checkoutAmountCents, checkoutCurrency)} with Stripe`
              : 'Create order'}
        </Text>
      </Pressable>
      <Text style={styles.checkoutHelperText}>
        {selectedPaymentMethod === 'wallet'
          ? 'Fast checkout opens Apple Pay or Google Pay when available.'
          : 'Card checkout opens Stripe with card and any other enabled payment methods.'}
      </Text>

      {currentOrder ? (
        <View testID="checkout-order-summary" style={styles.checkoutSummary}>
          <SummaryRow label="Latest order" value={currentOrder.id.slice(0, 8)} />
          <SummaryRow label="Status" value={currentOrder.status} />
          <SummaryRow label="Total" value={formatCurrency(currentOrder.totalCents, currentOrder.currency)} />
          <SummaryRow label="Created" value={formatShortDateTime(currentOrder.createdAt)} />
        </View>
      ) : null}

      {paymentIntent ? (
        <View testID="checkout-payment-summary" style={styles.checkoutSummary}>
          <SummaryRow label="Latest payment" value={paymentIntent.paymentIntentId.slice(0, 10)} />
          <SummaryRow label="Stripe status" value={paymentIntent.status} />
        </View>
      ) : null}
    </View>
  );
}
