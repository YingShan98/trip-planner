# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

No test suite exists. Type-checking (`npm run typecheck`) is the primary correctness gate.

## Environment

`src/lib/supabase.ts` exports `sb` (the Supabase client, or `null` if env vars are missing) and `hasConfig` (boolean). All Supabase calls must guard against `sb === null`.

## Architecture

### Routing

No router library. `App.tsx` reads `?trip=<slug>` from the URL to decide which view to render. Navigation calls `history.pushState` directly and listens to `popstate` for the back button.

- No `?trip` → `<HomeView>` (trip list)
- `?trip=<slug>` → `<TripView slug={slug}>` (full trip editor/viewer)

### State model

All trip content is edited in-memory as `TripState` (`src/types.ts`), but the database stores it normalized across `trips`, `trip_days`, `activities`, `activity_links`, `checklist_items`, `packing_items`, `accommodations`, `accommodation_links`, `transport_options`, `budget_items`, and `trip_notes`. `src/lib/tripApi.ts:loadTrip()` reads all of these tables and assembles a `TripState` (via `blankState()` from `src/state.ts`) for the UI to consume.

`TripState` holds: `days`, `checklist`, `packing`, `hotels`, `transport`, `budget`, `notes`, `collapsed`, `foreignCurrency`, `exchangeRate`.

Row-level metadata (title, destination, dates, `home_currency`) lives on `TripMeta` (`src/lib/tripApi.ts`), separate from `TripState`.

### Mutation pattern

`TripView` owns the single `state: TripState` and passes two callbacks down to every section component:

- `mutate(fn)` — clones state via `structuredClone`, applies `fn`, sets state, then schedules a debounced (650 ms) save via `tripApi.ts:saveTrip()`/`saveSharedTrip()`.
- `mutateNoSave(fn)` — same clone-and-set but no save (used for UI-only state like collapsed sections).

Section components receive `{ state, editUnlocked, mutate, mutateNoSave? }` and never hold their own copies of trip data.

### Supabase interaction

All writes go through `src/lib/tripApi.ts`, which wraps Postgres RPCs (never direct `UPDATE` for trip content):
- `createTrip()` — inserts the `trips` row, requires an authenticated owner
- `saveTrip()` / `saveSharedTrip()` — call the `save_trip_workspace` RPC (the latter passes a share-token hash instead of relying on auth)
- `getTripRole()` — calls the `trip_role` RPC, returns `'owner' | 'editor' | 'viewer' | null`
- `createShare()` / `createViewShare()` / `loadSharedTrip()` / `revokeShares()` — the token-hashed share-link flow, backed by `create_trip_share`, `get_shared_trip_workspace`, `revoke_trip_shares`
- `deleteTrip()` — deletes the `trips` row (cascades to child tables)

Realtime: `TripView` subscribes to `postgres_changes` on `trips`, `trip_days`, `activities`, `budget_items`, and `trip_notes`, filtered by slug where applicable, and reloads via `loadTrip`/`loadSharedTrip` on any change. Incoming updates are ignored when the local user's save is in-flight (`saveInFlightRef`) or there are unsaved local edits, to avoid clobbering.

### Currency

Two currencies per trip: **home** (stored on `TripMeta.home_currency`, e.g. `MYR`) and **foreign** (stored in `TripState.foreignCurrency`, e.g. `CNY`). `TripState.exchangeRate` is `1 foreign = N home`. `BudgetItem.currency` and `TransportItem.currency` are `CurrencyKey = 'home' | 'foreign'`. Parsing helpers are in `src/lib/currency.ts`.

### Import / Export

Export: `TripView.exportJSON()` serialises `{ meta: TripMeta fields, data: TripState }` and downloads via `src/lib/download.ts`.
Import: handled in `HomeView` (file picker) → `NewTripModal`, which calls `createTrip()` with the imported `data` and metadata.
