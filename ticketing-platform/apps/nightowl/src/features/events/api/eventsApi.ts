import { httpClient } from '../../../core/api/httpClient';
import { toAppError } from '../../../core/errors/appError';
import type {
  CartItem,
  EventAddOn,
  EventDetail,
  EventSummary,
  OrderSummary,
  PaymentIntentSummary,
  ScanValidationResult,
  ShoppingCart,
  TicketPass,
  TicketType,
} from '../types';
import {
  addMockAddOnToCart,
  addMockTicketToCart,
  clearMockCart,
  createMockOrderFromCart,
  createMockPaymentIntent,
  getMockCart,
  getMockEventDetail,
  listMockEvents,
  listMockTickets,
  removeMockCartItem,
  updateMockCartItem,
  validateMockTicketScan,
} from './mockEventsStore';

type EventResponse = {
  id: string;
  title: string;
  description: string | null;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  status: string;
  capacity: number;
};

type TicketTypeResponse = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  total_quantity: number;
  sold_quantity: number;
};

type EventAddOnResponse = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  category: string;
  price_cents: number;
  currency: string;
  total_quantity: number;
  reserved_quantity: number;
  sold_quantity: number;
  is_active: boolean;
};

type EventDetailResponse = EventResponse & {
  ticketTypes: TicketTypeResponse[];
  addOns: EventAddOnResponse[];
};

type CartItemResponse = {
  id: string;
  item_kind: 'ticket' | 'add_on';
  ticket_type_id: string | null;
  add_on_id: string | null;
  event_id: string;
  quantity: number;
  unit_price_cents: number;
  item_name: string;
  item_category: string | null;
};

type CartResponse = {
  cartId: string;
  items: CartItemResponse[];
  totalCents: number;
};

type OrderResponse = {
  id: string;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
};

type PaymentIntentResponse = {
  orderId: string;
  paymentIntentId: string;
  clientSecret?: string | null;
  customerId?: string | null;
  customerEphemeralKeySecret?: string | null;
  status: string;
};

type TicketPassResponse = {
  id: string;
  order_id: string;
  event_id: string;
  ticket_type_id: string;
  code: string;
  status: string;
  used_at: string | null;
  created_at: string;
  event_title: string;
  event_venue: string | null;
  event_starts_at: string;
  event_ends_at: string | null;
  ticket_type_name: string;
};

type ScanValidationResponse = {
  validated: boolean;
  ticket: {
    id: string;
    event_id: string;
    user_id: string;
    status: string;
    used_at: string | null;
    windowOpensAt: string;
    windowClosesAt: string;
  };
};

function mapEvent(event: EventResponse): EventSummary {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    venue: event.venue,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    status: event.status,
    capacity: event.capacity,
  };
}

function mapTicketType(ticketType: TicketTypeResponse): TicketType {
  return {
    id: ticketType.id,
    eventId: ticketType.event_id,
    name: ticketType.name,
    description: ticketType.description,
    priceCents: ticketType.price_cents,
    currency: ticketType.currency,
    totalQuantity: ticketType.total_quantity,
    soldQuantity: ticketType.sold_quantity,
  };
}

function mapAddOn(addOn: EventAddOnResponse): EventAddOn {
  return {
    id: addOn.id,
    eventId: addOn.event_id,
    name: addOn.name,
    description: addOn.description,
    category: addOn.category,
    priceCents: addOn.price_cents,
    currency: addOn.currency,
    totalQuantity: addOn.total_quantity,
    reservedQuantity: addOn.reserved_quantity,
    soldQuantity: addOn.sold_quantity,
    isActive: addOn.is_active,
  };
}

function mapCartItem(item: CartItemResponse): CartItem {
  return {
    id: item.id,
    itemKind: item.item_kind,
    ticketTypeId: item.ticket_type_id,
    addOnId: item.add_on_id,
    eventId: item.event_id,
    quantity: item.quantity,
    unitPriceCents: item.unit_price_cents,
    name: item.item_name,
    category: item.item_category,
  };
}

function mapCart(cart: CartResponse): ShoppingCart {
  return {
    cartId: cart.cartId,
    items: cart.items.map(mapCartItem),
    totalCents: cart.totalCents,
  };
}

function mapOrder(order: OrderResponse): OrderSummary {
  return {
    id: order.id,
    status: order.status,
    totalCents: order.total_cents,
    currency: order.currency,
    createdAt: order.created_at,
  };
}

function mapTicket(ticket: TicketPassResponse): TicketPass {
  return {
    id: ticket.id,
    orderId: ticket.order_id,
    eventId: ticket.event_id,
    ticketTypeId: ticket.ticket_type_id,
    code: ticket.code,
    status: ticket.status,
    usedAt: ticket.used_at,
    createdAt: ticket.created_at,
    eventTitle: ticket.event_title,
    eventVenue: ticket.event_venue,
    eventStartsAt: ticket.event_starts_at,
    eventEndsAt: ticket.event_ends_at,
    ticketTypeName: ticket.ticket_type_name,
  };
}

function mapScanResult(result: ScanValidationResponse): ScanValidationResult {
  return {
    validated: result.validated,
    ticket: {
      id: result.ticket.id,
      eventId: result.ticket.event_id,
      userId: result.ticket.user_id,
      status: result.ticket.status,
      usedAt: result.ticket.used_at,
      windowOpensAt: result.ticket.windowOpensAt,
      windowClosesAt: result.ticket.windowClosesAt,
    },
  };
}

type DataSourceMode = 'remote' | 'mock';

let dataSourceMode: DataSourceMode = 'remote';

function shouldFallbackToMock(error: unknown) {
  const appError = toAppError(error);
  const message = appError.message.toLowerCase();

  return (
    appError.code === 'REQUEST_TIMEOUT' ||
    appError.code === 'UNEXPECTED_ERROR' ||
    message.includes('network request timed out') ||
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('load failed')
  );
}

async function runWithFallback<T>(remote: () => Promise<T>, mock: () => T | Promise<T>) {
  if (dataSourceMode === 'mock') {
    return mock();
  }

  try {
    return await remote();
  } catch (error) {
    if (!shouldFallbackToMock(error)) {
      throw error;
    }

    dataSourceMode = 'mock';
    return mock();
  }
}

export const eventsApi = {
  getDataSourceMode: () => dataSourceMode,

  listEvents: async () => {
    return runWithFallback(
      async () => {
        const response = await httpClient.get<EventResponse[]>('/catalog/events');
        return response.map(mapEvent);
      },
      () => listMockEvents(),
    );
  },

  getEventDetail: async (eventId: string) => {
    return runWithFallback(
      async () => {
        const response = await httpClient.get<EventDetailResponse>(`/catalog/events/${eventId}`);
        return {
          ...mapEvent(response),
          ticketTypes: response.ticketTypes.map(mapTicketType),
          addOns: response.addOns.map(mapAddOn),
        } satisfies EventDetail;
      },
      () => getMockEventDetail(eventId),
    );
  },

  getCart: async () => {
    return runWithFallback(
      async () => {
        const response = await httpClient.get<CartResponse>('/cart/cart');
        return mapCart(response);
      },
      () => getMockCart(),
    );
  },

  addTicketToCart: async (ticketTypeId: string, quantity: number) => {
    return runWithFallback(
      async () => {
        const response = await httpClient.post<CartResponse>('/cart/cart/items', {
          itemKind: 'ticket',
          ticketTypeId,
          quantity,
        });
        return mapCart(response);
      },
      () => addMockTicketToCart(ticketTypeId, quantity),
    );
  },

  addAddOnToCart: async (addOnId: string, quantity: number) => {
    return runWithFallback(
      async () => {
        const response = await httpClient.post<CartResponse>('/cart/cart/items', {
          itemKind: 'add_on',
          addOnId,
          quantity,
        });
        return mapCart(response);
      },
      () => addMockAddOnToCart(addOnId, quantity),
    );
  },

  updateCartItem: async (itemId: string, quantity: number) => {
    return runWithFallback(
      async () => {
        const response = await httpClient.patch<CartResponse>(`/cart/cart/items/${itemId}`, { quantity });
        return mapCart(response);
      },
      () => updateMockCartItem(itemId, quantity),
    );
  },

  removeCartItem: async (itemId: string) => {
    return runWithFallback(
      async () => {
        const response = await httpClient.delete<CartResponse>(`/cart/cart/items/${itemId}`);
        return mapCart(response);
      },
      () => removeMockCartItem(itemId),
    );
  },

  clearCart: async () => {
    return runWithFallback(
      async () => {
        const response = await httpClient.delete<CartResponse>('/cart/cart/clear');
        return mapCart(response);
      },
      () => clearMockCart(),
    );
  },

  createOrderFromCart: async () => {
    return runWithFallback(
      async () => {
        const response = await httpClient.post<OrderResponse>('/orders/orders/create-from-cart');
        return mapOrder(response);
      },
      () => createMockOrderFromCart(),
    );
  },

  createPaymentIntent: async (orderId: string) => {
    return runWithFallback(
      async () => {
        const response = await httpClient.post<PaymentIntentResponse>('/checkout/checkout/payment-intent', { orderId });
        return response satisfies PaymentIntentSummary;
      },
      () => createMockPaymentIntent(orderId),
    );
  },

  listTickets: async () => {
    return runWithFallback(
      async () => {
        const response = await httpClient.get<TicketPassResponse[]>('/tickets/tickets/my');
        return response.map(mapTicket);
      },
      () => listMockTickets(),
    );
  },

  validateTicketScan: async (ticketId: string, eventId: string) => {
    return runWithFallback(
      async () => {
        const response = await httpClient.post<ScanValidationResponse>(`/tickets/tickets/${ticketId}/validate-scan`, {
          eventId,
        });
        return mapScanResult(response);
      },
      () => validateMockTicketScan(ticketId, eventId),
    );
  },
};
