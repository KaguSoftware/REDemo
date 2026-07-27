# Kagu Emlak — Handoff

> Read this first when starting a fresh chat. Companions: [PRODUCT.md](PRODUCT.md) ·
> [README.md](README.md) · [AGENTS.md](AGENTS.md) · [LAUNCH_RUNBOOK.md](LAUNCH_RUNBOOK.md) ·
> plan file (UI recomposition): `~/.claude/plans/i-know-massive-scope-fancy-toucan.md`

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
- **A new property column touches 9 layers**, and `parseInput` strips unknown
  keys — so a field missing from `propertyInputSchema` **silently never
  persists**. Follow `is_new_build` / `citizenship_eligible` end to end.
- **Booleans that mean "unknown" are nullable tri-states** (`furnished`,
  `citizenship_eligible`) rendered as three-option `Dropdown`s — there is no
  Checkbox in `src/components/ui`. Compare with `===`, never truthiness.
- **Predicates over dates take `todayISO` as a parameter**, never call
  `new Date()` internally — that is what keeps `filterProperties` and
  `classifyInsurance` deterministic under test. ISO dates compare correctly
  with `<` / `>=`, so no `Date` need be constructed at all.

## Current status

### 🎨 UI RECOMPOSITION (2026-07-27) — branch `ui/recomposition`, 10 commits, **NOT merged, NOT seen in a browser**
Green at every commit: `typecheck`, `lint` (0 errors; the one warning is
pre-existing, in `promo/`), `npm test` (**214 passed**, 22 files — 1 new),
`npm run build` with the static/dynamic split byte-identical. Impeccable's
design detector returns `[]`.

The brief was "the pages seem tacky and cheap." The brand was not the problem —
the oklch ramps, the Schibsted/Plex pairing and the graphite sidebar rail are
authored, specific work, and the detector was already clean. **All of the
cheapness was in the content area's composition grammar**, and it had one root
cause:

⚠️ **`ui/cn.ts` was a naive space-joiner with no `tailwind-merge`.** Its comment
claimed "later classes simply win via source order" — false for conflicting
Tailwind utilities, where the winner is decided by *stylesheet emission* order.
Measured in a production build: `.p-5` at byte 130703, `.p-6` at 130741, so
`<Card className="p-5">` silently rendered at 24px. Because overriding a
primitive did not reliably work, callers copy-pasted surface strings instead —
which is where **13 card class-strings, 10 radius values and 19 heading
strings** came from. Everything else in this branch depends on that fix.

| | before | after |
|---|---|---|
| Card/panel class-strings | 13 | 1 `Surface`, 3 tiers |
| Border radius values | 10 | `rounded-box` / `rounded-field` (theme tokens) |
| Shadow tiers | 3 tokens + 4 escapes, applied at random | **1** — `shadow-pop`, only on things that float |
| Sized text at 12/14px | **89%** | on a 6-step named scale |
| Heading class-strings | 19, no primitive | 1 `Heading` |
| Nav rail items | 9 (incl. an action + 4 account pages) | 5, all work |

⚠️ **THE RULES THIS PASS ADDS**
- **Elevation means "floating above the page."** `shadow-card`/`shadow-soft`
  are deleted from the token set. A resting shadow on a panel is what made
  every region read as a floating widget. `shadow-pop` is for Sheet,
  ConfirmDialog, popovers, Toast, BulkActionBar, the FAB — nothing else.
- **The page is the surface, not the card.** Tier 0 (a heading and space) is
  the default; reach for a bordered panel only when a border earns its keep.
  `main` is now `base-100` — the inversion is what makes tier 0 possible, since
  on a grey ground every region had to be a card just to look finished.
- **Density where data lives, space where decisions happen.** `--spacing-row`
  (44px) / `--spacing-row-media` (60px) hold tables at their old density while
  the page rhythm opens up. These are the contract between a row and its
  skeleton — change one, change both.
- **A custom scale value is invisible to `tailwind-merge`.** It classifies
  against an internal value list, never your CSS. Every custom shadow, radius,
  animation and type step is registered in `extendTailwindMerge`; without the
  radius entry the whole consolidation would have shipped with radius merging
  silently disabled. Pinned by `src/components/ui/cn.test.ts`.
- **A `loading.tsx` cannot guess a dynamic title.** Four routes drifted and
  re-laid-out on mount. `RouteLoading` now *reserves* unknown values with a
  skeleton of the right geometry; `subtitle={false}` means "genuinely none".

**⚠️ Nothing in this branch has been opened in a browser.** No browser tooling
was available in that session, and the test suite cannot see any of this: all
22 test files are under `src/lib/`, no component has a test, there are no
snapshots, and ESLint carries no Tailwind plugin. `typecheck` + `build` + the
`cn` tests are the only automated gates. **See Roadmap step 0.**

Deliberately out of scope: `src/components/documents/editor/` — `editor.css`
and the `--doc-*` namespace are a second, independent design system whose
source of truth is the generated PDF (`src/lib/pdf/editorDoc.tsx`), not this
app. Touching it would desynchronise the WYSIWYG editor from the document it
previews, and `editorDoc.test.tsx` would not catch it.

### 🏗️ FIELD-NOTES BUILD (2026-07-27) — uncommitted on `main`, **migrations 0031 + 0032 NOT applied**, not driven in a browser
Green: `typecheck`, `lint` (0 errors; the one warning is pre-existing, in `promo/`),
`npm test` (**203 passed**, 21 files — 4 new), `npm run build` (static/dynamic split
unchanged: the legal pages, `/signup`, `/settings/*`, `/team`, `/onboarding` are all
still `○`).

Four features decoded from a real-estate source's mixed Turkish/Farsi/English note:
`bime zelzele` (Farsi, *earthquake insurance*) · `vatandaşlık boolean` ·
`social media` · `news feed`.

**1. Property insurance** — a `property_insurance` **child table**, not a
`dask_policy_no`/`dask_expiry_date` column pair. Six kinds (`dask`, `konut`,
`isyeri`, `kira_kaybi`, `hayat`, `diger`); DASK is the mandatory one and gets
visual priority everywhere. Edited from a **Sigortalar card on the property
detail page**, not from `PropertyForm` — cover is rarely known when a property
is first added.
⚠️ **There is no API to look a policy up by number.** SBM (Sigorta Bilgi ve
Gözetim Merkezi) is Turkey's only central registry and is gated behind
licensed-insurer membership; the e-Devlet DASK screen is citizen-self-service.
So entry is manual but cheap: `insurer` is a `Combobox` over `TURKISH_INSURERS`
(the `TURKEY_PROVINCES` pattern), and **`end_date` auto-fills to `start_date` +
1 year** — but only when it is blank, so a typed value is never overwritten.
`external_ref` + `source` ship unused; an integration later needs **no migration
and no UI change**.

Two places count waves rather than queries, per the ONE RULE: the policies ride
into `listProperties` **and** `getProperty` as embedded selects, so the
Sigortalar card is seeded from the detail page's own response
(`InsuranceCard` takes `initial` and refetches only after a mutation). Letting
that card fetch on mount would have been a second ~330ms wave **serialised**
behind the first, because it only mounts once the page resolves.

**2. Policy expiry reminders** — a *fourth* query **inside `getAttentionData`'s
existing `Promise.all`** (~12ms, not a round-trip), a new `insuranceWarnDays`
threshold, and a fifth block in `run_work_checks()`. One code path covers every
policy kind, which the column-pair design could not have done.

**3. Social media image** — `renderStoryImage()` draws a 1080×1350 post or
1080×1920 story on a **plain `<canvas>`. Zero new dependencies.** Delivered
through the same `navigator.share` path the PDF already used. Caption is a
second `message_templates` kind (`social_caption`), team-editable in the
existing card on `/team`.

**4. Market news** — `/api/news` fetches a **hard-coded allowlist** of three
Turkish RSS feeds in one `Promise.all`, cached 30 min. Rendered as a dashboard
card between `PortfolioAnalytics` and the quick actions.
⚠️ **No RSS dependency was added.** The plan called for `fast-xml-parser`;
`parseFeed.ts` handles the three things that actually break naive parsers
(CDATA, Atom's `href` *attribute* on a self-closing `<link/>`, HTML entities) in
~90 tested lines, so the package was not worth it. **All three feeds were
probed live on 2026-07-27** (emlakkulisi 50 items, AA 30, NTV 20) and the parser
was run against their real output. AA serves UTF-8 **with a BOM and no charset
parameter** — `Response.text()` handles both per spec.

⚠️ **THE RULES THIS PASS ADDS**
- **"No DASK" and "expired DASK" are different answers.** The first office must
  buy cover; the second only has to renew. `filterProperties`' `dask_missing`
  therefore checks for the *absence of a row*, never for a lapsed date. Pinned
  by tests in `clientFilters.test.ts`.
- **`citizenship_eligible` is a stored tri-state, not a price comparison** — see
  the reversal below.
- **A shared `href` silently dedupes notifications.** `run_work_checks()` keys
  repeat-suppression on `(user, type, href)`, and every policy on a unit shares
  `/properties/<id>`. The insurance block appends **`#sigorta-<kind>`** so a DASK
  and a konut policy expiring in the same month produce two notifications, not
  one. (The quiet-leads block solves the same problem with a `body LIKE`.)
- **`CREATE OR REPLACE FUNCTION` re-grants EXECUTE to `PUBLIC`** — i.e. it
  reopens the exact hole [0030](supabase/migrations/0030_revoke_sweep_execute.sql)
  closed. 0031 replaces `run_work_checks()` and therefore **re-runs the
  `REVOKE … FROM PUBLIC` + `GRANT … TO service_role` at the end**. Any future
  migration that touches a sweep function must do the same.
- **A cross-origin image taints a canvas** and `toBlob()` then throws
  `SecurityError`. The story image loads photos through the existing
  `toDataUrl()` — a `data:` URL cannot taint. This would have failed *only in
  production*, where photos come from the Supabase CDN.
- **`next/font` mints a hashed family name**, so `ctx.font = "700 64px Geist"`
  silently falls back to a system face and every `measureText()` is wrong. The
  family is read off `getComputedStyle(document.body)` instead.

**↩️ One prior decision reversed.** The scope ledger used to say the $400k
vatandaşlık threshold "needs no schema — it's a saved budget filter." That was
wrong. Eligibility requires an SPK-licensed appraisal at or above the threshold,
no prior sale to a foreigner for citizenship, and a 3-year no-sale şerh on the
tapu. `list_price >= 400000` cannot answer it; only a human assessment can,
which is exactly why the source wrote *boolean*.

**⚠️ Nothing here has been applied to the database or clicked in a browser.**
`0031` and `0032` are written and idempotent but **not pushed**. See Roadmap
step 1.

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

✅ **Migrations 0001–0030 are applied** — remote history verified in sync
2026-07-20 via `supabase migration list --linked`.
⚠️ **0031 and 0032 are written but NOT applied** (2026-07-27) — see Roadmap
step 0.
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
| [supabase/migrations/0031_insurance_and_citizenship.sql](supabase/migrations/0031_insurance_and_citizenship.sql) | **NOT APPLIED.** `property_insurance` + RLS + team guard, `properties.citizenship_eligible`, `insurance_expiring` notifications. **Re-revokes `run_work_checks()` from PUBLIC** |
| [supabase/migrations/0032_social_caption_template.sql](supabase/migrations/0032_social_caption_template.sql) | **NOT APPLIED.** Widens `message_templates.kind` to allow `social_caption` |
| [src/lib/insurance.ts](src/lib/insurance.ts) | Kind labels, `TURKISH_INSURERS`, `policyState`, `isoDaysFrom`, and **`INSURANCE_WARN_DAYS` — the single source of truth** shared by the filter, the attention feed and the SQL sweep |
| [src/lib/db/propertyInsurance.ts](src/lib/db/propertyInsurance.ts) | Policy CRUD + `oneYearLater()` (UTC, clamps 29 Feb to 28 Feb like an insurer does) |
| [src/components/properties/InsuranceCard.tsx](src/components/properties/InsuranceCard.tsx) | The Sigortalar card + its edit sheet. Calls out the DASK state separately — an empty list otherwise says nothing about the mandatory policy |
| [src/components/properties/PropertyFlags.tsx](src/components/properties/PropertyFlags.tsx) | Row badges. **Deliberately quiet**: a valid DASK and an unassessed citizenship status render nothing, so the missing-DASK warning still cuts through |
| [src/lib/share/storyLines.ts](src/lib/share/storyLines.ts) | The **pure**, testable half of the social image — a canvas can't be asserted on, this can, and this is where the field whitelist lives |
| [src/lib/share/storyImage.ts](src/lib/share/storyImage.ts) | The canvas renderer. Takes `ShareableProperty`, never `Property` |
| [src/lib/downloadFile.ts](src/lib/downloadFile.ts) | `shareOrDownloadFile()` — moved out of `pdf/index.ts` (it was never PDF-specific); re-exported there as `downloadPdfFile` so no caller changed |
| [src/lib/news/sources.ts](src/lib/news/sources.ts) | **The RSS allowlist. A caller-supplied URL here would be an SSRF hole** — adding a source means editing this file |
| [src/lib/news/parseFeed.ts](src/lib/news/parseFeed.ts) | RSS + Atom parser, no dependency. Drops non-`http(s)` links so a hostile feed can't plant a `javascript:` href |
| [src/components/dashboard/NewsFeed.tsx](src/components/dashboard/NewsFeed.tsx) | The news card. Own cache key, own failure mode — nothing else on the dashboard waits on it |

## Roadmap / next steps

0. **← ACTIVE: drive the `ui/recomposition` branch in a browser before merging.**
   Nothing in it has been seen rendered, and the test suite structurally cannot
   catch a visual regression. Sign in as a real user, then:
   - **The register check.** Open `/` as an owner and time how long it takes to
     find this month's overdue total. The brief was "calm & spacious"; if the
     new rhythm made that *slower* than the old seven-band stack, the register
     landed on the wrong layer and the data regions need their density back.
   - **CLS target 0** on `/`, `/properties`, `/leads`, `/projects`,
     `/documents`, a property detail, `/projects/[id]`, `/settings/billing`,
     `/settings/profile`. Throttle to Slow 4G and step the Performance
     filmstrip — the page header is now a 32px display block, so any skeleton
     mismatch moves every pixel below it. The four routes that used to drift
     are the ones to watch.
   - **A 40-row portfolio** at 1280px and on a phone: row height unchanged,
     money aligned on tabular numerals, sort announced by `aria-sort`.
   - **Both themes on every surface**, plus one dark team brand accent — check
     contrast on primary-tinted grounds, which is the one thing `BrandTheme`
     does not guarantee.
   - **A generated contract PDF and the contract editor byte-compared to
     `main`**, proving the `--doc-*` namespace stayed out of scope.
   - OS "reduce motion" on; 44px targets; the iOS-zoom guard on inputs.
   - Then merge, and update DESIGN.md (it does not exist yet — this branch is
     the first thing that would justify writing one).

1. **Apply 0031 + 0032, then click through the field-notes build.**
   - `npx supabase db push --dry-run --linked` first, and confirm the printed
     list contains **only** 0031 and 0032 (Gotchas explains why this matters).
   - **Insurance**: on one property add a DASK ending in 10 days and a konut
     ending in a year. Both appear in Sigortalar, DASK in amber. Filter
     *Sigorta: yakında bitiyor* → present; *DASK yok* → absent. Now **delete**
     the DASK and re-check *DASK yok* → present. An **expired** DASK must read
     as "süresi doldu", never as "yok". A konut-only property must not satisfy
     *DASK geçerli*. Type "anadolu" in the insurer box → *Anadolu Sigorta*; type
     a firm not on the list → it still saves. Enter a start date → end fills to
     +1 year and stays editable; enter one on a policy that already has an end
     date → **the existing end date is not overwritten**.
   - **Vatandaşlık**: set it explicitly to *Uygun değil* and confirm it stays
     distinguishable from never-assessed in the filter, the form and the detail
     `<dl>` (the tri-state, and the easiest thing to get wrong).
   - **Cross-team guard**: insert a policy whose `team_id` doesn't own its
     `property_id` → the trigger must reject it.
   - **Sweep**: `select public.run_work_checks();` twice → second call inserts
     **0**. Give one unit two policies expiring the same month → **two**
     notifications, not one. Then call it with the **anon** key (must fail,
     SQLSTATE 42501) and with `service_role` (must succeed) — 0031 replaced the
     function, so this proves the PUBLIC grant was closed again.
   - **Social image**, on a real phone: Görsel → the native share sheet offers
     Instagram. Then a property with **no photo** (falls back, does not throw),
     and one whose `homeowner_name` and `ada_no` are filled — **neither string
     may appear on the image**. Check the type is Geist, not a fallback face.
     Confirm the existing *Paylaş* PDF path is unchanged.
   - **News**: throttle to Slow 4G and hard-reload `/` — the card shows its
     **skeleton**, never "no news", and the rest of the dashboard does not wait
     on it. Point one source at a dead host → the other two still render.
   - **CLS target 0** on `/` and `/properties`: slices 1 and 4 both add
     above-the-fold content, which is exactly what regresses it.

2. **Verify the flash pass in a browser.** Sign in as a real user in a
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
3. ~~Apply migrations 0026 + 0027.~~ **Done 2026-07-20** — remote history synced
   at 0001–0027. `db push` is safe here now; still `--dry-run` first (Gotchas).
4. **Feature browser pass**, in this order:
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
| Insurance | 6 kinds, manual entry; `external_ref`/`source` reserved but unused | (a) attach the policy PDF via the existing documents/storage path instead of re-keying it; (b) an SBM or partner-agency lookup that fills the row from a policy number — writes `external_ref` + `source='import'`, **needs no migration** | (a) next touch · (b) only if an agency partnership happens |
| Policy renewal | Reminder only | One-tap "yeniledim" that clones the policy with both dates +1 year | after real use |
| Vatandaşlık | One tri-state flag | SPK appraisal value + date, şerh status, prior-foreign-sale check | after real use |
| Social image | Post 4:5 + story 9:16, cover photo only, caption copied by hand | Multi-photo carousel, per-office logo placement control, direct Instagram Graph API publish | when agents hit the limit |
| News feed | 3 fixed sources, headlines only | Team-configurable sources, per-city filtering, save-for-later | later |

Note: commission fields already exist on `sales` (`buyer_commission_rate`,
`seller_commission_rate`).

~~The $400k vatandaşlık threshold needs no schema — it's a saved budget
filter.~~ **Reversed 2026-07-27.** Eligibility is not `list_price >= 400000`: it
needs an SPK-licensed appraisal at or above the threshold, no prior sale to a
foreigner for citizenship, and a 3-year no-sale şerh on the tapu. A price
comparison cannot answer it. It is now `properties.citizenship_eligible`, a
stored tri-state assessment — see [types.ts](src/lib/db/types.ts).

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
  ⚠️ **This includes `CREATE OR REPLACE`, not just `CREATE`.** Replacing a
  function re-grants EXECUTE to PUBLIC and silently reopens the hole. 0031
  replaces `run_work_checks()` and re-runs the revoke+grant at the end; any
  future migration touching a sweep function must do the same.
- **Adding a `NotificationType` means changing three places at once**: the DB
  `notifications_type_check`, the TS union in `lib/db/notifications.ts`, and the
  exhaustive `ICONS` record in `NotificationBell.tsx`. The TS side breaks
  typecheck (good); the DB side fails the insert **silently inside the definer
  function** (not good), so a missed CHECK looks like "the sweep found nothing".
- **`run_work_checks()` dedupes on `(user_id, type, href)`** within a 30-day
  quiet window. Any new notification whose href is shared across several
  distinct items needs a disambiguator or it will mute all but the first — the
  insurance block appends `#sigorta-<kind>`, the quiet-leads block uses
  `body LIKE`.
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
npm test           # vitest (214 tests, 22 files)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```
CI (`.github/workflows/ci.yml`) runs lint + typecheck + tests on pushes and PRs.
