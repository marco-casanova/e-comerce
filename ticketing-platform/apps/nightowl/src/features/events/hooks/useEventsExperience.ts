import { startTransition, useDeferredValue, useEffect, useState } from 'react';

import { useAuth } from '../../../core/auth/AuthProvider';
import { toAppError } from '../../../core/errors/appError';
import { isStripeConfigured } from '../../../core/payments/stripeConfig';
import { useCheckoutExperience } from '../../checkout/hooks/useCheckoutExperience';
import { useScannerExperience } from '../../scanner/hooks/useScannerExperience';
import { eventsApi } from '../api/eventsApi';
import type { CartItem, EventAddOn, EventDetail, EventSummary, TicketPass, TicketType } from '../types';
import type { BannerState, BusyActionRunner, MessageTarget, ScreenTab } from './experienceTypes';

export type { BannerState, CameraPermissionState, CheckoutPaymentMethod, ScreenTab } from './experienceTypes';

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
  }, [selectedEventId, visibleEvents]);

  useEffect(() => {
    if (selectedEventSummary && !eventDetails[selectedEventSummary.id] && loadingEventId !== selectedEventSummary.id) {
      void loadEventDetail(selectedEventSummary.id);
    }
  }, [eventDetails, loadingEventId, selectedEventSummary]);

  function syncDemoMode() {
    setIsDemoMode(eventsApi.getDataSourceMode() === 'mock');
  }

  function setTargetMessage(target: MessageTarget, nextBanner: BannerState | null) {
    if (target === 'scan') {
      scanner.setScanFeedback(nextBanner);
      return;
    }

    setBanner(nextBanner);
  }

  const runBusyAction: BusyActionRunner = async <T,>({
    action,
    busyKey: nextBusyKey,
    errorTarget = 'banner',
    onSuccess,
    successMessage,
    successTarget = 'banner',
    successTone = 'success',
  }: BusyActionOptions<T>) => {
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
  };

  const checkout = useCheckoutExperience({
    cart,
    runBusyAction,
    setBanner,
    setCart,
    setTickets,
  });

  const scanner = useScannerExperience({
    activeTab,
    busyKey,
    canValidateTickets,
    runBusyAction,
    setTickets,
    visibleEvents,
  });

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
        checkout.resetCheckoutState();
      },
      successMessage: 'Cart cleared.',
      successTone: 'info',
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

  function handleSelectEvent(eventId: string) {
    startTransition(() => {
      setSelectedEventId(eventId);
      setActiveTab('discover');
    });
  }

  function handleTabChange(nextTab: ScreenTab) {
    setActiveTab(nextTab);

    if (nextTab === 'scanner') {
      scanner.resumeScannerCamera();
    }
  }

  return {
    activeTab,
    banner,
    busyKey,
    cameraPermission: scanner.cameraPermission,
    canValidateTickets,
    cart,
    cartItemCount,
    currentOrder: checkout.currentOrder,
    eventDetails,
    events,
    filteredEvents,
    getCartQuantity,
    getDraftQuantity,
    handleAddAddOn,
    handleAddTicket,
    handleCameraScan: scanner.handleCameraScan,
    handleCheckout: checkout.handleCheckout,
    handleClearCart,
    handleRefreshTickets,
    handleSelectEvent,
    handleSelectScannerEvent: scanner.handleSelectScannerEvent,
    handleTabChange,
    handleUpdateCartItem,
    handleValidateTicket: scanner.handleValidateTicket,
    isBootstrapping,
    isCheckingCameraPermission: scanner.isCheckingCameraPermission,
    isDemoMode,
    isPlatformWalletSupported: checkout.isPlatformWalletSupported,
    isStripeConfigured,
    loadingEventId,
    paymentIntent: checkout.paymentIntent,
    requestCameraPermission: scanner.requestCameraPermission,
    resetScanner: scanner.resetScanner,
    scanFeedback: scanner.scanFeedback,
    scannerCameraPaused: scanner.scannerCameraPaused,
    scannerEventId: scanner.scannerEventId,
    scannerInput: scanner.scannerInput,
    searchQuery,
    selectedEvent,
    selectedEventSummary,
    selectedPaymentMethod: checkout.selectedPaymentMethod,
    session,
    setScannerInput: scanner.setScannerInput,
    setSearchQuery,
    setSelectedPaymentMethod: checkout.setSelectedPaymentMethod,
    setScanFeedback: scanner.setScanFeedback,
    signOut,
    tickets,
    updateDraftQuantity,
    userRoles,
    visibleEvents,
  };
}
