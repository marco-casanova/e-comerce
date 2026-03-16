# Nightowl Detox E2E

This suite runs the mobile app in a deterministic local demo mode so the core journey is testable without live backend services or real Stripe UI.

## What E2E mode does

- forces the events/cart/checkout flows to use the local seeded mock store
- uses local demo auth instead of the backend login endpoint
- keeps the purchase flow meaningful: add a ticket, create an order, mark payment as paid, and surface the ticket in the wallet

## Demo accounts

- `attendee@nightowl.local` / `nightowl123`
- `staff@nightowl.local` / `nightowl123`
- `admin@nightowl.local` / `nightowl123`

Any email containing `staff` or `admin` also maps to those roles while running in mock auth mode.

## Commands

From the repo root:

```bash
pnpm e2e:build:ios
pnpm e2e:test:ios
```

From the app folder:

```bash
cd ticketing-platform/apps/nightowl
pnpm e2e:build:ios
pnpm e2e:test:ios
```

These commands use the bundled `Debug` simulator build by default because it is the most reliable local Detox setup for this Expo/React Native app. The `Release` build is still available if you want to harden CI later:

```bash
pnpm e2e:build:ios:release
pnpm exec detox test --configuration ios.sim.release --cleanup
```

If you want to watch the simulator while the suite runs:

```bash
pnpm e2e:test:ios:headed
```

The first `e2e:build:ios` is the slowest because Detox rebuilds the native iOS app with a bundled JS payload. Re-running `e2e:test:ios` after that is much faster unless the app code changes.

## Covered flows

- attendee login
- browse seeded events
- add a ticket to cart
- checkout in local mock payment mode
- ticket wallet visibility after payment
- staff access to the scanner flow
