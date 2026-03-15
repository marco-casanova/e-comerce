import { Pressable, Text, View } from 'react-native';

import { EmptyState, SummaryRow } from '../../../../core/ui/components';
import type { TicketPass } from '../../types';
import { buildEntryPayload, formatEventDateRange, formatShortDateTime } from '../../utils';
import { PassMatrix } from '../EventUi';
import { styles } from '../eventsScreenStyles';

export function TicketsPanel({
  busyKey,
  onRefreshTickets,
  tickets,
}: {
  busyKey: string | null;
  onRefreshTickets: () => void;
  tickets: TicketPass[];
}) {
  return (
    <>
      <View style={styles.panel}>
        <View style={styles.panelHeaderRow}>
          <Text style={styles.panelTitle}>Ticket wallet</Text>
          <Pressable onPress={onRefreshTickets} disabled={busyKey === 'tickets:refresh'}>
            <Text style={styles.clearText}>{busyKey === 'tickets:refresh' ? 'Refreshing...' : 'Refresh'}</Text>
          </Pressable>
        </View>

        <Text style={styles.eventDescription}>
          Each paid ticket gets a door payload. The current app renders a QR-style pass view and exposes the same
          payload text for manual scanning and debugging.
        </Text>
      </View>

      <View style={styles.stack}>
        {tickets.length ? (
          tickets.map((ticket) => {
            const payload = buildEntryPayload(ticket.id, ticket.eventId, ticket.code);

            return (
              <View key={ticket.id} style={styles.ticketCard}>
                <View style={styles.ticketHeader}>
                  <View>
                    <Text style={styles.ticketEventTitle}>{ticket.eventTitle}</Text>
                    <Text style={styles.ticketEventMeta}>{ticket.ticketTypeName}</Text>
                    <Text style={styles.ticketEventMeta}>
                      {formatEventDateRange(ticket.eventStartsAt, ticket.eventEndsAt)}
                    </Text>
                  </View>

                  <View style={[styles.ticketStatusChip, ticket.status === 'used' ? styles.ticketStatusUsed : null]}>
                    <Text style={styles.ticketStatusText}>{ticket.status}</Text>
                  </View>
                </View>

                <View style={styles.ticketBody}>
                  <PassMatrix payload={payload} />

                  <View style={styles.ticketMetaStack}>
                    <SummaryRow label="Venue" value={ticket.eventVenue ?? 'TBA'} />
                    <SummaryRow label="Ticket code" value={ticket.code} />
                    <SummaryRow label="Issued" value={formatShortDateTime(ticket.createdAt)} />
                    {ticket.usedAt ? (
                      <SummaryRow label="Checked in" value={formatShortDateTime(ticket.usedAt)} />
                    ) : null}
                  </View>
                </View>

                <View style={styles.payloadBox}>
                  <Text style={styles.payloadLabel}>Door payload</Text>
                  <Text style={styles.payloadText}>{payload}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <EmptyState
            title="No ticket passes yet"
            description="Complete the checkout flow and refresh the wallet after Stripe confirms payment."
          />
        )}
      </View>
    </>
  );
}
