import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type { EventAddOn, EventDetail, EventSummary, TicketType } from '../../types';
import { formatCurrency, formatEventDateRange } from '../../utils';
import { EmptyState, SellableCard } from '../EventUi';
import { styles } from '../eventsScreenStyles';

export function DiscoverPanel({
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
  busyKey,
}: {
  filteredEvents: EventSummary[];
  getCartQuantity: (resourceId: string) => number;
  getDraftQuantity: (itemId: string) => number;
  loadingEventId: string | null;
  onAddAddOn: (addOn: EventAddOn) => void;
  onAddTicket: (ticketType: TicketType) => void;
  onDecreaseDraftQuantity: (itemId: string) => void;
  onIncreaseDraftQuantity: (itemId: string) => void;
  onSearchChange: (value: string) => void;
  onSelectEvent: (eventId: string) => void;
  searchQuery: string;
  selectedEvent: EventDetail | null;
  selectedEventSummary: EventSummary | null;
  busyKey: string | null;
}) {
  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Browse events</Text>
        <TextInput
          autoCapitalize="none"
          placeholder="Search by venue, title or vibe"
          placeholderTextColor="#7a8599"
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={onSearchChange}
        />

        <ScrollView contentContainerStyle={styles.eventRail} horizontal showsHorizontalScrollIndicator={false}>
          {filteredEvents.map((event) => (
            <Pressable
              key={event.id}
              onPress={() => onSelectEvent(event.id)}
              style={[
                styles.eventCard,
                selectedEventSummary?.id === event.id ? styles.eventCardSelected : null,
              ]}
            >
              <Text style={styles.eventStatus}>{event.status}</Text>
              <Text style={styles.eventCardTitle}>{event.title}</Text>
              <Text style={styles.eventCardMeta}>{formatEventDateRange(event.startsAt, event.endsAt)}</Text>
              <Text style={styles.eventCardMeta}>{event.venue ?? 'Venue announced soon'}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {selectedEventSummary ? (
        <View style={styles.panel}>
          {loadingEventId === selectedEventSummary.id && !selectedEvent ? (
            <View style={styles.inlineLoader}>
              <ActivityIndicator color="#f0b35c" />
              <Text style={styles.inlineLoaderText}>Loading event detail...</Text>
            </View>
          ) : null}

          {selectedEvent ? (
            <>
              <View style={styles.eventDetailHeader}>
                <View style={styles.eventDetailCopy}>
                  <Text style={styles.panelTitle}>{selectedEvent.title}</Text>
                  <Text style={styles.eventDetailMeta}>
                    {formatEventDateRange(selectedEvent.startsAt, selectedEvent.endsAt)}
                  </Text>
                  <Text style={styles.eventDetailMeta}>{selectedEvent.venue ?? 'Venue announced soon'}</Text>
                </View>

                <View style={styles.capacityBadge}>
                  <Text style={styles.capacityBadgeLabel}>{selectedEvent.capacity} cap</Text>
                </View>
              </View>

              {selectedEvent.description ? (
                <Text style={styles.eventDescription}>{selectedEvent.description}</Text>
              ) : null}

              <Text style={styles.sectionTitle}>Tickets</Text>
              <View style={styles.stack}>
                {selectedEvent.ticketTypes.map((ticketType) => (
                  <SellableCard
                    key={ticketType.id}
                    label={ticketType.name}
                    description={ticketType.description}
                    price={formatCurrency(ticketType.priceCents, ticketType.currency)}
                    availability={`${Math.max(ticketType.totalQuantity - ticketType.soldQuantity, 0)} left`}
                    inCart={getCartQuantity(ticketType.id)}
                    quantity={getDraftQuantity(ticketType.id)}
                    busy={busyKey === `ticket:${ticketType.id}`}
                    onDecrease={() => onDecreaseDraftQuantity(ticketType.id)}
                    onIncrease={() => onIncreaseDraftQuantity(ticketType.id)}
                    onAdd={() => onAddTicket(ticketType)}
                    actionLabel="Add ticket"
                  />
                ))}
              </View>

              <Text style={styles.sectionTitle}>Event extras</Text>
              <View style={styles.stack}>
                {selectedEvent.addOns.length ? (
                  selectedEvent.addOns.map((addOn) => (
                    <SellableCard
                      key={addOn.id}
                      label={addOn.name}
                      description={addOn.description ?? `${addOn.category} add-on`}
                      price={formatCurrency(addOn.priceCents, addOn.currency)}
                      availability={`${Math.max(
                        addOn.totalQuantity - addOn.soldQuantity - addOn.reservedQuantity,
                        0,
                      )} left`}
                      inCart={getCartQuantity(addOn.id)}
                      quantity={getDraftQuantity(addOn.id)}
                      busy={busyKey === `addon:${addOn.id}`}
                      onDecrease={() => onDecreaseDraftQuantity(addOn.id)}
                      onIncrease={() => onIncreaseDraftQuantity(addOn.id)}
                      onAdd={() => onAddAddOn(addOn)}
                      actionLabel={`Add ${addOn.category}`}
                      category={addOn.category}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="No extras on this event yet"
                    description="When an organiser adds food, drinks, combos or merch, they will appear here."
                  />
                )}
              </View>
            </>
          ) : null}
        </View>
      ) : (
        <EmptyState
          title="No events match your search"
          description="Try a different venue, date or event name."
        />
      )}
    </>
  );
}
