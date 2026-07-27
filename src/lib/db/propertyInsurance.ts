// Property insurance policies.
//
// DASK (Zorunlu Deprem Sigortası) is mandatory in Turkey: a missing or lapsed
// policy blocks a tapu transfer and blocks electricity/water subscriptions, so
// it can stop an appointment on the day. The other kinds (konut, işyeri, kira
// kaybı, kredi hayat) are voluntary but sit on the same shelf.
//
// This is a child table, not a pair of columns on `properties`, because a unit
// can carry several policies at once and each renews annually.
//
// RLS on public.property_insurance does authorization; each call just verifies
// a session exists and lets the database enforce team scope.

import type { PropertyInsurance } from "./types";
import {
	insuranceInputSchema,
	insurancePatchSchema,
	parseInput,
} from "@/src/lib/schemas/inputs";
import { requireTeamId } from "./teams";
import { requireUser } from "./requireUser";

export interface InsuranceInput {
	property_id: string;
	kind: PropertyInsurance["kind"];
	insurer?: string | null;
	policy_no?: string | null;
	start_date?: string | null;
	end_date: string;
	premium?: number | null;
	currency?: string;
	notes?: string | null;
}

/** Every policy on one property, soonest expiry first. */
export async function listInsurance(propertyId: string): Promise<PropertyInsurance[]> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("property_insurance")
		.select("*")
		.eq("property_id", propertyId)
		.order("end_date", { ascending: true });
	if (error) throw error;
	return (data ?? []) as PropertyInsurance[];
}

export async function createInsurance(input: InsuranceInput): Promise<PropertyInsurance> {
	const parsed = parseInput(insuranceInputSchema, input);
	const { supabase, user } = await requireUser();
	const { data, error } = await supabase
		.from("property_insurance")
		.insert({ ...normalizeBlanks(parsed), team_id: requireTeamId(), created_by: user.id })
		.select()
		.single();
	if (error) throw error;
	return data as PropertyInsurance;
}

export async function updateInsurance(
	id: string,
	patch: Partial<InsuranceInput>,
): Promise<PropertyInsurance> {
	const parsed = parseInput(insurancePatchSchema, patch);
	const { supabase } = await requireUser();
	const { data, error } = await supabase
		.from("property_insurance")
		.update(normalizeBlanks(parsed))
		.eq("id", id)
		.select()
		.single();
	if (error) throw error;
	return data as PropertyInsurance;
}

export async function deleteInsurance(id: string): Promise<void> {
	const { supabase } = await requireUser();
	const { error } = await supabase.from("property_insurance").delete().eq("id", id);
	if (error) throw error;
}

/**
 * DASK and konut policies run for exactly one year, so the form derives the end
 * date from the start date and lets the agent correct it. Pure and date-only:
 * takes and returns `yyyy-mm-dd`, never a Date, so it can't drift by a timezone.
 *
 * A policy starting 29 Feb ends 28 Feb (Date normalises the overflow), which is
 * what an insurer does too.
 */
export function oneYearLater(startISO: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(startISO)) return "";
	const [y, m, d] = startISO.split("-").map(Number);
	// UTC throughout: a local-time Date would shift the day either side of DST.
	const end = new Date(Date.UTC(y + 1, m - 1, d));
	if (end.getUTCMonth() !== m - 1) {
		// 29 Feb → 1 Mar; step back to the last day of February.
		end.setUTCDate(0);
	}
	return end.toISOString().slice(0, 10);
}

/**
 * Forms submit cleared optional fields as "" — store NULL instead, so
 * `start_date` (a DATE column) doesn't reject the empty string.
 */
function normalizeBlanks<T extends Record<string, unknown>>(input: T): T {
	const out = { ...input };
	for (const key of ["start_date"] as const) {
		if (out[key] === "") (out as Record<string, unknown>)[key] = null;
	}
	return out;
}
