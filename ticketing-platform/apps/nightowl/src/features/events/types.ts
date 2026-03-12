export type EventSummary = {
  id: string;
  title: string;
  description: string | null;
  venue: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  capacity: number;
};

export type TicketType = {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  totalQuantity: number;
  soldQuantity: number;
};

export type EventAddOn = {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  category: string;
  priceCents: number;
  currency: string;
  totalQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  isActive: boolean;
};

export type EventDetail = EventSummary & {
  ticketTypes: TicketType[];
  addOns: EventAddOn[];
};

export type CartItem = {
  id: string;
  itemKind: 'ticket' | 'add_on';
  ticketTypeId: string | null;
  addOnId: string | null;
  eventId: string;
  quantity: number;
  unitPriceCents: number;
  name: string;
  category: string | null;
};

export type ShoppingCart = {
  cartId: string;
  items: CartItem[];
  totalCents: number;
};

export type OrderSummary = {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
};

export type PaymentIntentSummary = {
  orderId: string;
  paymentIntentId: string;
  clientSecret?: string | null;
  status: string;
};

export type TicketPass = {
  id: string;
  orderId: string;
  eventId: string;
  ticketTypeId: string;
  code: string;
  status: string;
  usedAt: string | null;
  createdAt: string;
  eventTitle: string;
  eventVenue: string | null;
  eventStartsAt: string;
  eventEndsAt: string | null;
  ticketTypeName: string;
};

export type ScanValidationResult = {
  validated: boolean;
  ticket: {
    id: string;
    eventId: string;
    userId: string;
    status: string;
    usedAt: string | null;
    windowOpensAt: string;
    windowClosesAt: string;
  };
};
