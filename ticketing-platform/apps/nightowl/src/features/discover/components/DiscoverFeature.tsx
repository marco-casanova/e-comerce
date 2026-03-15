import type { EventAddOn, EventDetail, EventSummary, TicketType } from '../../events/types';
import { DiscoverPanel } from '../../events/components/panels/DiscoverPanel';

export function DiscoverFeature({
  busyKey,
  filteredEvents,
  getCartQuantity,
  getDraftQuantity,
  loadingEventId,
  onAddAddOn,
  onAddTicket,
  onDecreaseDraftQuantity,
  onIncreaseDraftQuantity,
  onSearchChange,
  onSelectEvent,
  searchQuery,
  selectedEvent,
  selectedEventSummary,
}: {
  busyKey: string | null;
  filteredEvents: EventSummary[];
  getCartQuantity: (resourceId: string) => number;
  getDraftQuantity: (itemId: string) => number;
  loadingEventId: string | null;
  onAddAddOn: (addOn: EventAddOn) => Promise<void> | void;
  onAddTicket: (ticketType: TicketType) => Promise<void> | void;
  onDecreaseDraftQuantity: (itemId: string) => void;
  onIncreaseDraftQuantity: (itemId: string) => void;
  onSearchChange: (value: string) => void;
  onSelectEvent: (eventId: string) => void;
  searchQuery: string;
  selectedEvent: EventDetail | null;
  selectedEventSummary: EventSummary | null;
}) {
  return (
    <DiscoverPanel
      filteredEvents={filteredEvents}
      getCartQuantity={getCartQuantity}
      getDraftQuantity={getDraftQuantity}
      loadingEventId={loadingEventId}
      onAddAddOn={(addOn) => void onAddAddOn(addOn)}
      onAddTicket={(ticketType) => void onAddTicket(ticketType)}
      onDecreaseDraftQuantity={onDecreaseDraftQuantity}
      onIncreaseDraftQuantity={onIncreaseDraftQuantity}
      onSearchChange={onSearchChange}
      onSelectEvent={onSelectEvent}
      searchQuery={searchQuery}
      selectedEvent={selectedEvent}
      selectedEventSummary={selectedEventSummary}
      busyKey={busyKey}
    />
  );
}
