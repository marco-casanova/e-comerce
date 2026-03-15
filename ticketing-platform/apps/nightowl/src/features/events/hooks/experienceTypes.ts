export type ScreenTab = 'discover' | 'cart' | 'tickets' | 'scanner';

export type BannerState = {
  tone: 'error' | 'success' | 'info';
  message: string;
};

export type CameraPermissionState = {
  granted: boolean;
  canAskAgain: boolean;
};

export type CheckoutPaymentMethod = 'card' | 'wallet';

export type MessageTarget = 'banner' | 'scan';

export type BusyActionRunner = <T>(options: {
  action: () => Promise<T>;
  busyKey: string;
  errorTarget?: MessageTarget;
  onSuccess?: (value: T) => void | Promise<void>;
  successMessage?: string;
  successTarget?: MessageTarget;
  successTone?: BannerState['tone'];
}) => Promise<T | null>;
