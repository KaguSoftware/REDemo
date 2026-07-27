// Pure classification logic behind the "needs attention" feed. Extracted from
// attention.ts so it can be unit-tested and driven by user-configurable
// thresholds (profiles.settings) without touching the Supabase queries.

import type { InsuranceKind, LeadStatus } from "./types";
import { INSURANCE_WARN_DAYS } from "../insurance";

export interface AttentionThresholds {
	/** Rent due within this many days counts as "upcoming". */
	upcomingDays: number;
	/** Active leases ending within this many days are surfaced. */
	leaseWarnDays: number;
	/** Leads not contacted for this many days count as "gone quiet". */
	leadSilentDays: number;
	/** Insurance policies ending within this many days are surfaced. */
	insuranceWarnDays: number;
}

export const DEFAULT_ATTENTION_THRESHOLDS: AttentionThresholds = {
	upcomingDays: 7,
	leaseWarnDays: 30,
	leadSilentDays: 14,
	// Shared with the portfolio filter and run_work_checks()'s ins_days, so the
	// three surfaces never disagree about which policies are urgent.
	insuranceWarnDays: INSURANCE_WARN_DAYS,
};

export interface AttentionPayment {
	paymentId: string;
	propertyId: string;
	propertyLabel: string;
	periodStart: string;
	periodEnd: string;
	outstanding: number;
	currency: string;
}

export interface AttentionLeaseEnd {
	leaseId: string;
	propertyId: string;
	propertyLabel: string;
	endDate: string;
	daysLeft: number;
}

export interface AttentionLead {
	leadId: string;
	name: string;
	status: LeadStatus;
	lastCallAt: string | null;
	daysSilent: number;
}

export interface PaymentRow {
	id: string;
	period_start: string;
	period_end: string;
	amount_due: number;
	amount_paid: number;
	lease: {
		id: string;
		status: string;
		currency: string;
		property_id: string;
		property: { id: string; address_line: string; homeowner_name: string } | null;
	} | null;
}

export interface LeaseEndRow {
	id: string;
	end_date: string;
	property_id: string;
	property: { id: string; address_line: string; homeowner_name: string } | null;
}

export interface AttentionInsurance {
	insuranceId: string;
	propertyId: string;
	propertyLabel: string;
	kind: InsuranceKind;
	endDate: string;
	/** Negative once the policy has lapsed. */
	daysLeft: number;
	/** DASK is legally mandatory; the others are not. Drives ordering + tone. */
	mandatory: boolean;
}

export interface InsuranceRow {
	id: string;
	kind: InsuranceKind;
	end_date: string;
	property_id: string;
	property: { id: string; address_line: string; homeowner_name: string } | null;
}

export interface LeadRow {
	id: string;
	full_name: string;
	status: LeadStatus;
	last_call_at: string | null;
	created_at: string;
}

export function propertyLabel(
	p: { address_line: string; homeowner_name: string } | null,
): string {
	if (!p) return "Bilinmeyen taşınmaz";
	return p.address_line || p.homeowner_name || "Bilinmeyen taşınmaz";
}

export function daysBetween(fromISO: string, to: Date): number {
	return Math.round((to.getTime() - new Date(fromISO).getTime()) / 86_400_000);
}

/** Split unpaid payment rows into overdue vs upcoming relative to `todayISO`. */
export function classifyPayments(
	rows: PaymentRow[],
	todayISO: string,
): { overduePayments: AttentionPayment[]; upcomingPayments: AttentionPayment[] } {
	const overduePayments: AttentionPayment[] = [];
	const upcomingPayments: AttentionPayment[] = [];
	for (const row of rows) {
		const outstanding = Number(row.amount_due ?? 0) - Number(row.amount_paid ?? 0);
		if (outstanding <= 0) continue;
		if (!row.lease || row.lease.status !== "active") continue;
		const entry: AttentionPayment = {
			paymentId: row.id,
			propertyId: row.lease.property_id,
			propertyLabel: propertyLabel(row.lease.property),
			periodStart: row.period_start,
			periodEnd: row.period_end,
			outstanding,
			currency: row.lease.currency || "TRY",
		};
		(row.period_end < todayISO ? overduePayments : upcomingPayments).push(entry);
	}
	overduePayments.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
	upcomingPayments.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
	return { overduePayments, upcomingPayments };
}

export function classifyLeases(rows: LeaseEndRow[], now: Date): AttentionLeaseEnd[] {
	return rows
		.map((l) => ({
			leaseId: l.id,
			propertyId: l.property_id,
			propertyLabel: propertyLabel(l.property),
			endDate: l.end_date,
			daysLeft: -daysBetween(l.end_date, now),
		}))
		.sort((a, b) => a.endDate.localeCompare(b.endDate));
}

/**
 * Order policies by urgency, not just by date.
 *
 * A LAPSED DASK outranks everything: it is legally mandatory, and it blocks a
 * tapu transfer and utility subscriptions on the day of the appointment. So the
 * sort is (already expired first) → (mandatory first) → (soonest first), rather
 * than the plain end-date sort the leases feed uses.
 */
export function classifyInsurance(rows: InsuranceRow[], now: Date): AttentionInsurance[] {
	return rows
		.map((i) => ({
			insuranceId: i.id,
			propertyId: i.property_id,
			propertyLabel: propertyLabel(i.property),
			kind: i.kind,
			endDate: i.end_date,
			daysLeft: -daysBetween(i.end_date, now),
			mandatory: i.kind === "dask",
		}))
		.sort((a, b) => {
			const aLapsed = a.daysLeft < 0, bLapsed = b.daysLeft < 0;
			if (aLapsed !== bLapsed) return aLapsed ? -1 : 1;
			if (a.mandatory !== b.mandatory) return a.mandatory ? -1 : 1;
			return a.endDate.localeCompare(b.endDate);
		});
}

export function classifyLeads(
	rows: LeadRow[],
	now: Date,
	leadSilentDays: number,
): AttentionLead[] {
	return rows
		.map((l) => ({
			leadId: l.id,
			name: l.full_name,
			status: l.status,
			lastCallAt: l.last_call_at,
			daysSilent: daysBetween(l.last_call_at ?? l.created_at, now),
		}))
		.filter((l) => l.daysSilent >= leadSilentDays)
		.sort((a, b) => b.daysSilent - a.daysSilent);
}
