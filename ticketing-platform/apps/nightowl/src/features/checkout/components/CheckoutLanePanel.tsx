import { Platform, Pressable, Text, View } from "react-native";

import { EmptyState, SummaryRow } from "../../../core/ui/components";
import type { CheckoutPaymentMethod } from "../../events/hooks/experienceTypes";
import type {
  OrderSummary,
  PaymentIntentSummary,
  ShoppingCart,
} from "../../events/types";
import { formatCurrency, formatShortDateTime } from "../../events/utils";
import { styles } from "../../events/components/eventsScreenStyles";

type PaymentMethodMeta = {
  label: string;
  caption: string;
  buttonLabel: string;
  busyLabel: string;
  helperText: string;
  flow: string;
  confirmation: string;
  availability: string;
  paymentSummaryLabel: string;
  paymentStatusLabel: string;
  isAvailable: boolean;
};

function ApplePayIcon() {
  return (
    <View style={styles.checkoutMethodIconShell}>
      <View style={[styles.applePayLobe, styles.applePayLobeLeft]} />
      <View style={[styles.applePayLobe, styles.applePayLobeRight]} />
      <View style={styles.applePayBody} />
      <View style={styles.applePayLeaf} />
      <View style={styles.applePayBite} />
    </View>
  );
}

function GooglePayIcon() {
  return (
    <View style={styles.checkoutMethodIconShell}>
      <View
        style={[
          styles.googlePayStroke,
          styles.googlePayBlue,
          styles.googlePayStrokeLeft,
        ]}
      />
      <View
        style={[
          styles.googlePayStroke,
          styles.googlePayRed,
          styles.googlePayStrokeTop,
        ]}
      />
      <View
        style={[
          styles.googlePayStroke,
          styles.googlePayYellow,
          styles.googlePayStrokeMiddle,
        ]}
      />
      <View
        style={[
          styles.googlePayStroke,
          styles.googlePayGreen,
          styles.googlePayStrokeRight,
        ]}
      />
    </View>
  );
}

function CardPayIcon() {
  return (
    <View style={styles.checkoutMethodIconShell}>
      <View style={styles.cardPayOutline}>
        <View style={styles.cardPayStripe} />
        <View style={styles.cardPayChip} />
      </View>
    </View>
  );
}

function PaymentMethodIcon({ method }: { method: CheckoutPaymentMethod }) {
  if (method === "apple_pay") {
    return <ApplePayIcon />;
  }

  if (method === "google_pay") {
    return <GooglePayIcon />;
  }

  return <CardPayIcon />;
}

function getPaymentMethodMeta(
  method: CheckoutPaymentMethod,
  isPlatformWalletSupported: boolean,
): PaymentMethodMeta {
  const applePayAvailable = Platform.OS === "ios" && isPlatformWalletSupported;
  const googlePayAvailable =
    Platform.OS === "android" && isPlatformWalletSupported;

  if (method === "apple_pay") {
    return {
      label: "Apple Pay",
      caption: "Face ID / Touch ID",
      buttonLabel: "Apple Pay",
      busyLabel: "Opening Apple Pay...",
      helperText: applePayAvailable
        ? "Fast checkout opens the Apple Pay sheet and confirms with Face ID or Touch ID."
        : "Apple Pay is available on supported iPhone devices with Wallet enabled.",
      flow: "Apple Pay sheet",
      confirmation: "Face ID / Touch ID",
      availability: applePayAvailable
        ? "Ready on this device"
        : "Unavailable on this device",
      paymentSummaryLabel: "Latest Apple Pay intent",
      paymentStatusLabel: "Wallet status",
      isAvailable: applePayAvailable,
    };
  }

  if (method === "google_pay") {
    return {
      label: "Google Pay",
      caption: "Google Wallet",
      buttonLabel: "Google Pay",
      busyLabel: "Opening Google Pay...",
      helperText: googlePayAvailable
        ? "Fast checkout opens Google Pay and confirms through the device wallet flow."
        : "Google Pay is available on supported Android devices with Google Wallet.",
      flow: "Google Pay sheet",
      confirmation: "Google Wallet approval",
      availability: googlePayAvailable
        ? "Ready on this device"
        : "Unavailable on this device",
      paymentSummaryLabel: "Latest Google Pay intent",
      paymentStatusLabel: "Wallet status",
      isAvailable: googlePayAvailable,
    };
  }

  return {
    label: "Card Pay",
    caption: "Stripe sheet",
    buttonLabel: "card",
    busyLabel: "Opening card checkout...",
    helperText:
      "Card checkout opens Stripe with card details and any other enabled fallback methods.",
    flow: "Stripe payment sheet",
    confirmation: "Card details + billing",
    availability: "Always available",
    paymentSummaryLabel: "Latest card intent",
    paymentStatusLabel: "Stripe status",
    isAvailable: true,
  };
}

function PaymentMethodOption({
  isActive,
  isDisabled,
  method,
  meta,
  onPress,
  testID,
}: {
  isActive: boolean;
  isDisabled: boolean;
  method: CheckoutPaymentMethod;
  meta: PaymentMethodMeta;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, selected: isActive }}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.checkoutMethodCard,
        isActive ? styles.checkoutMethodCardActive : null,
        isDisabled ? styles.checkoutMethodCardDisabled : null,
      ]}
      testID={testID}
    >
      <PaymentMethodIcon method={method} />
      <Text
        style={[
          styles.checkoutMethodTitle,
          isActive ? styles.checkoutMethodTitleActive : null,
        ]}
      >
        {meta.label}
      </Text>
      <Text
        style={[
          styles.checkoutMethodCaption,
          isActive ? styles.checkoutMethodCaptionActive : null,
        ]}
      >
        {meta.caption}
      </Text>
    </Pressable>
  );
}

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
  const hasPendingOrder = Boolean(
    currentOrder &&
    currentOrder.status === "pending_payment" &&
    currentOrder.totalCents > 0,
  );
  const hasCartValue = cart.items.length > 0 && cart.totalCents > 0;
  const checkoutAmountCents =
    hasPendingOrder && currentOrder ? currentOrder.totalCents : cart.totalCents;
  const checkoutCurrency = currentOrder?.currency ?? "usd";
  const canCheckout = hasCartValue || hasPendingOrder;
  const selectedMethodMeta = getPaymentMethodMeta(
    selectedPaymentMethod,
    isPlatformWalletSupported,
  );
  const applePayMeta = getPaymentMethodMeta(
    "apple_pay",
    isPlatformWalletSupported,
  );
  const googlePayMeta = getPaymentMethodMeta(
    "google_pay",
    isPlatformWalletSupported,
  );
  const cardPayMeta = getPaymentMethodMeta("card", isPlatformWalletSupported);
  const checkoutDisabled =
    !canCheckout ||
    busyKey === "checkout:pay" ||
    (isStripeConfigured && !selectedMethodMeta.isAvailable);

  if (!canCheckout) {
    return (
      <View testID="checkout-panel" style={styles.panel}>
        <Text style={styles.panelTitle}>Checkout lane</Text>
        <EmptyState
          testID="checkout-empty-state"
          title="Add items to your basket"
          description="Choose a ticket or event extra from the Discover tab to see the amount to pay and payment options."
        />
      </View>
    );
  }

  return (
    <View testID="checkout-panel" style={styles.panel}>
      <Text style={styles.panelTitle}>Checkout lane</Text>
      <Text style={styles.eventDescription}>
        Confirm the total, then pay in one Stripe flow. Stripe will collect the
        required details like card info and billing name securely.
      </Text>
      <View style={styles.checkoutAmountCard}>
        <Text style={styles.checkoutAmountLabel}>Amount to pay</Text>
        <Text testID="checkout-amount-value" style={styles.checkoutAmountValue}>
          {formatCurrency(checkoutAmountCents, checkoutCurrency)}
        </Text>
        <Text style={styles.checkoutAmountLabel}>Choose payment method</Text>
        <View style={styles.checkoutMethodRow}>
          <PaymentMethodOption
            isActive={selectedPaymentMethod === "apple_pay"}
            isDisabled={!applePayMeta.isAvailable}
            method="apple_pay"
            meta={applePayMeta}
            onPress={() => onSelectPaymentMethod("apple_pay")}
            testID="checkout-method-apple-pay"
          />
          <PaymentMethodOption
            isActive={selectedPaymentMethod === "google_pay"}
            isDisabled={!googlePayMeta.isAvailable}
            method="google_pay"
            meta={googlePayMeta}
            onPress={() => onSelectPaymentMethod("google_pay")}
            testID="checkout-method-google-pay"
          />
          <PaymentMethodOption
            isActive={selectedPaymentMethod === "card"}
            isDisabled={false}
            method="card"
            meta={cardPayMeta}
            onPress={() => onSelectPaymentMethod("card")}
            testID="checkout-method-card"
          />
        </View>
      </View>

      <Pressable
        disabled={checkoutDisabled}
        onPress={onCheckout}
        testID="checkout-pay-button"
        style={[
          styles.primaryButton,
          checkoutDisabled ? styles.buttonDisabled : null,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {busyKey === "checkout:pay"
            ? selectedMethodMeta.busyLabel
            : isStripeConfigured
              ? `Pay ${formatCurrency(checkoutAmountCents, checkoutCurrency)} with ${selectedMethodMeta.buttonLabel}`
              : "Create order"}
        </Text>
      </Pressable>
      <Text style={styles.checkoutHelperText}>
        {selectedMethodMeta.helperText}
      </Text>

      <View testID="checkout-method-summary" style={styles.checkoutSummary}>
        <View style={styles.checkoutMethodSummaryHeader}>
          <PaymentMethodIcon method={selectedPaymentMethod} />
          <View style={styles.checkoutMethodSummaryCopy}>
            <Text style={styles.checkoutAmountLabel}>Selected payment</Text>
            <Text style={styles.checkoutMethodSummaryTitle}>
              {selectedMethodMeta.label}
            </Text>
          </View>
        </View>
        <SummaryRow label="Checkout flow" value={selectedMethodMeta.flow} />
        <SummaryRow
          label="Confirmation"
          value={selectedMethodMeta.confirmation}
        />
        <SummaryRow
          label="Availability"
          value={selectedMethodMeta.availability}
        />
      </View>

      {currentOrder ? (
        <View testID="checkout-order-summary" style={styles.checkoutSummary}>
          <SummaryRow
            label="Latest order"
            value={currentOrder.id.slice(0, 8)}
          />
          <SummaryRow label="Status" value={currentOrder.status} />
          <SummaryRow label="Payment" value={selectedMethodMeta.label} />
          <SummaryRow
            label="Total"
            value={formatCurrency(
              currentOrder.totalCents,
              currentOrder.currency,
            )}
          />
          <SummaryRow
            label="Created"
            value={formatShortDateTime(currentOrder.createdAt)}
          />
        </View>
      ) : null}

      {paymentIntent ? (
        <View testID="checkout-payment-summary" style={styles.checkoutSummary}>
          <SummaryRow
            label={selectedMethodMeta.paymentSummaryLabel}
            value={paymentIntent.paymentIntentId.slice(0, 10)}
          />
          <SummaryRow
            label={selectedMethodMeta.paymentStatusLabel}
            value={paymentIntent.status}
          />
        </View>
      ) : null}
    </View>
  );
}
