export function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatEventDateRange(startsAt: string, endsAt: string | null) {
  const startDate = new Date(startsAt);
  const endDate = endsAt ? new Date(endsAt) : null;

  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const startLabel = `${dateFormatter.format(startDate)} · ${timeFormatter.format(startDate)}`;
  if (!endDate) {
    return startLabel;
  }

  const sameDay = startDate.toDateString() === endDate.toDateString();
  const endLabel = sameDay
    ? timeFormatter.format(endDate)
    : `${dateFormatter.format(endDate)} · ${timeFormatter.format(endDate)}`;

  return `${startLabel} - ${endLabel}`;
}

export function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function buildEntryPayload(ticketId: string, eventId: string, code: string) {
  return `nightowl|ticket=${ticketId}|event=${eventId}|code=${code}`;
}

export function extractTicketIdFromPayload(input: string) {
  const explicitTicket = input.match(/ticket=([0-9a-f-]{36})/i)?.[1];
  if (explicitTicket) {
    return explicitTicket;
  }

  return input.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0] ?? null;
}

function hashValue(seed: string) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function buildPassMatrix(payload: string, size = 21) {
  const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => false));

  function paintFinder(top: number, left: number) {
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const isBorder = row === 0 || row === 6 || column === 0 || column === 6;
        const isCore = row >= 2 && row <= 4 && column >= 2 && column <= 4;
        matrix[top + row][left + column] = isBorder || isCore;
      }
    }
  }

  paintFinder(0, 0);
  paintFinder(0, size - 7);
  paintFinder(size - 7, 0);

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const inFinder =
        (row < 7 && column < 7) ||
        (row < 7 && column >= size - 7) ||
        (row >= size - 7 && column < 7);

      if (inFinder) {
        continue;
      }

      const cellHash = hashValue(`${payload}:${row}:${column}`);
      matrix[row][column] = cellHash % 3 === 0 || cellHash % 5 === 0;
    }
  }

  return matrix;
}
