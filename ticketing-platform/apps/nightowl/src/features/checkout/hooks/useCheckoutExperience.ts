import { PaymentSheetError, PlatformPay, useStripe } from '@stripe/stripe-react-native';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Platform } from 'react-native';

import { APP_ENV } from '../../../core/config/appConfig';
import {
  isStripeConfigured,
  STRIPE_MERCHANT_DISPLAY_NAME,
  STRIPE_RETURN_URL,
} from '../../../core/payments/stripeConfig';
import { eventsApi } from '../../events/api/eventsApi';
import type { OrderSummary, PaymentIntentSummary, ShoppingCart, TicketPass } from '../../events/types';
import type { BannerState, BusyActionRunner, CheckoutPaymentMethod } from '../../events/hooks/experienceTypes';

type CheckoutOutcome =
  | 'paid'
  | 'already_paid'
  | 'canceled'
  | 'stripe_not_configured'
  | 'requires_external_confirmation';

type CheckoutResult = {
  order: OrderSummary;
  nextCart: ShoppingCart;
  paymentIntent: PaymentIntentSummary;
  ticketSnapshot: TicketPass[] | null;
  outcome: CheckoutOutcome;
};

export function useCheckoutExperience({
  cart,
  runBusyAction,
  setBanner,
  setCart,
  setTickets,
}: {
  cart: ShoppingCart;
  runBusyAction: BusyActionRunner;
  setBanner: Dispatch<SetStateAction<BannerState | null>>;
  setCart: Dispatch<SetStateAction<ShoppingCart>>;
  setTickets: Dispatch<SetStateAction<TicketPass[]>>;
}) {
  const { initPaymentSheet, isPlatformPaySupported, presentPaymentSheet } = useStripe();
  const [currentOrder, setCurrentOrder] = useState<OrderSummary | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntentSummary | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<CheckoutPaymentMethod>('card');
  const [isPlatformWalletSupported, setIsPlatformWalletSupported] = useState(false);

  useEffect(() => {
    if (!isStripeConfigured) {
      return;
    }

    void hydratePlatformWalletSupport();
  }, []);

  async function hydratePlatformWalletSupport() {
    try {
      const supported =
        Platform.OS === 'android'
          ? await isPlatformPaySupported({ googlePay: { testEnv: APP_ENV !== 'production' } })
          : await isPlatformPaySupported();

      setIsPlatformWalletSupported(supported);
      if (supported) {
        setSelectedPaymentMethod(Platform.OS === 'ios' ? 'apple_pay' : 'google_pay');
      } else {
        setSelectedPaymentMethod('card');
      }
    } catch {
      setIsPlatformWalletSupported(false);
      setSelectedPaymentMethod('card');
    }
  }

  function resetCheckoutState() {
    setCurrentOrder(null);
    setPaymentIntent(null);
  }

  async function handleCheckout() {
    const hasPendingOrder = Boolean(currentOrder && currentOrder.status === 'pending_payment');
    if (!cart.items.length && !hasPendingOrder) {
      return;
    }

    await runBusyAction({
      busyKey: 'checkout:pay',
      action: async () => {
        const order = hasPendingOrder && currentOrder ? currentOrder : await eventsApi.createOrderFromCart();
        const nextCart = hasPendingOrder ? cart : await eventsApi.getCart();
        const nextPaymentIntent = await eventsApi.createPaymentIntent(order.id);

        if (nextPaymentIntent.status === 'already_paid') {
          const nextTickets = await eventsApi.listTickets();
          return {
            order,
            nextCart,
            paymentIntent: nextPaymentIntent,
            ticketSnapshot: nextTickets,
            outcome: 'already_paid',
          } satisfies CheckoutResult;
        }

        if (!nextPaymentIntent.clientSecret) {
          throw new Error('Stripe payment intent is missing a client secret.');
        }

        if (eventsApi.getDataSourceMode() === 'mock') {
          return {
            order,
            nextCart,
            paymentIntent: nextPaymentIntent,
            ticketSnapshot: null,
            outcome: 'requires_external_confirmation',
          } satisfies CheckoutResult;
        }

        if (!isStripeConfigured) {
          return {
            order,
            nextCart,
            paymentIntent: nextPaymentIntent,
            ticketSnapshot: null,
            outcome: 'stripe_not_configured',
          } satisfies CheckoutResult;
        }

        const paymentSheetConfig: Parameters<typeof initPaymentSheet>[0] =
          nextPaymentIntent.customerId && nextPaymentIntent.customerEphemeralKeySecret
            ? {
                merchantDisplayName: STRIPE_MERCHANT_DISPLAY_NAME,
                paymentIntentClientSecret: nextPaymentIntent.clientSecret,
                customerId: nextPaymentIntent.customerId,
                customerEphemeralKeySecret: nextPaymentIntent.customerEphemeralKeySecret,
                returnURL: STRIPE_RETURN_URL,
                applePay:
                  selectedPaymentMethod === 'apple_pay'
                    ? {
                        merchantCountryCode: 'US',
                        cartItems: [
                          {
                            label: STRIPE_MERCHANT_DISPLAY_NAME,
                            amount: (order.totalCents / 100).toFixed(2),
                            paymentType: PlatformPay.PaymentType.Immediate,
                          },
                        ],
                      }
                    : undefined,
                googlePay:
                  selectedPaymentMethod === 'google_pay'
                    ? {
                        merchantCountryCode: 'US',
                        currencyCode: order.currency.toUpperCase(),
                        testEnv: APP_ENV !== 'production',
                      }
                    : undefined,
              }
            : {
                merchantDisplayName: STRIPE_MERCHANT_DISPLAY_NAME,
                paymentIntentClientSecret: nextPaymentIntent.clientSecret,
                returnURL: STRIPE_RETURN_URL,
                applePay:
                  selectedPaymentMethod === 'apple_pay'
                    ? {
                        merchantCountryCode: 'US',
                        cartItems: [
                          {
                            label: STRIPE_MERCHANT_DISPLAY_NAME,
                            amount: (order.totalCents / 100).toFixed(2),
                            paymentType: PlatformPay.PaymentType.Immediate,
                          },
                        ],
                      }
                    : undefined,
                googlePay:
                  selectedPaymentMethod === 'google_pay'
                    ? {
                        merchantCountryCode: 'US',
                        currencyCode: order.currency.toUpperCase(),
                        testEnv: APP_ENV !== 'production',
                      }
                    : undefined,
              };

        const initResult = await initPaymentSheet(paymentSheetConfig);
        if (initResult.error) {
          throw new Error(initResult.error.message);
        }

        const paymentResult = await presentPaymentSheet();
        if (paymentResult.error) {
          if (paymentResult.error.code === PaymentSheetError.Canceled) {
            return {
              order,
              nextCart,
              paymentIntent: nextPaymentIntent,
              ticketSnapshot: null,
              outcome: 'canceled',
            } satisfies CheckoutResult;
          }

          throw new Error(paymentResult.error.message);
        }

        const nextTickets = await eventsApi.listTickets();
        return {
          order,
          nextCart,
          paymentIntent: nextPaymentIntent,
          ticketSnapshot: nextTickets,
          outcome: 'paid',
        } satisfies CheckoutResult;
      },
      onSuccess: (checkoutResult) => {
        setCurrentOrder(checkoutResult.order);
        setCart(checkoutResult.nextCart);
        setPaymentIntent(checkoutResult.paymentIntent);

        if (checkoutResult.ticketSnapshot) {
          setTickets(checkoutResult.ticketSnapshot);
        }

        if (checkoutResult.outcome === 'paid') {
          setBanner({
            tone: 'success',
            message:
              'Payment confirmed in Stripe. Your passes will appear as soon as webhook confirmation is processed.',
          });
          return;
        }

        if (checkoutResult.outcome === 'already_paid') {
          setBanner({ tone: 'info', message: 'Order is already paid. Ticket wallet refreshed.' });
          return;
        }

        if (checkoutResult.outcome === 'canceled') {
          setBanner({ tone: 'info', message: 'Stripe checkout was canceled. Your order is still pending payment.' });
          return;
        }

        if (checkoutResult.outcome === 'stripe_not_configured') {
          setBanner({
            tone: 'info',
            message:
              'Order was created, but in-app Stripe checkout is disabled. Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to take payment in the app.',
          });
          return;
        }

        setBanner({
          tone: 'info',
          message:
            'Stripe payment intent created. Demo mode cannot confirm real cards, so complete payment via your webhook test flow.',
        });
      },
    });
  }

  return {
    currentOrder,
    handleCheckout,
    isPlatformWalletSupported,
    paymentIntent,
    resetCheckoutState,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
  };
}
