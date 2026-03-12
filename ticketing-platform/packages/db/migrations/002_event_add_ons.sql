CREATE TABLE IF NOT EXISTS event_add_ons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  price_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  total_quantity INT NOT NULL DEFAULT 0,
  reserved_quantity INT NOT NULL DEFAULT 0,
  sold_quantity INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cart_items
  ALTER COLUMN ticket_type_id DROP NOT NULL;

ALTER TABLE cart_items
  ADD COLUMN add_on_id UUID REFERENCES event_add_ons(id);

ALTER TABLE cart_items
  ADD COLUMN item_kind TEXT NOT NULL DEFAULT 'ticket';

ALTER TABLE cart_items
  ADD CONSTRAINT cart_items_item_kind_check CHECK (item_kind IN ('ticket', 'add_on'));

ALTER TABLE cart_items
  ADD CONSTRAINT cart_items_item_reference_check CHECK (
    (CASE WHEN ticket_type_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN add_on_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  );

ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_cart_id_ticket_type_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_cart_ticket_type_id
  ON cart_items(cart_id, ticket_type_id)
  WHERE ticket_type_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_cart_add_on_id
  ON cart_items(cart_id, add_on_id)
  WHERE add_on_id IS NOT NULL;

ALTER TABLE order_items
  ALTER COLUMN ticket_type_id DROP NOT NULL;

ALTER TABLE order_items
  ADD COLUMN add_on_id UUID REFERENCES event_add_ons(id);

ALTER TABLE order_items
  ADD COLUMN item_kind TEXT NOT NULL DEFAULT 'ticket';

ALTER TABLE order_items
  ADD CONSTRAINT order_items_item_kind_check CHECK (item_kind IN ('ticket', 'add_on'));

ALTER TABLE order_items
  ADD CONSTRAINT order_items_item_reference_check CHECK (
    (CASE WHEN ticket_type_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN add_on_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  );

CREATE INDEX IF NOT EXISTS idx_event_add_ons_event_id ON event_add_ons(event_id);
