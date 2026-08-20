# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server at http://localhost:5173/trip-planner/
npm run build      # tsc -b && vite build → dist/
npm run preview    # local preview of dist/
npm run typecheck  # type-check without emitting
npm run db:push    # apply pending Supabase migrations
npm run db:reset   # reset local Supabase database and replay migrations
```

No test suite exists. Type-checking (`npm run typecheck`) is the primary correctness gate.

## Environment

Copy `.env.example` to `.env` and fill in:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY` (anon/publishable key only)

`src/lib/supabase.ts` exports `sb` (the Supabase client, or `null` if env vars are missing) and `hasConfig` (boolean). All Supabase calls must guard against `sb === null`.

## Architecture

### Routing

No router library. `App.tsx` reads `?trip=<slug>` from the URL to decide which view to render. Navigation calls `history.pushState` directly and listens to `popstate` for the back button.

- No `?trip` → `<HomeView>` (trip list)
- `?trip=<slug>` → `<TripView slug={slug}>` (full trip editor/viewer)

### State model

All trip content lives in `TripState` (`src/types.ts`). The canonical source is the `data` JSONB column in `trip_documents`. On load, `TripView` fetches the row and passes `normalize(row.data)` through `src/state.ts:normalize()` to fill in defaults for any missing fields.

`TripState` holds: `days`, `checklist`, `hotels`, `transport`, `budget`, `notes`, `collapsed`, `foreignCurrency`, `exchangeRate`.

Row-level metadata (title, destination, dates, home `currency`) lives on `TripRow`, separate from `TripState.data`.

### Mutation pattern

`TripView` owns the single `state: TripState` and passes two callbacks down to every section component:

- `mutate(fn)` — clones state via `structuredClone`, applies `fn`, sets state, then schedules a debounced (650 ms) save to Supabase via the `save_trip` RPC.
- `mutateNoSave(fn)` — same clone-and-set but no save (used for UI-only state like collapsed sections).

Section components receive `{ state, editUnlocked, mutate, mutateNoSave? }` and never hold their own copies of trip data.

### Supabase interaction

All writes go through Postgres RPCs (never direct `UPDATE`):
- `create_trip` — admin-password gated
- `save_trip(p_slug, p_password, p_data)` — edit-password gated
- `verify_trip_password(p_slug, p_password)` → boolean
- `delete_trip(p_admin_password, p_slug)` → boolean
- `change_trip_password`

Realtime: `TripView` subscribes to `postgres_changes` on `trip_documents` filtered by slug. Incoming updates are ignored when the local user's save is in-flight (`saveInFlightRef`) to avoid clobbering.

### Currency

Two currencies per trip: **home** (stored on `TripRow.currency`, e.g. `MYR`) and **foreign** (stored in `TripState.foreignCurrency`, e.g. `CNY`). `TripState.exchangeRate` is `1 foreign = N home`. `BudgetItem.currency` and `TransportItem.currency` are `CurrencyKey = 'home' | 'foreign'`. Parsing helpers are in `src/lib/currency.ts`.

### Import / Export

Export: `TripView.exportJSON()` serialises `{ meta: TripRow fields, data: TripState }` and downloads via `src/lib/download.ts`.  
Import: handled in `SettingsModal` — parses the JSON, calls `save_trip` with the new `data`, and optionally updates trip metadata.

### Key files

| File | Purpose |
|---|---|
| `src/types.ts` | All shared TypeScript types |
| `src/state.ts` | `blankState`, `normalize`, `templateState`, default-object factories |
| `src/lib/supabase.ts` | `sb` client and `hasConfig` |
| `src/lib/tripActions.ts` | `deleteTripBySlug`, `copyTripLink` |
| `src/lib/toast.ts` | Global toast queue (consumed by `<Toast />`) |
| `src/components/trip/TripView.tsx` | State owner, Realtime subscription, save logic |
| `supabase/schema.sql` | Full DB schema, RLS, and RPC definitions |
