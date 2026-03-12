export interface EventDto {
  id: string;
  title: string;
  description: string | null;
  venue: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  capacity: number;
}

export interface TicketTypeDto {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  totalQuantity: number;
  soldQuantity: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface OrderDto {
  id: string;
  userId: string;
  status: string;
  totalCents: number;
  createdAt: string;
}

export interface TicketDto {
  id: string;
  eventId: string;
  ticketTypeId: string;
  status: string;
  code: string;
  usedAt: string | null;
}
