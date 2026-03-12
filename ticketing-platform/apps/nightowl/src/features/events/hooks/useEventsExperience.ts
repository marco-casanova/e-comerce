import { Camera } from 'expo-camera';
import { startTransition, useDeferredValue, useEffect, useState } from 'react';

import { useAuth } from '../../../core/auth/AuthProvider';
import { toAppError } from '../../../core/errors/appError';
import { eventsApi } from '../api/eventsApi';
import type { CartItem, EventAddOn, EventDetail, EventSummary, OrderSummary, PaymentIntentSummary, TicketPass, TicketType } from '../types';
import { extractTicketIdFromPayload, formatShortDateTime } from '../utils';

export type ScreenTab = 'discover' | 'cart' | 'tickets' | 'scanner';

export type BannerState = {
  tone: 'error' | 'success' | 'info';
  message: string;
};

export type CameraPermissionState = {
  granted: boolean;
  canAskAgain: boolean;
};

type MessageTarget = 'banner' | 'scan';

type BusyActionOptions<T> = {
  action: () => Promise<T>;
  busyKey: string;
  errorTarget?: MessageTarget;
  onSuccess?: (value: T) => void | Promise<void>;
  successMessage?: string;
  successTarget?: MessageTarget;
  successTone?: BannerState['tone'];
};

export function useEventsExperience() {
  const { session, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<ScreenTab>('discover');
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventDetails, setEventDetails] = useState<Record<string, EventDetail>>({});
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [cart, setCart] = useState({ cartId: '', items: [] as CartItem[], totalCents: 0 });
  const [tickets, setTickets] = useState<TicketPass[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(eventsApi.getDataSourceMode() === 'mock');
  const [loadingEventId, setLoadingEventId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({});
  const [currentOrder, setCurrentOrder] = useState<OrderSummary | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntentSummary | null>(null);
  const [scannerEventId, setScannerEventId] = useState<string | null>(null);
  const [scannerInput, setScannerInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<BannerState | null>(null);
  const [scannerCameraPaused, setScannerCameraPaused] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionState | null>(null);
  const [isCheckingCameraPermission, setIsCheckingCameraPermission] = useState(false);
  const deferredSearch = useDeferredValue(searchQuery);

  const userRoles = session?.user.roles ?? [];
  const canValidateTickets =
    userRoles.includes('staff') ||
    userRoles.includes('admin') ||
    userRoles.includes('super_admin');

  const visibleEvents = events.some((event) => event.status === 'published')
    ? events.filter((event) => event.status === 'published')
    : events;

  const filteredEvents = visibleEvents.filter((event) => {
    const needle = deferredSearch.trim().toLowerCase();
    if (!needle) {
      return true;
    }

    return [event.title, event.description ?? '', event.venue ?? ''].some((value) =>
      value.toLowerCase().includes(needle),
    );
  });

  const selectedEventSummary =
    filteredEvents.find((event) => event.id === selectedEventId) ??
    visibleEvents.find((event) => event.id === selectedEventId) ??
    filteredEvents[0] ??
    visibleEvents[0] ??
    null;

  const selectedEvent = selectedEventSummary ? eventDetails[selectedEventSummary.id] ?? null : null;
  const cartItemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    void bootstrapExperience();
  }, []);

  useEffect(() => {
    if (!selectedEventId && visibleEvents[0]) {
      startTransition(() => {
        setSelectedEventId(visibleEvents[0].id);
      });
    }

    if (!scannerEventId && visibleEvents[0]) {
      setScannerEventId(visibleEvents[0].id);
    }
  }, [scannerEventId, selectedEventId, visibleEvents]);

  useEffect(() => {
    if (selectedEventSummary && !eventDetails[selectedEventSummary.id] && loadingEventId !== selectedEventSummary.id) {
      void loadEventDetail(selectedEventSummary.id);
    }
  }, [eventDetails, loadingEventId, selectedEventSummary]);

  useEffect(() => {
    if (activeTab !== 'scanner' || !canValidateTickets || cameraPermission || isCheckingCameraPermission) {
      return;
    }

    void hydrateCameraPermission();
  }, [activeTab, cameraPermission, canValidateTickets, isCheckingCameraPermission]);

  function syncDemoMode() {
    setIsDemoMode(eventsApi.getDataSourceMode() === 'mock');
  }

  function setTargetMessage(target: MessageTarget, nextBanner: BannerState | null) {
    if (target === 'scan') {
      setScanFeedback(nextBanner);
      return;
    }

    setBanner(nextBanner);
  }

  async function runBusyAction<T>({
    action,
    busyKey: nextBusyKey,
    errorTarget = 'banner',
    onSuccess,
    successMessage,
    successTarget = 'banner',
    successTone = 'success',
  }: BusyActionOptions<T>) {
    try {
      setBusyKey(nextBusyKey);
      const result = await action();
      syncDemoMode();

      if (onSuccess) {
        await onSuccess(result);
      }

      if (successMessage) {
        setTargetMessage(successTarget, { tone: successTone, message: successMessage });
      }

      return result;
    } catch (error) {
      syncDemoMode();
      setTargetMessage(errorTarget, { tone: 'error', message: toAppError(error).message });
      return null;
    } finally {
      setBusyKey(null);
    }
  }

  async function bootstrapExperience() {
    setIsBootstrapping(true);

    const [eventsResult, cartResult, ticketsResult] = await Promise.allSettled([
      eventsApi.listEvents(),
      eventsApi.getCart(),
      eventsApi.listTickets(),
    ]);

    syncDemoMode();

    const messages: string[] = [];

    if (eventsResult.status === 'fulfilled') {
      setEvents(eventsResult.value);
    } else {
      messages.push(toAppError(eventsResult.reason).message);
    }

    if (cartResult.status === 'fulfilled') {
      setCart(cartResult.value);
    } else {
      messages.push(toAppError(cartResult.reason).message);
    }

    if (ticketsResult.status === 'fulfilled') {
      setTickets(ticketsResult.value);
    } else {
      messages.push(toAppError(ticketsResult.reason).message);
    }

    if (messages[0]) {
      setBanner({ tone: 'error', message: messages[0] });
    } else if (eventsApi.getDataSourceMode() === 'mock') {
      setBanner({
        tone: 'info',
        message: 'API unreachable. Night Owl is running in local demo mode with 5 seeded events, shirts, caps and ticket scanning.',
      });
    }

    setIsBootstrapping(false);
  }

  async function loadEventDetail(eventId: string) {
    try {
      setLoadingEventId(eventId);
      const detail = await eventsApi.getEventDetail(eventId);
      syncDemoMode();
      setEventDetails((current) => ({ ...current, [eventId]: detail }));
    } catch (error) {
      syncDemoMode();
      setBanner({ tone: 'error', message: toAppError(error).message });
    } finally {
      setLoadingEventId(null);
    }
  }

  async function hydrateCameraPermission() {
    try {
      setIsCheckingCameraPermission(true);
      const permission = await Camera.getCameraPermissionsAsync();
      setCameraPermission({
        granted: permission.granted,
        canAskAgain: permission.canAskAgain,
      });
    } catch (error) {
      setScanFeedback({ tone: 'error', message: toAppError(error).message });
    } finally {
      setIsCheckingCameraPermission(false);
    }
  }

  async function requestCameraPermission() {
    try {
      setIsCheckingCameraPermission(true);
      const permission = await Camera.requestCameraPermissionsAsync();
      setCameraPermission({
        granted: permission.granted,
        canAskAgain: permission.canAskAgain,
      });

      if (!permission.granted) {
        setScanFeedback({
          tone: 'info',
          message: permission.canAskAgain
            ? 'Camera access is still disabled. Allow it to scan tickets live.'
            : 'Camera access is blocked. Enable it from iOS Settings to scan tickets live.',
        });
      }
    } catch (error) {
      setScanFeedback({ tone: 'error', message: toAppError(error).message });
    } finally {
      setIsCheckingCameraPermission(false);
    }
  }

  function updateDraftQuantity(itemId: string, delta: number) {
    setDraftQuantities((current) => {
      const nextValue = Math.max(1, (current[itemId] ?? 1) + delta);
      return { ...current, [itemId]: nextValue };
    });
  }

  function getDraftQuantity(itemId: string) {
    return Math.max(1, draftQuantities[itemId] ?? 1);
  }

  function getCartQuantity(resourceId: string) {
    const item = cart.items.find((entry) => entry.ticketTypeId === resourceId || entry.addOnId === resourceId);
    return item?.quantity ?? 0;
  }

  async function handleAddTicket(ticketType: TicketType) {
    const quantity = getDraftQuantity(ticketType.id);

    await runBusyAction({
      busyKey: `ticket:${ticketType.id}`,
      action: () => eventsApi.addTicketToCart(ticketType.id, quantity),
      onSuccess: (nextCart) => setCart(nextCart),
      successMessage: `${ticketType.name} added to cart.`,
    });
  }

  async function handleAddAddOn(addOn: EventAddOn) {
    const quantity = getDraftQuantity(addOn.id);

    await runBusyAction({
      busyKey: `addon:${addOn.id}`,
      action: () => eventsApi.addAddOnToCart(addOn.id, quantity),
      onSuccess: (nextCart) => setCart(nextCart),
      successMessage: `${addOn.name} added to cart.`,
    });
  }

  async function handleUpdateCartItem(item: CartItem, nextQuantity: number) {
    await runBusyAction({
      busyKey: `cart:${item.id}`,
      action: () =>
        nextQuantity <= 0
          ? eventsApi.removeCartItem(item.id)
          : eventsApi.updateCartItem(item.id, nextQuantity),
      onSuccess: (nextCart) => setCart(nextCart),
    });
  }

  async function handleClearCart() {
    await runBusyAction({
      busyKey: 'cart:clear',
      action: () => eventsApi.clearCart(),
      onSuccess: (nextCart) => {
        setCart(nextCart);
        setCurrentOrder(null);
        setPaymentIntent(null);
      },
      successMessage: 'Cart cleared.',
      successTone: 'info',
    });
  }

  async function handleCreateOrder() {
    await runBusyAction({
      busyKey: 'checkout:create-order',
      action: async () => {
        const order = await eventsApi.createOrderFromCart();
        const nextCart = await eventsApi.getCart();
        return { order, nextCart };
      },
      onSuccess: ({ order, nextCart }) => {
        setCurrentOrder(order);
        setPaymentIntent(null);
        setCart(nextCart);
      },
      successMessage: 'Order created. Prepare the Stripe payment intent next.',
    });
  }

  async function handlePreparePayment() {
    if (!currentOrder) {
      return;
    }

    await runBusyAction({
      busyKey: 'checkout:payment-intent',
      action: () => eventsApi.createPaymentIntent(currentOrder.id),
      onSuccess: (nextPaymentIntent) => {
        setPaymentIntent(nextPaymentIntent);
        setBanner({
          tone: 'info',
          message:
            nextPaymentIntent.status === 'already_paid'
              ? 'Order is already paid. Refresh tickets to load the issued passes.'
              : 'Stripe payment intent created. Complete payment via the webhook-backed Stripe flow.',
        });
      },
    });
  }

  async function handleRefreshTickets() {
    await runBusyAction({
      busyKey: 'tickets:refresh',
      action: () => eventsApi.listTickets(),
      onSuccess: (nextTickets) => setTickets(nextTickets),
      successMessage: 'Ticket wallet refreshed.',
    });
  }

  function resetScanner() {
    setScannerCameraPaused(false);
    setScannerInput('');
    setScanFeedback(null);
  }

  async function handleValidateTicket(rawInput = scannerInput) {
    const ticketId = extractTicketIdFromPayload(rawInput.trim());

    if (!ticketId || !scannerEventId) {
      setScanFeedback({ tone: 'error', message: 'Paste a valid ticket payload or ticket id first.' });
      return;
    }

    await runBusyAction({
      busyKey: 'scanner:validate',
      errorTarget: 'scan',
      action: async () => {
        const result = await eventsApi.validateTicketScan(ticketId, scannerEventId);
        const nextTickets = await eventsApi.listTickets();
        return { result, nextTickets };
      },
      onSuccess: ({ result, nextTickets }) => {
        setScanFeedback({
          tone: 'success',
          message: `Ticket ${result.ticket.id.slice(0, 8)} validated. Entry open until ${formatShortDateTime(
            result.ticket.windowClosesAt,
          )}.`,
        });
        setScannerInput(rawInput);
        setTickets(nextTickets);
      },
    });
  }

  function handleCameraScan(payload: string) {
    if (scannerCameraPaused || busyKey === 'scanner:validate') {
      return;
    }

    setScannerCameraPaused(true);
    setScannerInput(payload);
    void handleValidateTicket(payload);
  }

  function handleSelectEvent(eventId: string) {
    startTransition(() => {
      setSelectedEventId(eventId);
      setActiveTab('discover');
    });
  }

  function handleSelectScannerEvent(eventId: string) {
    setScannerEventId(eventId);
    setScanFeedback(null);
  }

  function handleTabChange(nextTab: ScreenTab) {
    setActiveTab(nextTab);

    if (nextTab === 'scanner') {
      setScannerCameraPaused(false);
    }
  }

  return {
    activeTab,
    banner,
    cameraPermission,
    canValidateTickets,
    cart,
    cartItemCount,
    currentOrder,
    eventDetails,
    events,
    filteredEvents,
    getCartQuantity,
    getDraftQuantity,
    handleAddAddOn,
    handleAddTicket,
    handleCameraScan,
    handleClearCart,
    handleCreateOrder,
    handlePreparePayment,
    handleRefreshTickets,
    handleSelectEvent,
    handleSelectScannerEvent,
    handleTabChange,
    handleUpdateCartItem,
    handleValidateTicket,
    isBootstrapping,
    isCheckingCameraPermission,
    isDemoMode,
    loadingEventId,
    paymentIntent,
    requestCameraPermission,
    resetScanner,
    scanFeedback,
    scannerCameraPaused,
    scannerEventId,
    scannerInput,
    searchQuery,
    selectedEvent,
    selectedEventSummary,
    session,
    setScannerInput,
    setSearchQuery,
    setScanFeedback,
    signOut,
    tickets,
    updateDraftQuantity,
    userRoles,
    visibleEvents,
    busyKey,
  };
}
