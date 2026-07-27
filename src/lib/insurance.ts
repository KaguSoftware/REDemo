// Labels and suggestion lists for property insurance.
//
// Kept out of the db layer so PDF/table/form code can import the labels without
// pulling in a Supabase client.

import type { InsuranceKind } from "./db/types";

/** Display order — DASK first because it is the mandatory one. */
export const INSURANCE_KINDS: InsuranceKind[] = [
	"dask", "konut", "isyeri", "kira_kaybi", "hayat", "diger",
];

export const INSURANCE_KIND_LABEL: Record<InsuranceKind, string> = {
	dask: "DASK (Zorunlu Deprem)",
	konut: "Konut sigortası",
	isyeri: "İşyeri sigortası",
	kira_kaybi: "Kira kaybı",
	hayat: "Kredi hayat sigortası",
	diger: "Diğer",
};

/** Compact form for badges and table cells, where the long label doesn't fit. */
export const INSURANCE_KIND_SHORT: Record<InsuranceKind, string> = {
	dask: "DASK",
	konut: "Konut",
	isyeri: "İşyeri",
	kira_kaybi: "Kira kaybı",
	hayat: "Hayat",
	diger: "Diğer",
};

/**
 * Insurers writing DASK and konut policies in Turkey. Suggestions only, never a
 * whitelist — the insurer field is free text (same policy as TURKEY_PROVINCES),
 * because agencies work with brokers and regional firms that aren't listed here.
 */
export const TURKISH_INSURERS: string[] = [
	"Anadolu Sigorta",
	"Allianz Sigorta",
	"AXA Sigorta",
	"Aksigorta",
	"Ankara Sigorta",
	"Bereket Sigorta",
	"Doğa Sigorta",
	"Eureko Sigorta",
	"Generali Sigorta",
	"Groupama Sigorta",
	"Gulf Sigorta",
	"HDI Sigorta",
	"Koru Sigorta",
	"Magdeburger Sigorta",
	"Mapfre Sigorta",
	"Neova Katılım Sigorta",
	"Orient Sigorta",
	"Quick Sigorta",
	"Ray Sigorta",
	"Sompo Sigorta",
	"Türkiye Katılım Sigorta",
	"Türkiye Sigorta",
	"Unico Sigorta",
	"Zurich Sigorta",
];

/**
 * Where a policy sits relative to today. Pure and string-only: ISO dates
 * (`yyyy-mm-dd`) compare correctly with `<` / `>=`, so no Date is constructed
 * and callers stay deterministic under test.
 */
export type PolicyState = "expired" | "expiring" | "valid";

/**
 * How far ahead a policy counts as "bitmek üzere". The single source of truth:
 * DEFAULT_ATTENTION_THRESHOLDS, the portfolio filter and run_work_checks()'s
 * ins_days all use this number, so the three never disagree about which
 * policies are urgent.
 */
export const INSURANCE_WARN_DAYS = 30;

export function policyState(
	endDate: string,
	todayISO: string,
	horizonISO: string,
): PolicyState {
	if (endDate < todayISO) return "expired";
	if (endDate <= horizonISO) return "expiring";
	return "valid";
}

/** `todayISO` + `days`, as a plain ISO date. UTC so it can't drift across DST. */
export function isoDaysFrom(todayISO: string, days: number): string {
	const d = new Date(`${todayISO}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}
