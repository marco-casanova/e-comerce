import { AppError } from '../../../core/errors/appError';
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

type MockOrderRecord = {
  order: OrderSummary;
  items: CartItem[];
  fulfilledAt: string | null;
  paymentIntentId: string;
};

const ENTRY_OPENS_BEFORE_START_MINUTES = 120;
const ENTRY_CLOSES_AFTER_END_MINUTES = 60;
const ENTRY_CLOSES_AFTER_START_MINUTES = 360;

let nextSequence = 1000;

function createUuid() {
  const value = (nextSequence++).toString(16).padStart(32, '0');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-8${value.slice(17, 20)}-${value.slice(20)}`;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isoDate(date: string, time: string) {
  return `${date}T${time}:00.000Z`;
}

function isoLocalDate(referenceDate: Date, dayOffset: number, hours: number, minutes = 0) {
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() + dayOffset,
    hours,
    minutes,
    0,
    0,
  ).toISOString();
}

function buildEntryWindow(startsAt: string, endsAt: string | null) {
  const eventStartsAt = new Date(startsAt);
  const eventEndsAt = endsAt ? new Date(endsAt) : null;
  const windowOpensAt = new Date(eventStartsAt.getTime() - ENTRY_OPENS_BEFORE_START_MINUTES * 60 * 1000);
  const windowClosesAt = eventEndsAt
    ? new Date(eventEndsAt.getTime() + ENTRY_CLOSES_AFTER_END_MINUTES * 60 * 1000)
    : new Date(eventStartsAt.getTime() + ENTRY_CLOSES_AFTER_START_MINUTES * 60 * 1000);

  return {
    windowOpensAt,
    windowClosesAt,
  };
}

function createTicketType(eventId: string, name: string, priceCents: number, totalQuantity: number, description: string) {
  return {
    id: createUuid(),
    eventId,
    name,
    description,
    priceCents,
    currency: 'usd',
    totalQuantity,
    soldQuantity: 0,
  } satisfies TicketType;
}

function createAddOn(eventId: string, name: string, category: string, priceCents: number, totalQuantity: number, description: string) {
  return {
    id: createUuid(),
    eventId,
    name,
    description,
    category,
    priceCents,
    currency: 'usd',
    totalQuantity,
    reservedQuantity: 0,
    soldQuantity: 0,
    isActive: true,
  } satisfies EventAddOn;
}

function buildMockEvents() {
  const referenceDate = new Date();
  const eventBlueprints = [
    {
      title: 'Warehouse Pulse',
      description: 'A late-night industrial set with laser tunnels, hard groove rooms and an all-night coffee bar.',
      venue: 'Black Lantern Depot',
      startsAt: isoLocalDate(referenceDate, 0, 9),
      endsAt: isoLocalDate(referenceDate, 1, 2),
      capacity: 420,
      ticketCopy: 'Fast-lane entry with warehouse floor access.',
      merchCopy: 'Heavy cotton black tee with reflective lineup print.',
      capCopy: 'Structured six-panel cap with tonal Night Owl mark.',
    },
    {
      title: 'Skyline Sunday',
      description: 'A rooftop day-to-night session with house edits, sunset cocktails and a cityline backdrop.',
      venue: 'Mercury Roof',
      startsAt: isoDate('2026-03-08', '15:00'),
      endsAt: isoDate('2026-03-08', '23:00'),
      capacity: 260,
      ticketCopy: 'General roof access and sunset headline set.',
      merchCopy: 'Sand-colour tee with skyline back print.',
      capCopy: 'Soft peak cap stitched with the rooftop series logo.',
    },
    {
      title: 'Neon District',
      description: 'Bass-heavy rooms, food stalls and immersive visuals spread across three connected spaces.',
      venue: 'District Yard',
      startsAt: isoDate('2026-03-13', '19:30'),
      endsAt: isoDate('2026-03-14', '02:30'),
      capacity: 680,
      ticketCopy: 'District access across all three stages.',
      merchCopy: 'Oversized district tee with glow-ink sleeve hit.',
      capCopy: 'Curved brim cap with neon piping.',
    },
    {
      title: 'Midnight Cinema',
      description: 'Live score warmups, cult visuals and a downtempo closing set inside a converted picture house.',
      venue: 'Roxy Picture Hall',
      startsAt: isoDate('2026-03-20', '21:00'),
      endsAt: isoDate('2026-03-21', '01:00'),
      capacity: 310,
      ticketCopy: 'Main room admission and balcony lounge access.',
      merchCopy: 'Washed charcoal tee with cinema marquee graphic.',
      capCopy: 'Classic dad cap with embroidered film reel icon.',
    },
    {
      title: 'Harbour Lights',
      description: 'Open-air electronic sets by the docks with heaters, sea air and a closing fireworks cue.',
      venue: 'Dock 17',
      startsAt: isoDate('2026-03-27', '18:30'),
      endsAt: isoDate('2026-03-28', '00:30'),
      capacity: 540,
      ticketCopy: 'Dock floor admission and warm lounge access.',
      merchCopy: 'Navy event tee with back-of-dock coordinates.',
      capCopy: 'Snapback cap with reflective harbour crest.',
    },
  ];

  return eventBlueprints.map((blueprint, index) => {
    const eventId = createUuid();
    const generalTicket = createTicketType(eventId, 'General Admission', 3200 + index * 300, 250 + index * 40, blueprint.ticketCopy);
    const vipTicket = createTicketType(
      eventId,
      'Priority Entry',
      5600 + index * 400,
      90 + index * 15,
      'Faster lane, dedicated host point and premium floor access.',
    );
    const shirt = createAddOn(eventId, `${blueprint.title} Shirt`, 'shirt', 2800 + index * 100, 80, blueprint.merchCopy);
    const cap = createAddOn(eventId, `${blueprint.title} Cap`, 'cap', 2200 + index * 100, 65, blueprint.capCopy);

    return {
      id: eventId,
      title: blueprint.title,
      description: blueprint.description,
      venue: blueprint.venue,
      startsAt: blueprint.startsAt,
      endsAt: blueprint.endsAt,
      status: 'published',
      capacity: blueprint.capacity,
      ticketTypes: [generalTicket, vipTicket],
      addOns: [shirt, cap],
    } satisfies EventDetail;
  });
}

const mockEventDetails = buildMockEvents();
const mockEventIndex = new Map(mockEventDetails.map((event) => [event.id, event]));
const mockTicketTypeIndex = new Map(
  mockEventDetails.flatMap((event) => event.ticketTypes.map((ticketType) => [ticketType.id, ticketType] as const)),
);
const mockAddOnIndex = new Map(
  mockEventDetails.flatMap((event) => event.addOns.map((addOn) => [addOn.id, addOn] as const)),
);

let mockCart: ShoppingCart = {
  cartId: createUuid(),
  items: [],
  totalCents: 0,
};

let mockOrders: MockOrderRecord[] = [];
let mockTickets: TicketPass[] = [];

function computeCartTotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
}

function updateCart(nextItems: CartItem[]) {
  mockCart = {
    ...mockCart,
    items: nextItems,
    totalCents: computeCartTotal(nextItems),
  };

  return cloneValue(mockCart);
}

function findEventById(eventId: string) {
  const event = mockEventIndex.get(eventId);

  if (!event) {
    throw new AppError({
      message: 'Event not found',
      code: 'EVENT_NOT_FOUND',
      statusCode: 404,
    });
  }

  return event;
}

function createCartItem(params: {
  itemKind: 'ticket' | 'add_on';
  ticketType?: TicketType;
  addOn?: EventAddOn;
  quantity: number;
}) {
  if (params.itemKind === 'ticket' && params.ticketType) {
    return {
      id: createUuid(),
      itemKind: 'ticket',
      ticketTypeId: params.ticketType.id,
      addOnId: null,
      eventId: params.ticketType.eventId,
      quantity: params.quantity,
      unitPriceCents: params.ticketType.priceCents,
      name: params.ticketType.name,
      category: null,
    } satisfies CartItem;
  }

  if (params.itemKind === 'add_on' && params.addOn) {
    return {
      id: createUuid(),
      itemKind: 'add_on',
      ticketTypeId: null,
      addOnId: params.addOn.id,
      eventId: params.addOn.eventId,
      quantity: params.quantity,
      unitPriceCents: params.addOn.priceCents,
      name: params.addOn.name,
      category: params.addOn.category,
    } satisfies CartItem;
  }

  throw new AppError({
    message: 'Unsupported cart item',
    code: 'INVALID_CART_ITEM',
    statusCode: 400,
  });
}

function issueTicketsForOrder(orderRecord: MockOrderRecord) {
  if (orderRecord.fulfilledAt) {
    return;
  }

  const issuedAt = new Date().toISOString();

  for (const item of orderRecord.items) {
    if (item.itemKind === 'ticket' && item.ticketTypeId) {
      const ticketType = mockTicketTypeIndex.get(item.ticketTypeId);
      const event = ticketType ? findEventById(ticketType.eventId) : null;

      if (!ticketType || !event) {
        continue;
      }

      ticketType.soldQuantity += item.quantity;

      for (let ticketIndex = 0; ticketIndex < item.quantity; ticketIndex += 1) {
        mockTickets.unshift({
          id: createUuid(),
          orderId: orderRecord.order.id,
          eventId: event.id,
          ticketTypeId: ticketType.id,
          code: `OWL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          status: 'valid',
          usedAt: null,
          createdAt: issuedAt,
          eventTitle: event.title,
          eventVenue: event.venue,
          eventStartsAt: event.startsAt,
          eventEndsAt: event.endsAt,
          ticketTypeName: ticketType.name,
        });
      }
    }

    if (item.itemKind === 'add_on' && item.addOnId) {
      const addOn = mockAddOnIndex.get(item.addOnId);
      if (addOn) {
        addOn.soldQuantity += item.quantity;
      }
    }
  }

  orderRecord.fulfilledAt = issuedAt;
}

export function listMockEvents() {
  return cloneValue(
    mockEventDetails.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      venue: event.venue,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status: event.status,
      capacity: event.capacity,
    } satisfies EventSummary)),
  );
}

export function getMockEventDetail(eventId: string) {
  return cloneValue(findEventById(eventId));
}

export function getMockCart() {
  return cloneValue(mockCart);
}

export function addMockTicketToCart(ticketTypeId: string, quantity: number) {
  const ticketType = mockTicketTypeIndex.get(ticketTypeId);

  if (!ticketType) {
    throw new AppError({
      message: 'Ticket type not found',
      code: 'TICKET_TYPE_NOT_FOUND',
      statusCode: 404,
    });
  }

  const existing = mockCart.items.find((item) => item.ticketTypeId === ticketTypeId);
  if (existing) {
    return updateCart(
      mockCart.items.map((item) =>
        item.id === existing.id ? { ...item, quantity: item.quantity + Math.max(quantity, 1) } : item,
      ),
    );
  }

  return updateCart([...mockCart.items, createCartItem({ itemKind: 'ticket', ticketType, quantity: Math.max(quantity, 1) })]);
}

export function addMockAddOnToCart(addOnId: string, quantity: number) {
  const addOn = mockAddOnIndex.get(addOnId);

  if (!addOn) {
    throw new AppError({
      message: 'Event extra not found',
      code: 'ADD_ON_NOT_FOUND',
      statusCode: 404,
    });
  }

  const existing = mockCart.items.find((item) => item.addOnId === addOnId);
  if (existing) {
    return updateCart(
      mockCart.items.map((item) =>
        item.id === existing.id ? { ...item, quantity: item.quantity + Math.max(quantity, 1) } : item,
      ),
    );
  }

  return updateCart([...mockCart.items, createCartItem({ itemKind: 'add_on', addOn, quantity: Math.max(quantity, 1) })]);
}

export function updateMockCartItem(itemId: string, quantity: number) {
  const existing = mockCart.items.find((item) => item.id === itemId);

  if (!existing) {
    throw new AppError({
      message: 'Cart item not found',
      code: 'CART_ITEM_NOT_FOUND',
      statusCode: 404,
    });
  }

  if (quantity <= 0) {
    return updateCart(mockCart.items.filter((item) => item.id !== itemId));
  }

  return updateCart(mockCart.items.map((item) => (item.id === itemId ? { ...item, quantity } : item)));
}

export function removeMockCartItem(itemId: string) {
  return updateCart(mockCart.items.filter((item) => item.id !== itemId));
}

export function clearMockCart() {
  return updateCart([]);
}

export function createMockOrderFromCart() {
  if (!mockCart.items.length) {
    throw new AppError({
      message: 'Add something to the cart before creating an order',
      code: 'EMPTY_CART',
      statusCode: 400,
    });
  }

  const order = {
    id: `mock-order-${mockOrders.length + 1}`,
    status: 'pending_payment',
    totalCents: mockCart.totalCents,
    currency: 'usd',
    createdAt: new Date().toISOString(),
  } satisfies OrderSummary;

  mockOrders.unshift({
    order,
    items: cloneValue(mockCart.items),
    fulfilledAt: null,
    paymentIntentId: `pi_mock_${mockOrders.length + 1}`,
  });

  updateCart([]);

  return cloneValue(order);
}

export function createMockPaymentIntent(orderId: string) {
  const orderRecord = mockOrders.find((record) => record.order.id === orderId);

  if (!orderRecord) {
    throw new AppError({
      message: 'Order not found',
      code: 'ORDER_NOT_FOUND',
      statusCode: 404,
    });
  }

  issueTicketsForOrder(orderRecord);
  orderRecord.order.status = 'paid';

  return cloneValue({
    orderId,
    paymentIntentId: orderRecord.paymentIntentId,
    clientSecret: null,
    customerId: null,
    customerEphemeralKeySecret: null,
    status: 'already_paid',
  } satisfies PaymentIntentSummary);
}

export function listMockTickets() {
  return cloneValue(mockTickets);
}

export function validateMockTicketScan(ticketId: string, eventId: string) {
  const ticket = mockTickets.find((entry) => entry.id === ticketId);

  if (!ticket) {
    throw new AppError({
      message: 'Ticket not found',
      code: 'TICKET_NOT_FOUND',
      statusCode: 404,
    });
  }

  if (ticket.eventId !== eventId) {
    throw new AppError({
      message: 'Ticket does not belong to the selected event',
      code: 'EVENT_MISMATCH',
      statusCode: 400,
    });
  }

  if (ticket.status === 'used') {
    throw new AppError({
      message: 'Ticket has already been scanned',
      code: 'TICKET_ALREADY_USED',
      statusCode: 409,
    });
  }

  const event = findEventById(ticket.eventId);
  const scanTimestamp = new Date();
  const { windowOpensAt, windowClosesAt } = buildEntryWindow(event.startsAt, event.endsAt);

  if (scanTimestamp < windowOpensAt) {
    throw new AppError({
      message: 'Ticket is too early for entry',
      code: 'SCAN_TOO_EARLY',
      statusCode: 409,
      details: {
        windowOpensAt: windowOpensAt.toISOString(),
        windowClosesAt: windowClosesAt.toISOString(),
        scanTimestamp: scanTimestamp.toISOString(),
      },
    });
  }

  if (scanTimestamp > windowClosesAt) {
    throw new AppError({
      message: 'Ticket is too late for entry',
      code: 'SCAN_TOO_LATE',
      statusCode: 409,
      details: {
        windowOpensAt: windowOpensAt.toISOString(),
        windowClosesAt: windowClosesAt.toISOString(),
        scanTimestamp: scanTimestamp.toISOString(),
      },
    });
  }

  const usedAt = new Date().toISOString();
  ticket.status = 'used';
  ticket.usedAt = usedAt;

  return cloneValue({
    validated: true,
    ticket: {
      id: ticket.id,
      eventId: ticket.eventId,
      userId: 'mock-user',
      status: ticket.status,
      usedAt,
      windowOpensAt: windowOpensAt.toISOString(),
      windowClosesAt: windowClosesAt.toISOString(),
    },
  } satisfies ScanValidationResult);
}
