import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadMockStore() {
  vi.resetModules();
  return import('./mockEventsStore');
}

async function issueWarehousePulseTicket() {
  const store = await loadMockStore();
  const event = store.listMockEvents()[0];
  const detail = store.getMockEventDetail(event.id);

  store.addMockTicketToCart(detail.ticketTypes[0].id, 1);
  const order = store.createMockOrderFromCart();
  store.createMockPaymentIntent(order.id);

  const ticket = store.listMockTickets()[0];
  return { event, store, ticket };
}

describe('mockEventsStore', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the updated Warehouse Pulse dates', async () => {
    const { listMockEvents } = await loadMockStore();
    const warehousePulse = listMockEvents()[0];

    expect(warehousePulse.title).toBe('Warehouse Pulse');
    expect(warehousePulse.startsAt).toBe('2026-03-17T08:00:00.000Z');
    expect(warehousePulse.endsAt).toBe('2026-03-18T01:00:00.000Z');
  });

  it('rejects scans before the entry window opens', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T05:59:00.000Z'));

    const { event, store, ticket } = await issueWarehousePulseTicket();

    try {
      store.validateMockTicketScan(ticket.id, event.id);
      throw new Error('Expected validation to fail before the entry window opens.');
    } catch (error) {
      expect(error).toMatchObject({
        message: 'Ticket is too early for entry',
        code: 'SCAN_TOO_EARLY',
        statusCode: 409,
        details: {
          windowOpensAt: '2026-03-17T06:00:00.000Z',
          windowClosesAt: '2026-03-18T02:00:00.000Z',
          scanTimestamp: '2026-03-17T05:59:00.000Z',
        },
      });
    }
  });

  it('uses the event schedule to calculate a successful scan window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T10:00:00.000Z'));

    const { event, store, ticket } = await issueWarehousePulseTicket();
    const result = store.validateMockTicketScan(ticket.id, event.id);

    expect(result.validated).toBe(true);
    expect(result.ticket.windowOpensAt).toBe('2026-03-17T06:00:00.000Z');
    expect(result.ticket.windowClosesAt).toBe('2026-03-18T02:00:00.000Z');
    expect(result.ticket.status).toBe('used');
  });
});
