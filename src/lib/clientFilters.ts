// Client-side property filtering — the in-browser twin of listProperties()'s
// server-side WHERE clause (src/lib/db/properties.ts).
//
// Why this exists: every filter change used to rebuild the SWR cache key, which
// fired a fresh ~330ms round-trip. Typing in the search box or opening a
// dropdown meant waiting on the network to see rows the browser already had.
// An agency portfolio is hundreds of rows, not millions, so the whole team's
// list fits in memory comfortably: fetch it once, then filter locally at zero
// network cost.
//
// The rules below MUST mirror the server's. Where the server uses ILIKE
// '%value%' we use a locale-aware case-insensitive substring test; where it
// ANDs separate .or() groups, we AND here too. clientFilters.test.ts pins
// the shared semantics — if you change one side, change both.

import type { Property, InsuranceSummary } from "./db/types";

/**
 * Insurance is filtered here and nowhere else. "DASK yok" is a statement about
 * a MISSING child row, which PostgREST cannot express in an embedded filter —
 * it would drop the policies from the response, not the property.
 */
export type InsuranceClientFilter =
	| "dask_valid"    // has a DASK policy that has not run out
	| "dask_missing"  // has no DASK policy at all (an EXPIRED one does not count)
	| "expiring";     // any policy already expired or within the horizon

export interface PropertyClientFilter {
	listing_type?: string;
	status?: string;
	q?: string;
	nitelik?: string[];
	furnished?: boolean;
	location?: string[];
	min_price?: number;
	max_price?: number;
	currency?: string;
	is_new_build?: boolean;
	project_id?: string;
	citizenship_eligible?: boolean;
	insurance?: InsuranceClientFilter;
	/** `yyyy-mm-dd`. Supplied by the caller so this stays pure and testable. */
	todayISO?: string;
	/** `yyyy-mm-dd`, today + the warn window. Required by `insurance: "expiring"`. */
	insuranceHorizonISO?: string;
}

/** Rows carry their embedded policies; older callers may not have them. */
type WithInsurance = Property & { insurance?: InsuranceSummary[] };

/**
 * Case-insensitive "contains", matching Postgres ILIKE closely enough for the
 * Turkish data this app holds.
 *
 * Turkish has a dotless ı / dotted i distinction that JS's default toLowerCase
 * gets wrong for the app's own locale ("İSTANBUL".toLowerCase() gives "i̇stanbul"
 * with a combining dot). toLocaleLowerCase("tr") handles it, so searching
 * "istanbul" matches "İstanbul" the way a Turkish user expects.
 */
function contains(haystack: string | null | undefined, needle: string): boolean {
	if (!haystack) return false;
	return haystack.toLocaleLowerCase("tr").includes(needle.toLocaleLowerCase("tr"));
}

/** True when `value` matches any of `needles` as a case-insensitive substring. */
function containsAny(value: string | null | undefined, needles: string[]): boolean {
	return needles.some((n) => contains(value, n));
}

/**
 * Apply the same predicate set listProperties() sends to PostgREST.
 * Returns a new array; the input is not mutated. Order is preserved, so the
 * server's `order("updated_at", desc)` still governs.
 */
export function filterProperties<T extends WithInsurance>(
	rows: T[],
	filter: PropertyClientFilter,
): T[] {
	const niteliks = (filter.nitelik ?? []).map((n) => n.trim()).filter(Boolean);
	const locations = (filter.location ?? []).map((l) => l.trim()).filter(Boolean);
	const q = filter.q?.trim();

	return rows.filter((p) => {
		if (filter.listing_type && p.listing_type !== filter.listing_type) return false;
		if (filter.status && p.status !== filter.status) return false;
		if (filter.project_id && p.project_id !== filter.project_id) return false;

		// Free-text search spans owner, address and city — same columns as the
		// server's orIlikeAnyColumn call.
		if (q && !(contains(p.homeowner_name, q) || contains(p.address_line, q) || contains(p.city, q))) {
			return false;
		}

		// Any of the selected types (OR within the group).
		if (niteliks.length > 0 && !containsAny(p.nitelik, niteliks)) return false;

		if (filter.furnished != null && p.furnished !== filter.furnished) return false;
		if (filter.is_new_build != null && p.is_new_build !== filter.is_new_build) return false;

		// Tri-state, like `furnished`: an explicit "not eligible" is a different
		// answer from "never assessed", so === against the boolean is correct and
		// a truthiness test would be wrong.
		if (filter.citizenship_eligible != null && p.citizenship_eligible !== filter.citizenship_eligible) {
			return false;
		}

		if (filter.insurance) {
			const policies = p.insurance ?? [];
			const dask = policies.find((i) => i.kind === "dask");
			const today = filter.todayISO ?? "";
			if (filter.insurance === "dask_missing" && dask != null) return false;
			// An EXPIRED DASK is not a missing one — it fails "geçerli" but it also
			// fails "yok", because the office has a policy to renew rather than one
			// to buy. Conflating the two sends an agent down the wrong path.
			if (filter.insurance === "dask_valid" && !(dask && dask.end_date >= today)) return false;
			if (filter.insurance === "expiring") {
				const horizon = filter.insuranceHorizonISO ?? "";
				if (!policies.some((i) => i.end_date <= horizon)) return false;
			}
		}

		// A price bound is only meaningful within one currency (no FX conversion),
		// which is why the server scopes it explicitly and so do we.
		//
		// A NULL price must fail EITHER bound, matching Postgres: `null >= 1` and
		// `null <= 5000000` are both NULL, so the row is dropped. Do not reach for
		// Number(p.list_price) here — Number(null) is 0, which silently passes a
		// max filter and makes "no price recorded" look like "costs nothing".
		if (filter.min_price != null && (p.list_price == null || p.list_price < filter.min_price)) return false;
		if (filter.max_price != null && (p.list_price == null || p.list_price > filter.max_price)) return false;
		if (filter.currency && p.currency !== filter.currency) return false;

		// A location may match city / mahalle / mevkii. PostgREST ANDs separate
		// .or() groups, so this is independent of the `q` search above.
		if (
			locations.length > 0 &&
			!(containsAny(p.city, locations) || containsAny(p.mahalle, locations) || containsAny(p.mevkii, locations))
		) {
			return false;
		}

		return true;
	});
}

// ── Contacts (leads + tenants) ───────────────────────────────────────────────
// Same reasoning as above: /leads refetched both tables on every keystroke and
// every status pick. Both are small, team-scoped lists, so they are fetched once
// and narrowed in the browser.

/** Mirrors listLeads()'s WHERE clause (src/lib/db/leads.ts). */
export function filterLeads<T extends {
	status: string;
	full_name: string | null;
	phone: string | null;
	interested_in: string | null;
}>(rows: T[], filter: { status?: string; q?: string }): T[] {
	const q = filter.q?.trim();
	return rows.filter((l) => {
		if (filter.status && l.status !== filter.status) return false;
		if (q && !(contains(l.full_name, q) || contains(l.phone, q) || contains(l.interested_in, q))) {
			return false;
		}
		return true;
	});
}

/** Mirrors listTenants()'s WHERE clause (src/lib/db/tenants.ts). */
export function filterTenants<T extends {
	full_name: string | null;
	email: string | null;
	phone: string | null;
}>(rows: T[], filter: { q?: string }): T[] {
	const q = filter.q?.trim();
	if (!q) return rows;
	return rows.filter((t) => contains(t.full_name, q) || contains(t.email, q) || contains(t.phone, q));
}
