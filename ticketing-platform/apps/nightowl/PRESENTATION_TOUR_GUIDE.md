# Night Owl Presentation Tour Guide

This guide is written as a **15-slide presentation script** that you can use to build a PowerPoint.

Target balance:

- around **70% mobile app**
- around **30% platform, Docker, and backend**

Important note:

- the current repository contains the new TypeScript/Expo/Fastify platform
- it does **not** contain the old Ruby on Rails codebase
- because of that, the Rails section below is a **migration explanation based on the current architecture and common legacy-platform patterns**, not a literal code walkthrough of the old app

---

## Slide 1. Title

### Slide title

**Night Owl: From Mobile Ticketing MVP to Composable Commerce Platform**

### Slide bullets

- Expo React Native mobile app for events and ticketing
- Fastify microservice platform behind the app
- Stripe-powered checkout and ticket issuance
- Modular architecture designed for MVP demo and future scale

### Speaker notes

This presentation explains Night Owl as both a product and a system. The focus is mainly on the mobile app because that is where most of the user experience and feature orchestration happens. Then I will show how the backend, Docker setup, and composable commerce architecture support that experience.

---

## Slide 2. Product Goal

### Slide title

**What Night Owl Solves**

### Slide bullets

- Lets users discover events, buy tickets, and store passes in one app
- Lets staff validate tickets at the door
- Connects mobile UX to a modular backend instead of a monolith
- Keeps the demo usable even when APIs are unavailable

### Speaker notes

The core product idea is simple: one mobile app for event discovery, checkout, ticket wallet, and scanning. The technical value is that the app is not just a UI shell. It coordinates authentication, shopping-cart behavior, Stripe checkout, ticket retrieval, and scanning, while staying modular and resilient.

---

## Slide 3. MVP User Journey

### Slide title

**End-to-End MVP Flow**

### Slide bullets

- User logs in or restores a previous session
- User browses events and ticket types
- User adds tickets and add-ons to cart
- User creates an order and completes Stripe payment
- User sees issued tickets in wallet
- Staff scans and validates entry

### Speaker notes

This is the full MVP story. It is not just browsing. It goes from authentication to payment to issued ticket to on-site validation. That makes it a complete business flow rather than a partial prototype.

---

## Slide 4. Mobile App Architecture

### Slide title

**How the Mobile App Is Structured**

### Slide bullets

- `App.tsx` stays minimal and delegates to `AppRoot`
- `src/app` owns bootstrapping and root composition
- `src/core` owns API, auth, errors, config, monitoring, payments
- `src/features` owns user-facing domain logic and UI

### Speaker notes

The app is structured in layers. The app layer composes providers and route selection. The core layer contains reusable infrastructure such as the HTTP client, auth persistence, runtime config, error reporting, and Stripe setup. The feature layer contains the actual business behavior, such as login and the events experience.

### Reference files

- [App.tsx](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/App.tsx)
- [AppRoot.tsx](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/app/AppRoot.tsx)
- [AppProviders.tsx](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/app/AppProviders.tsx)

---

## Slide 5. Production-Ready App Shell

### Slide title

**The App Shell Is Composed for Reliability**

### Slide bullets

- Safe area, status bar, auth provider, Stripe provider, error boundary
- Root navigator chooses login or events experience
- Global crash fallback prevents blank-screen failure
- Observability is pluggable and environment-driven

### Speaker notes

For production readiness, I moved the app bootstrap into composable providers. That means if I need to add more cross-cutting concerns later, such as analytics or feature flags, I can do it in one place. I also added a global error boundary so render-time crashes fail gracefully instead of leaving the app broken.

### Reference files

- [AppProviders.tsx](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/app/AppProviders.tsx)
- [RootNavigator.tsx](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/app/RootNavigator.tsx)
- [AppErrorBoundary.tsx](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/core/errors/AppErrorBoundary.tsx)

---

## Slide 6. Authentication and Session Restore

### Slide title

**Authentication Is Designed for Mobile Reality**

### Slide bullets

- Tokens are stored in `expo-secure-store`
- Session is restored on startup
- HTTP client receives the current access token automatically
- Corrupted stored sessions are cleaned up instead of crashing hydration

### Speaker notes

Mobile apps cannot assume a fresh login every time. This app restores the session from secure storage, updates the HTTP client token provider, and then chooses the correct screen. I also hardened the storage layer so invalid or corrupted session payloads do not break bootstrapping.

### Reference files

- [AuthProvider.tsx](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/core/auth/AuthProvider.tsx)
- [authStorage.ts](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/core/auth/authStorage.ts)
- [authApi.ts](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/features/auth/api/authApi.ts)

---

## Slide 7. Event Discovery Experience

### Slide title

**The Main Feature Was Refactored from a Monolith**

### Slide bullets

- `EventsScreen` is now a composition layer
- `useEventsExperience` owns orchestration and state transitions
- Panels separate Discover, Cart, Tickets, and Scanner concerns
- Shared UI primitives keep feature rendering consistent

### Speaker notes

This is one of the strongest parts of the architecture. Originally, the events experience was much more monolithic. The current version moves orchestration into a dedicated hook and keeps the screen focused on composition. That makes the feature easier to reason about, easier to test, and easier to extend.

### Reference files

- [EventsScreen.tsx](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/features/events/components/EventsScreen.tsx)
- [useEventsExperience.ts](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/features/events/hooks/useEventsExperience.ts)
- [DiscoverPanel.tsx](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/features/events/components/panels/DiscoverPanel.tsx)

---

## Slide 8. Cart and Commerce Behavior

### Slide title

**The App Behaves Like a Small Commerce Client**

### Slide bullets

- Catalog data is mapped into app models
- Cart supports tickets and event add-ons
- Order creation is separate from payment confirmation
- Checkout UI clearly reflects order state and Stripe state

### Speaker notes

This is where the app becomes more than a simple event browser. It behaves like a commerce client. The user selects products, the cart is updated through API calls, then the app creates an order, and only after that does it continue to payment. That separation is important because it matches real commerce workflows.

### Reference files

- [eventsApi.ts](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/features/events/api/eventsApi.ts)
- [CartPanel.tsx](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/features/events/components/panels/CartPanel.tsx)
- [types.ts](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/features/events/types.ts)

---

## Slide 9. Stripe Mobile Checkout

### Slide title

**Stripe Is Integrated the Right Way for Mobile**

### Slide bullets

- Mobile uses `@stripe/stripe-react-native`
- Backend creates PaymentIntent, customer, and ephemeral key
- App opens PaymentSheet and confirms payment in-app
- Webhook finalizes the business flow and issues tickets

### Speaker notes

The mobile app does not touch Stripe secret keys. It calls the backend to prepare the payment session. The backend returns the `clientSecret`, `customerId`, and ephemeral key secret. Then the app presents Stripe PaymentSheet. This is the correct separation of responsibilities for a production mobile integration.

### Reference files

- [stripeConfig.ts](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/core/payments/stripeConfig.ts)
- [useEventsExperience.ts](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/features/events/hooks/useEventsExperience.ts)
- [services/checkout/src/index.ts](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/services/checkout/src/index.ts)

---

## Slide 10. Ticket Wallet and Scanner

### Slide title

**The Purchase Ends in a Usable Operational Flow**

### Slide bullets

- Paid orders generate tickets
- Wallet displays passes linked to event metadata
- Staff role can validate scans
- Scan result updates ticket state and prevents reuse

### Speaker notes

A strong demo does not stop at checkout success. It shows the business outcome. Here, the outcome is a usable ticket wallet plus a staff-side scanner flow. That closes the loop from payment to venue operations.

### Reference files

- [TicketsPanel.tsx](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/features/events/components/panels/TicketsPanel.tsx)
- [ScannerPanel.tsx](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/features/events/components/panels/ScannerPanel.tsx)
- [services/tickets/src/index.ts](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/services/tickets/src/index.ts)

---

## Slide 11. Resilience and Production Readiness

### Slide title

**Why the App Is MVP-Demo Ready**

### Slide bullets

- Fallback to mock data when APIs are unreachable
- Request timeout, retry, and request ID handling in the HTTP client
- Error boundary and fatal fallback screen
- Runtime config, tests, and CI workflow added

### Speaker notes

This is where the project starts to look more production-minded. The app handles unstable backend conditions better, avoids common startup failures, and now has basic test and CI coverage around core utility behavior. That is enough to support a strong MVP demo without pretending it is fully enterprise-complete.

### Reference files

- [httpClient.ts](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/core/api/httpClient.ts)
- [mockEventsStore.ts](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/apps/nightowl/src/features/events/api/mockEventsStore.ts)
- [nightowl-mobile-quality.yml](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/.github/workflows/nightowl-mobile-quality.yml)

---

## Slide 12. Platform Architecture

### Slide title

**Composable Commerce and MACH-Inspired Platform**

### Slide bullets

- Mobile app is the front-end experience layer
- Backend is split into focused services: auth, catalog, cart, orders, checkout, tickets
- API gateway provides optional single entry point
- Shared packages hold contracts, auth, RBAC, DB, and common bootstrap logic

### Speaker notes

This is best described as a composable commerce or MACH-inspired design. It is not a single monolith where checkout, catalog, user management, and analytics all live in one codebase. Instead, the system is decomposed into domain services with shared infrastructure libraries.

MACH here means:

- Microservices
- API-first
- Cloud-friendly design
- Headless front-end client

This project is not a full enterprise MACH platform, but it clearly follows that direction.

### Reference files

- [README.md](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/README.md)
- [services/api-gateway/src/index.ts](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/services/api-gateway/src/index.ts)
- [packages/contracts/openapi/checkout.yaml](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/packages/contracts/openapi/checkout.yaml)

---

## Slide 13. Docker and Local Platform Delivery

### Slide title

**Docker Makes the Platform Reproducible**

### Slide bullets

- Docker provides Postgres, Redis, and optional service runtime
- `docker compose up -d postgres redis` starts core infrastructure
- `docker compose --profile services up` can start full backend stack
- Compose now runs compiled service output to avoid cross-platform runtime issues

### Speaker notes

Docker is important here because it stabilizes local infrastructure. PostgreSQL and Redis become consistent across machines, and the service profile can also run the backend stack. During this project I also fixed the service profile to run compiled Node output instead of `tsx watch`, because mounted `node_modules` created an `esbuild` platform mismatch between macOS and Linux containers.

### Reference files

- [docker-compose.yml](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/docker-compose.yml)
- [docker/dev.Dockerfile](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/docker/dev.Dockerfile)
- [README.md](/Users/marcocasanova/Projects/Companies/C85/nightowl-platform/ticketing-platform/README.md)

---

## Slide 14. Legacy Ruby on Rails Platform

### Slide title

**How I Would Explain the Old Ruby on Rails Platform**

### Slide bullets

- Old platform was likely a monolithic Rails app handling many business domains together
- Checkout, catalog, user management, and operations probably lived in one deployable system
- That model is faster for early delivery but gets harder to evolve independently
- Night Owl represents a move toward a modular, API-first replacement

### Speaker notes

This part should be presented honestly.

You can say:

> The old platform was a traditional Rails-style monolith, which is a strong choice early on because it speeds up development, keeps everything in one codebase, and makes deployment simple. But as product scope grows, the downside is tighter coupling between domains like catalog, checkout, ticketing, and operations. The new platform moves toward a composable architecture where each domain can evolve more independently.

Because the Rails codebase is not present in this repository, do not claim to have inspected it line by line. Present it as the legacy business context that this system improves on.

Good migration framing:

- Rails monolith optimized for speed of initial delivery
- new platform optimized for modularity, API boundaries, and mobile-first integration
- migration is not about saying Rails is bad
- migration is about matching architecture to current product needs

---

## Slide 15. Closing Slide

### Slide title

**Why This MVP Is Strong**

### Slide bullets

- Complete user flow from login to paid ticket to entry validation
- Mobile-first architecture with modular feature boundaries
- Backend supports composable commerce patterns
- Docker and CI improve repeatability and demo reliability
- Clear path from MVP to production platform

### Speaker notes

The strongest message is that this is not just a pretty mobile UI. It is a coherent system. The app shows product thinking, modular architecture, operational flow, payment integration, and a clear evolution from legacy monolithic thinking toward a more composable platform.

If you want a final one-sentence close, use this:

> Night Owl is a modular mobile ticketing MVP backed by a composable service platform, designed to deliver a complete commerce and operations flow while staying ready for future scale.

---

## Suggested PowerPoint Build Tips

Use this structure for each slide:

- top: slide title
- left: 3 to 5 bullets
- right: architecture diagram, app screenshot, or flow diagram
- presenter notes: use the speaker notes from this guide

Good visuals to add:

- login screen
- events screen with tabs
- cart and Stripe checkout lane
- tickets wallet
- scanner screen
- system diagram showing app -> gateway -> services -> Postgres/Redis/Stripe
- migration diagram showing Rails monolith -> composable platform

---

## Suggested Slide Weighting

If you want the 70/30 balance very explicitly:

- Slides 1 to 11: app-focused
- Slides 12 to 15: backend, Docker, composable architecture, legacy platform

That gives you an app-heavy presentation while still proving you understand the full system.
