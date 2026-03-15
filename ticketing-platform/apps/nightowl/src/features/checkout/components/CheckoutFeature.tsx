import type { CheckoutPaymentMethod } from '../../events/hooks/experienceTypes';
import type { OrderSummary, PaymentIntentSummary, ShoppingCart } from '../../events/types';
import { CheckoutLanePanel } from './CheckoutLanePanel';

export function CheckoutFeature({
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
  onCheckout: () => Promise<void> | void;
  onSelectPaymentMethod: (method: CheckoutPaymentMethod) => void;
  paymentIntent: PaymentIntentSummary | null;
  selectedPaymentMethod: CheckoutPaymentMethod;
}) {
  return (
    <CheckoutLanePanel
      busyKey={busyKey}
      cart={cart}
      currentOrder={currentOrder}
      isPlatformWalletSupported={isPlatformWalletSupported}
      isStripeConfigured={isStripeConfigured}
      onCheckout={() => void onCheckout()}
      onSelectPaymentMethod={onSelectPaymentMethod}
      paymentIntent={paymentIntent}
      selectedPaymentMethod={selectedPaymentMethod}
    />
  );
}
