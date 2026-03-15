import type { TicketPass } from '../../events/types';
import { TicketsPanel } from '../../events/components/panels/TicketsPanel';

export function TicketsFeature({
  busyKey,
  onRefreshTickets,
  tickets,
}: {
  busyKey: string | null;
  onRefreshTickets: () => Promise<void> | void;
  tickets: TicketPass[];
}) {
  return (
    <TicketsPanel
      busyKey={busyKey}
      onRefreshTickets={() => void onRefreshTickets()}
      tickets={tickets}
    />
  );
}
