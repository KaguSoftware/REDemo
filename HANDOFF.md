# Kagu Emlak — Handoff

> Read this first when starting a fresh chat. Companions: [PRODUCT.md](PRODUCT.md) ·
> [README.md](README.md) · [AGENTS.md](AGENTS.md) · [LAUNCH_RUNBOOK.md](LAUNCH_RUNBOOK.md) ·
> plan file: `C:\Users\MnS\.claude\plans\so-ive-got-some-zesty-shannon.md`

## Working style
- **Collaborate**: propose with a recommendation before locking user-facing or
  schema decisions. Don't unilaterally commit.
- **Plan mode** for non-trivial work; owner approves before build.
- **Migrations are applied by hand** in the Supabase SQL editor, not `db push`
  (see Gotchas — there is a data-destroying trap in `db push` on this repo).
- Git author is Parsa only — **no Co-Authored-By trailers**.
- Keep this file and the memory index in lockstep.

## What this is
Multi-tenant SaaS for Turkish emlak (real-estate) offices: property portfolio with
tapu fields, a lead CRM with preference-based matching, tenants/leases/rent
payments, and generated Turkish/Arabic contract PDFs. UI is entirely Turkish.
Agents are heavily mobile; owners work desktop. See [PRODUCT.md](PRODUCT.md).

**Current goal**: a 3-phase build derived from a real-estate source's field notes.
The thesis — Kagu is not a Sahibinden competitor; it is the *private* inventory
Sahibinden structurally cannot hold (unlisted new-construction project units that
arrive as construction-company Google Drive folders), made instantly retrievable
when a client states a budget.

## Stack & environment
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind v4 +
daisyUI 5 · Supabase (Postgres + RLS on every table, magic-link auth, Storage) ·
@react-pdf/renderer · Leaflet · Zustand · zod · vitest. Dev OS: Windows 11.

> ⚠️ This repo pins a Next.js version with breaking changes vs. public docs. Read
> [AGENTS.md](AGENTS.md) and `node_modules/next/dist/docs/` before Next-specific work.

## Conventions
- All data access is client-side through `src/lib/db/*`; **authorization is RLS**,
  never app code. Team-scoped via `is_team_member(team_id)`; writes additionally
  gated on `team_is_writable(team_id)`.
- Inputs validated with zod at the db boundary (`src/lib/schemas/inputs.ts`).
- **No FX conversion anywhere.** Rentals are usually TRY, sales often USD. Money is
  only ever compared within one currency — see the budget guard in `score.ts`.
- Client caching: `src/lib/useCachedResource.ts` (stale-while-revalidate); call
  `invalidateCache(prefix)` after mutations. **Branch on `data === null` before
  `data.length === 0`** — see the flash pass.
- **Every authenticated page wraps its content in `<ServerSeed>`**; the root
  layout must stay free of `cookies()`/`headers()`.
- A refined zod schema (`.refine()`) has no `.partial()`. Export an unrefined base
  and a separate patch schema — see `leadInputObject` / `leadPatchSchema`.

## Current status

### ✨ FLASH PASS (2026-07-27) — uncommitted on `main`, no migration, NOT yet driven in a browser
Green: `typecheck`, `lint` (0 errors; the one warning is pre-existing, in `promo/`),
`npm test` (**164 passed**, 18 files — 1 new), `npm run build`.

The symptom was "a split second of random things on every page." It was **five
visual states** rendering in sequence before real data:

| # | What you saw | Cause |
|---|---|---|
| 0 | No sidebar, content 256px off, a **"Giriş yap" button**, "…giriş yapın" cards. Brand accent stripped to stock terracotta. | `user`/`team` were `null` until AuthProvider's effect resolved. `BrandTheme` ran while the team was merely *unknown* and **deleted** the accent the boot script had painted, plus its localStorage snapshot. |
| 1 | Sidebar pops in, content jumps 256px, nav marker glides in from the last route's position. | `getClaims()` resolves. The marker's Y was in **sessionStorage**, which survives reloads. |
| 2 | Workspace name changes, logo/bell appear, trial banner shoves the page down, every primary button changes colour. **Only now do fetches start.** | `team` lands a round-trip later; `useTeamReady()` gates nearly every `enabled` flag in the app. |
| 3 | **"Henüz taşınmaz yok" + "İlk taşınmazınızı ekleyin"**, "Henüz müşteri yok", "Henüz belge yok". | ⚠️ **The root cause** — see the rule below. |
| 4 | Real data. | |

⚠️ **THE RULE THIS PASS ADDS: a loading flag must be derivable during the FIRST
render.** `useCachedResource.loading` was `!cached && fetching`, and `fetching`
was set in a `queueMicrotask` *inside the effect* — so it was `false` for the
first paint and **every `loading ? <Skeleton/> : <EmptyState/>` in the app
rendered the empty state first**. One line, ~13 screens. It is now derived from
`settledAttempt !== attempt` (state, not a ref — a ref read during render is
what `react-hooks/refs` is pointing at). Pinned by
[useCachedResource.test.tsx](src/lib/useCachedResource.test.tsx).

⚠️ **`data === null` ≠ `data === []`.** "Not loaded" and "loaded and genuinely
empty" are different answers, and `data ?? []` erases the difference — that is
how an agent with a full portfolio got told they had no properties. **Always
branch on `null` first.** Fixed in `HomeDashboard`, `CommissionSummary`,
`DocumentsDashboard`, `ContactDashboard`.

⚠️ **DO NOT read cookies/headers in `src/app/layout.tsx`.** Seeding the session
there is the obvious move and it is wrong: it opts *every* route into on-demand
rendering. **Measured** — it turned `/gizlilik-politikasi`,
`/kullanim-kosullari`, `/kvkk-aydinlatma` and `/signup` from `○` static to `ƒ`
dynamic. Seeding lives in **`<ServerSeed>`**
([ServerSeed.tsx](src/components/auth/ServerSeed.tsx)), which each authenticated
*page* renders; those pages already read the session for their redirect guard,
and `getServerAppContext` is `cache()`d, so it is free there. Verified against a
baseline build that the static set is byte-identical, and that
`staleTimes {dynamic:30, static:180}` survives in `.next/required-server-files.json`.

Also fixed:
- **Hydration mismatch.** `useCachedResource` called `getEntry()` (which reads
  sessionStorage) *during render*: server emitted an empty list, client emitted
  rows, React threw the subtree away. Now `useSyncExternalStore` with an
  `undefined` server snapshot. A `renderToString` test pins it.
- **Nav marker** uses [navMarkerState.ts](src/components/ui/navMarkerState.ts)
  (module scope, resets with the document) instead of sessionStorage, so it
  glides only on a real client-side navigation.
- **Three write-only store slices deleted** — `isLoadingProperties/Leads/Projects`
  were mirrored in via `useEffect` (one extra stale frame each) and two of them
  were never read at all. `PropertyTable` takes `isLoading` as a prop.
- **ThemeToggle** no longer animates the hydration correction (a dark-mode user's
  server snapshot must be "light", so the icon self-corrects on every load — and
  `animate-theme-swap` turned that into a visible flicker).
- **TrialBanner** takes `serverNow`, so it is in the SSR HTML instead of being
  inserted after hydration and shoving the page down.

**Skeletons.** [Skeleton.tsx](src/components/ui/Skeleton.tsx) primitives +
[skeletons.tsx](src/components/ui/skeletons.tsx) per-surface shapes, and
`loading.tsx` on 10 routes (there were **zero** before; all four `Suspense`
fallbacks were `null`, and the one skeleton in the codebase was unreachable dead
code because of the `loading` bug). **The rule: a skeleton occupies the exact
geometry of what replaces it** — if you change a table's row padding, change its
skeleton. One breathing animation per *surface* (on `.skeleton-group`), not per
bar. Two panels deliberately have **no** skeleton — `AttentionPanel` and
`MatchingLeads` usually resolve to "render nothing", so reserving space would
guarantee a collapse instead of preventing a jump.

**Not done, by design:** `/team`, `/settings/*`, `/onboarding` and `/auth/switch`
are `"use client"` pages with no server component to wrap, so they still resolve
auth client-side. Seeding degrades gracefully (`teamLoaded === false` → the old
client bootstrap runs), so they work exactly as before. Giving them an async
segment layout would block on a blank screen, which is worse than what it fixes.

**⚠️ Not driven in a browser.** No browser tooling was available in that session.
The honest remaining test is the filmstrip check in *Roadmap* step 1.

### ⚡ PERF PASS (2026-07-20) — SHIPPED on `main`, no migration, not yet driven in a browser
Four commits: `bfe9cdf` (auth) · `2e354ad` (client-side filtering) · `29ce06e`
(query chains + batching) · `57865aa` (route cache). Green: `typecheck`, `lint`
(zero warnings), `npm test` (**156 passed**, 17 files — 16 new), `npm run build`.
Every number below was **measured against production**, warm connection, median of 8.

| | before | after |
|---|---|---|
| Auth checks per page load (×3) | 994ms | ~0ms |
| Property detail query | 1339ms | 337ms |
| Detail page waves | 662ms | 331ms |
| Applying a filter / a keystroke | 329ms | **0 (no network)** |
| Bulk delete, 20 rows | 6598ms | 332ms |

**⚠️ THE ONE RULE: a round-trip costs ~330ms; a query added to an EXISTING wave
costs ~12ms.** Verified here, not inherited: 1 query = 327ms · 6 queries in one
`Promise.all` = 339ms · the same 6 serially = **1961ms**. Count *waves*, never
queries. A new stat belongs inside a page's existing `Promise.all`.

1. **`getUser()` → `getClaims()`.** `getUser()` is a network call to the auth
   server (**measured 331ms**); the project signs JWTs with **ES256**, so
   `getClaims()` verifies locally via WebCrypto (~0.1ms) and still refreshes an
   expiring session. It was called **37 times**: proxy, every page, AuthProvider,
   and each db helper — so a page paid it three times before requesting a row.
   Auth cost more than the data did. Shared helpers: **`getUserId(supabase)`**
   (`lib/supabase/server.ts`) server-side, **`requireUser()`**
   (`lib/db/requireUser.ts`) client-side — the latter replaced **13 copy-pasted
   copies that had already drifted** (6 local, 7 paying the round-trip).
   ⚠️ **`auth/callback/route.ts` deliberately keeps `getUser()`** — it straddles
   the token exchange where the session is mid-transition, and runs once per
   sign-in. Don't "finish the job" there.
2. **Filtering moved into the browser** (`lib/clientFilters.ts`, 16 tests).
   Every filter value used to be folded into the SWR cache key, so each dropdown
   pick and each debounced keystroke minted a new key and refetched. Lists are
   now fetched once under one stable key and narrowed locally. **The 250ms/300ms
   search debounces are gone** — they only existed to rate-limit the network.
   ⚠️ Two traps this hit, both now pinned by tests: **`Number(null)` is 0**, so a
   NULL `list_price` passed every max-price filter and read as free; and Turkish
   casing needs **`toLocaleLowerCase("tr")`** or searching "istanbul" misses
   "İstanbul". ⚠️ Filter dropdowns read a separate **`allProperties`** store slice
   — building options from the *visible* rows makes them collapse as you narrow,
   and you can never widen again.
3. **Serial chains collapsed.** `getProperty()` walked property → lease → tenant
   → payments (**1339ms**) and is now one embedded select (**337ms**).
   ⚠️ It must name **`tenants!leases_tenant_id_fkey`**: `leases` references
   `tenants` twice (tenant + guarantor), so the plain form is ambiguous
   (PGRST201). `getActiveSaleForProperty` had the same shape. `PropertyDetail`
   awaited the property *then* decided whether to fetch the sale — both only need
   the URL id, so they now share one wave.
4. **Bulk deletes batch** (`deleteProperties`/`deleteLeads`/`deleteTenants`) —
   was one round-trip **per row**.
5. **Hover warms the data, not just the route.** `router.prefetch` only fetched
   the bundle, leaving the detail page to wait a full round-trip on arrival.
   `warmProperty()` starts the query on hover; `takeWarmProperty()` **consumes**
   it, so a post-mutation reload can never serve a stale warm copy.
6. **`staleTimes: {dynamic: 30, static: 180}`** — Next 15+ defaults `dynamic` to
   **0**, so even Back re-ran the server component. Confirmed honoured in
   `.next/required-server-files.json`, not silently dropped.
7. **Duplicate cache keys folded together.** `leads:recent`, `leads:for-matching`
   and `properties:for-matching` were the same unfiltered queries under different
   names; the dashboard and list pages now hydrate each other.

⚠️ **DO NOT add a Vercel `regions` setting.** The KaguOs handoff's single biggest
win (~30%) was moving compute to the DB's region — **it does not apply here**.
Measured: `CF-RAY …-IST`, connect **38ms** — Supabase already fronts through
Cloudflare in Istanbul. Copying `hnd1` from that doc would make this app slower.

**Not yet driven in a real browser** (no session available here): the honest
remaining test is sign-in / sign-out / token refresh and the team-less →
`/onboarding` bounce, in a **fresh incognito window**. Auth is the area most able
to break, which is why it shipped as its own commit.

**All three phases are COMPLETE in code; NONE are live in the database.**
Verified 2026-07-20: `npm run typecheck`, `npm run lint`, `npm test`
(**98 passed**, 12 files) and `npm run build` all pass.

**Phase 1 — lead budget.** Budget is a first-class concept:
`leads.pref_min_price/max_price/currency`, price+currency filtering on
properties, and a scored match dimension (+3, reason `"bütçe içinde"`) that
hard-fails out-of-range but **skips** on currency mismatch or unpriced property.
Budget flows lead → "Eşleşen taşınmazları bul" → property filters → URL params.

**Phase 2 — projects.** `/projects` list (grouped by müteahhit firma) + detail
with the Drive button; full CRUD in `src/lib/db/projects.ts`; project selector
and "Sıfır / İkinci el" on the property form; new-build filter on the portfolio;
and `MatchingProjects`, which surfaces projects whose `price_from` fits the
active budget filter (same-currency only, never folded into the scorer).

**Phase 3 — brochure.** A `brochure` DocKind renders one page per selected
property, reusing the existing `PropertyListing` section. Wired to a
"Broşür oluştur" button in the property table's existing `BulkActionBar`.

**Phase 5 — the gap backlog.** WhatsApp prefill with team-editable templates;
work notifications (overdue rent, expiring lease, quiet lead, project delivery)
swept daily; commission & earnings reporting on the dashboard.

✅ **All migrations are applied** — remote history in sync at 0001–0030
(verified 2026-07-20 via `supabase migration list --linked`).
✅ **`run_work_checks()` idempotency verified on the live database**: first run
inserted 4, second inserted 0.
✅ **Both cron sweeps verified blocked for the anon key** (SQLSTATE 42501) and
working for `service_role`.

⚠️ **None of it has been clicked through in a browser yet.** Schema is live and
the code compiles and passes 113 tests, but no phase has been exercised by a
real user against real data. The brochure has a genuine render test; the rest is
compile-time confidence only.

## File map (key files)
| File | What it does |
| --- | --- |
| [supabase/migrations/0026_budget_and_projects.sql](supabase/migrations/0026_budget_and_projects.sql) | *Applied.* Lead budget columns, `projects` table + RLS, `properties.project_id`/`is_new_build`, cross-team guard trigger |
| [supabase/migrations/0027_contact_activity.sql](supabase/migrations/0027_contact_activity.sql) | *Applied.* `contact_activity` table + RLS + cross-team guard; fixes the notes-clobbering data loss |
| [src/lib/db/contactActivity.ts](src/lib/db/contactActivity.ts) | Activity CRUD; also advances `leads.last_call_at` (never backwards) |
| [src/components/contacts/ActivityTimeline.tsx](src/components/contacts/ActivityTimeline.tsx) | Per-contact timeline + composer, mounted in Lead/Tenant forms (edit mode only) |
| [src/components/ui/Combobox.tsx](src/components/ui/Combobox.tsx) | Free-text input with filtered suggestions; used for city (81 provinces) |
| [src/lib/turkeyGeo.ts](src/lib/turkeyGeo.ts) | `TURKEY_PROVINCES` + `foldTr` (Turkish dotted-i-safe search folding) |
| [src/components/ui/DatePicker.tsx](src/components/ui/DatePicker.tsx) | Custom calendar replacing native `<input type="date">` everywhere |
| [src/lib/commission.ts](src/lib/commission.ts) | **`KDV_RATE` (0.20) lives here — never inline it.** Commission maths + per-currency totals |
| [src/lib/whatsappMessage.ts](src/lib/whatsappMessage.ts) | Token whitelist + template rendering; the reason a message can't leak homeowner/tapu data |
| [supabase/migrations/0029_work_notifications.sql](supabase/migrations/0029_work_notifications.sql) | `run_work_checks()` — the daily work sweep; every insert guarded by a 30-day NOT EXISTS |
| [supabase/migrations/0030_revoke_sweep_execute.sql](supabase/migrations/0030_revoke_sweep_execute.sql) | Closes the anon-callable sweep hole. **Revoke from PUBLIC, not just anon/authenticated** |
| [src/lib/matching/score.ts](src/lib/matching/score.ts) | The match engine. Budget dimension + currency guard live here |
| [src/lib/db/types.ts](src/lib/db/types.ts) | Row types — `Lead`, `Property`, new `Project` |
| [src/lib/db/properties.ts](src/lib/db/properties.ts) | `PropertyFilter` (price/currency/project) + `listProperties` |
| [src/lib/schemas/inputs.ts](src/lib/schemas/inputs.ts) | zod boundary; `leadInputSchema` / `leadPatchSchema` split |
| [src/components/leads/LeadForm.tsx](src/components/leads/LeadForm.tsx) | Lead sheet; budget row leads the preferences block |
| [src/components/properties/PropertyFilters.tsx](src/components/properties/PropertyFilters.tsx) | Filter bar; "Bütçe" range, currency appears only once a bound is set |
| [src/components/properties/PropertyDashboard.tsx](src/components/properties/PropertyDashboard.tsx) | Store↔URL↔query filter mapping — the 3-place pattern any new filter must follow |
| [src/store/useAppStore.ts](src/store/useAppStore.ts) | Zustand `Filters` shape + `EMPTY_FILTERS`; `projects` slice |
| [src/lib/db/projects.ts](src/lib/db/projects.ts) | Project CRUD; `normalizeBlanks` turns "" into NULL for date/url columns |
| [src/components/projects/](src/components/projects/) | `ProjectDashboard`, `ProjectForm`, `ProjectDetail`, `MatchingProjects` |
| [src/lib/pdf/document.tsx](src/lib/pdf/document.tsx) | `PDFDocument`: cover + N content pages. Brochure = one page per property |
| [src/lib/pdf/imageData.ts](src/lib/pdf/imageData.ts) | `toDataUrl` — shared by the single-listing and brochure exports |
| [src/lib/pdf/brochure.test.tsx](src/lib/pdf/brochure.test.tsx) | Real `renderToBuffer` page-count assertions; guards the multi-page restructure |
| [src/lib/useCachedResource.ts](src/lib/useCachedResource.ts) | SWR cache. **`loading` must be true on the first render** — see the flash pass |
| [src/lib/useCachedResource.test.tsx](src/lib/useCachedResource.test.tsx) | Pins that rule + the `null` vs `[]` distinction + the SSR snapshot. First jsdom suite (opt in per-file with `// @vitest-environment jsdom`) |
| [src/lib/auth/serverContext.ts](src/lib/auth/serverContext.ts) | `getServerAppContext()` — user + team + `serverNow`, one wave, `cache()`d, never throws |
| [src/components/auth/ServerSeed.tsx](src/components/auth/ServerSeed.tsx) | **Wrap every new authenticated page in this.** Seeds the store server-side; also renders TrialBanner |
| [src/components/auth/StoreHydrator.tsx](src/components/auth/StoreHydrator.tsx) | Writes the seed into zustand *during* first render (a `useState` initializer), not in an effect |
| [src/lib/db/teamContext.ts](src/lib/db/teamContext.ts) | `TeamContext` + `TEAM_CONTEXT_SELECT` + `mapTeamContextRow`, with no Supabase client bound — so server and client build identical objects |
| [src/components/ui/skeletons.tsx](src/components/ui/skeletons.tsx) | `StatsSkeleton` · `TableSkeleton` · `CardListSkeleton` · `DetailSkeleton` · `PageSkeleton`. Keep their geometry in sync with the real components |
| [src/components/ui/RouteLoading.tsx](src/components/ui/RouteLoading.tsx) | `loading.tsx` shell — renders the real AppShell so the chrome never blanks. Pass the route's own title/subtitle/width |

## Roadmap / next steps
1. **← ACTIVE: verify the flash pass in a browser.** Sign in as a real user in a
   **fresh incognito window**, then:
   - DevTools → Network → **Slow 4G**, hard-reload `/properties`. The sidebar and
     header must be correct in the *first* frame; skeleton rows fill with data
     **without anything moving**. Nothing should ever say "Giriş yap",
     "Henüz taşınmaz yok" or "İlk taşınmazınızı ekleyin".
   - Record with **Performance → screenshots** and step the filmstrip frame by
     frame. That is the only reliable way to catch a one-frame flash.
   - Watch a primary-coloured button through the whole load: it must never
     change colour.
   - Repeat on `/`, `/leads`, `/projects`, `/documents`, a property detail.
   - **CLS target 0** on load for every route.
   - Hard-reload while on `/leads`: the marker appears *on* Müşteriler, no slide.
     Then click through the nav — it must still glide.
   - OS "reduce motion" on → skeletons are a static tint, no breathing.
   - Confirm a genuinely empty list still shows its real empty state + CTA.
   - **Auth regression** (what this pass most endangers): sign in, sign out,
     hard-reload while signed in, let a token refresh happen, and a team-less
     account bouncing to `/onboarding`.
   - **Perf**, measured per the ONE RULE method (warm, median of 8): TTFB and
     time-to-first-data on `/properties`. If `ServerSeed` made TTFB worse without
     a matching improvement in time-to-data, drop the team query from
     `getServerAppContext` and keep only the (free) identity seeding — §4's
     `teamLoaded` gate already makes a late team arrival invisible.
2. ~~Apply migrations 0026 + 0027.~~ **Done 2026-07-20** — remote history synced
   at 0001–0027. `db push` is safe here now; still `--dry-run` first (Gotchas).
3. **Feature browser pass**, in this order:
   - Create a project with an https Drive link → `/projects` groups it by firma,
     the Drive button opens in a new tab.
   - Add a property from the project page (`?project=` prefills the link) →
     it appears under "Bu projedeki taşınmazlar".
   - Lead with a budget → "Eşleşen taşınmazları bul" → `"bütçe içinde"` shows;
     switch the lead's currency → the dimension is skipped, not hard-failed;
     a matching project appears in "Bu bütçeye uyan projeler".
   - Select 3 properties → "Broşür oluştur" → cover + 3 pages, **no homeowner
     name and no ada/parsel number anywhere**. Select 16 → the button disables.
   - **Phase 4 regression check**: open a lead → log 3 calls → all persist,
     newest first, attributed to you. Then clear the notes box and save →
     **the calls survive**. That failure is the bug this phase exists to fix.
   - City field: type "izmir" (no accents, lowercase) → "İzmir" appears in the
     suggestions; type "Alsancak" → no suggestion but the value still saves.
3. Commit Phases 1–4 (nothing is committed yet).
4. Then the gap backlog below, in order.

## Gap backlog — ALL THREE BUILT 2026-07-20

A, B and C below are **done** (Phase 5), migrations 0028–0030 applied, 140 tests
green. Kept here for the reasoning; the descriptions are now history, not TODO.

Two things found while building them:
- **KDV was 18 %, should be 20 %** (raised July 2023). It printed on every
  generated sales contract. Now a single `KDV_RATE` in
  [src/lib/commission.ts](src/lib/commission.ts), pinned by tests.
- **Both cron sweeps were callable with the public anon key** — a pre-existing
  hole, not introduced by this work. `REVOKE … FROM anon, authenticated` does
  nothing on its own because Postgres grants EXECUTE to `PUBLIC` on creation.
  Fixed in [0030](supabase/migrations/0030_revoke_sweep_execute.sql); verified
  blocked (SQLSTATE 42501) for anon and still working for `service_role`.


**A. WhatsApp prefilled message + brochure.** `whatsappUrl()`
([phone.ts:4-14](src/lib/phone.ts#L4-L14)) returns a bare `https://wa.me/<digits>`,
so the button opens an **empty chat**. `wa.me` supports `?text=` — prefill the
property address, price and key stats, and hand over the Phase 3 brochure.
Turkish agents work in WhatsApp; this closes the loop (budget → find → *share*).
Small change, high daily value. Pairs with logging a `whatsapp` activity row.

**B. Work notifications.** All seven `NotificationType` values
([notifications.ts:6-13](src/lib/db/notifications.ts#L6-L13)) are billing/team
lifecycle (`trial_started`, `invite_accepted`, `subscription_activated`…).
**None concern the actual job.** Overdue rent, expiring leases and silent leads
live only in a dashboard panel an agent must remember to open. The daily cron at
`/api/cron/trial-check`
([0015](supabase/migrations/0015_turkish_notifications_cron.sql)) is already the
delivery mechanism — it needs work-shaped notification types, not new plumbing.

**C. Commission & earnings.** `sales.buyer_commission_rate` /
`seller_commission_rate` ([0003_sales.sql:31-32](supabase/migrations/0003_sales.sql#L31-L32))
are **written** by the document wizard
([DocumentWizard.tsx:860-861](src/components/documents/DocumentWizard.tsx#L860-L861))
but **never read back into any view** — effectively write-only data. No screen
shows an agent what they earned or are owed, or an owner what the office booked.
The meeting notes raise commission repeatedly. With `assigned_to` already on
properties and leads, per-agent earnings is largely a reporting view over
existing data.

## Deliberately partial — grows later (scope ledger)
| Area | What shipped now | Intended full shape | Grows in |
| --- | --- | --- | --- |
| Brochure photos | Cover photo only, max 15 properties | Optional "all photos" for small selections, or server-side rendering to lift the cap | when agents hit the limit |
| Project units | Optional — a project can have zero property rows | Bulk unit entry (floor/type grid) if agents start entering whole buildings | when asked |
| Project matching | `MatchingProjects` filters on `price_from` + exact currency | Richer project matching (nitelik, delivery date) if `price_from` proves too blunt | after real use |
| Currency list | Hard-coded TRY/USD/EUR in four components (`LeadForm`, `PropertyFilters`, `ProjectForm`, + store default) | Shared constant — worth extracting now that it appears 4× | next touch |
| Projects on dashboard | Not surfaced in the needs-attention feed or KPIs | Delivery-date reminders, project-level stats | later |
| Parked note items | Not built, by design (source said "just keep them in mind") | Commission link/rate per satış office, KDV + document-ready flags, pre-payment terms, short-vs-long-term rent, finance tracker | after Phases 1–3 land in real use |

Note: the $400k vatandaşlık threshold needs **no schema** — it's a saved budget
filter once Phase 1 is live. Commission fields already exist on `sales`
(`buyer_commission_rate`, `seller_commission_rate`).

## Gotchas / open issues
- **In new migrations use `gen_random_uuid()`, not `uuid_generate_v4()`.**
  The latter lives in the `uuid-ossp` schema, which is not on the CLI migration
  runner's `search_path` — `db push` fails with SQLSTATE 42883 even though the
  extension is installed and older migrations use it happily. 0027/0028 were
  switched; 0001–0026 still contain it and would fail if ever replayed.
- **`REVOKE EXECUTE … FROM anon, authenticated` does nothing on its own.**
  Postgres grants EXECUTE to `PUBLIC` when a function is created, and those
  roles inherit through it. Always `REVOKE … FROM PUBLIC, anon, authenticated`
  then `GRANT` back to `service_role` — see
  [0030](supabase/migrations/0030_revoke_sweep_execute.sql).
- **⚠️ Live data-loss bug: call history is stored in `leads.notes`.**
  `markCalledToday` ([ContactTable.tsx:92-105](src/components/contacts/ContactTable.tsx#L92-L105))
  prepends `[tarih] Arandı.` into the free-text `notes` column, but `LeadForm`
  loads `notes` into state and writes it back wholesale on save
  ([LeadForm.tsx:91](src/components/leads/LeadForm.tsx#L91)) — so an agent who
  clears the notes box and saves **silently erases every logged call**.
  `TenantForm` has the same shape. Phase 4 fixes this with a real
  `contact_activity` table. Until then, don't build anything else on `notes`.
  Note `leads.last_call_at` is also a single overwritten timestamp: only the
  most recent call is retained, by design.
- **`db push` is now SAFE — but always `--dry-run` first.** Migration
  [0010_multitenant.sql:175](supabase/migrations/0010_multitenant.sql#L175) contains an
  unconditional `TRUNCATE public.payments, leases, sales, property_images,
  properties, tenants, leads CASCADE` ("fresh start: data cleared"). It is
  **destructive if ever replayed**.
  As of 2026-07-20 the remote `schema_migrations` history is fully repaired
  (0001–0027 all recorded), so `db push` only applies genuinely new files and
  will not replay 0010. Verify with `npx supabase db push --dry-run --linked`
  and confirm the printed list contains *only* the migration you expect.
  If the history is ever reset or a fresh project is linked, that guarantee is
  gone: repair first (`npx supabase migration repair --status applied 0001 …`,
  which writes tracking rows without executing SQL), never push blind.
- `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is reportedly the **anon** key — see
  [LAUNCH_RUNBOOK.md](LAUNCH_RUNBOOK.md) §1. Admin list, invites, billing webhook,
  account deletion and the trial cron fail silently until fixed. **Unverified this session.**
- Team trial expiry makes the whole workspace read-only via RLS (writes gated on
  `team_is_writable`). A confusing "no permission" error is usually this, not a bug.
  Runbook §3 has the SQL to extend a trial.
- `supabase/.temp/` is CLI link state containing a pooler URL — gitignored 2026-07-20.
- Phase 1 is **untested against a live database and unclicked in a browser**.

## Running it
```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm test           # vitest (85 tests)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```
CI (`.github/workflows/ci.yml`) runs lint + typecheck + tests on pushes and PRs.
