// "Needs attention" feed for the dashboard: overdue rent, rent due soon,
// leases expiring soon, and leads that have gone quiet. Same philosophy as
// stats.ts — a few cheap selects reduced in JS; cached under "attention" via
// useCachedResource and invalidated alongside "stats".
//
// Classification logic lives in attentionLogic.ts (pure, unit-tested);
// thresholds default to DEFAULT_ATTENTION_THRESHOLDS and can be overridden
// per user via profiles.settings (see settings.ts).

import { requireUser } from "./requireUser";
import {
	DEFAULT_ATTENTION_THRESHOLDS,
	classifyInsurance,
	classifyLeads,
	classifyLeases,
	classifyPayments,
	type AttentionInsurance,
	type AttentionLead,
	type AttentionLeaseEnd,
	type AttentionPayment,
	type AttentionThresholds,
	type InsuranceRow,
	type LeadRow,
	type LeaseEndRow,
	type PaymentRow,
} from "./attentionLogic";

export type {
	AttentionInsurance, AttentionLead, AttentionLeaseEnd, AttentionPayment, AttentionThresholds,
};

export interface AttentionData {
	overduePayments: AttentionPayment[];
	upcomingPayments: AttentionPayment[];
	endingLeases: AttentionLeaseEnd[];
	staleLeads: AttentionLead[];
	expiringInsurance: AttentionInsurance[];
	total: number;
}

export async function getAttentionData(
	thresholds: AttentionThresholds = DEFAULT_ATTENTION_THRESHOLDS,
): Promise<AttentionData> {
	const { supabase } = await requireUser();

	const now = new Date();
	const todayISO = now.toISOString().slice(0, 10);
	const soon = new Date(now.getTime() + thresholds.upcomingDays * 86_400_000)
		.toISOString().slice(0, 10);
	const leaseHorizon = new Date(now.getTime() + thresholds.leaseWarnDays * 86_400_000)
		.toISOString().slice(0, 10);
	const insuranceHorizon = new Date(now.getTime() + thresholds.insuranceWarnDays * 86_400_000)
		.toISOString().slice(0, 10);
	// Policies that lapsed long ago are history, not a task. 90 days matches the
	// same cut-off in run_work_checks(), so the panel and the notification agree.
	const insuranceFloor = new Date(now.getTime() - 90 * 86_400_000)
		.toISOString().slice(0, 10);

	// A FOURTH query in the SAME wave. Measured on this project's database: one
	// round-trip is ~330ms, but an extra query inside an existing Promise.all is
	// ~12ms. Awaiting this above the others would have cost the panel a full
	// round-trip; here it is nearly free.
	const [payRes, leaseRes, leadRes, insuranceRes] = await Promise.all([
		supabase
			.from("payments")
			.select(
				"id, period_start, period_end, amount_due, amount_paid, " +
				"lease:leases(id, status, currency, property_id, " +
				"property:properties(id, address_line, homeowner_name))",
			)
			.lte("period_end", soon),
		supabase
			.from("leases")
			.select("id, end_date, property_id, property:properties(id, address_line, homeowner_name)")
			.eq("status", "active")
			.gte("end_date", todayISO)
			.lte("end_date", leaseHorizon),
		supabase
			.from("leads")
			.select("id, full_name, status, last_call_at, created_at")
			.in("status", ["new", "follow_up", "interested"]),
		supabase
			.from("property_insurance")
			.select(
				"id, kind, end_date, property_id, " +
				"property:properties(id, address_line, homeowner_name)",
			)
			.gte("end_date", insuranceFloor)
			.lte("end_date", insuranceHorizon),
	]);
	if (payRes.error) throw payRes.error;
	if (leaseRes.error) throw leaseRes.error;
	if (leadRes.error) throw leadRes.error;
	if (insuranceRes.error) throw insuranceRes.error;

	const { overduePayments, upcomingPayments } = classifyPayments(
		(payRes.data ?? []) as unknown as PaymentRow[],
		todayISO,
	);
	const endingLeases = classifyLeases(
		(leaseRes.data ?? []) as unknown as LeaseEndRow[],
		now,
	);
	const staleLeads = classifyLeads(
		(leadRes.data ?? []) as LeadRow[],
		now,
		thresholds.leadSilentDays,
	);

	const expiringInsurance = classifyInsurance(
		(insuranceRes.data ?? []) as unknown as InsuranceRow[],
		now,
	);

	return {
		overduePayments,
		upcomingPayments,
		endingLeases,
		staleLeads,
		expiringInsurance,
		total:
			overduePayments.length + upcomingPayments.length +
			endingLeases.length + staleLeads.length + expiringInsurance.length,
	};
}
