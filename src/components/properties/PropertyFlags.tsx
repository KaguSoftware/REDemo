"use client";

// The two at-a-glance flags a Turkish agent is asked about constantly:
// is the DASK in order, and is this unit citizenship-eligible?
//
// Deliberately QUIET. Only actionable states render — a valid DASK and an
// unassessed citizenship status show nothing at all. A badge on every row for
// every property would be wallpaper, and the missing-DASK warning is the one
// that has to cut through.

import { Badge } from "@/src/components/ui";
import type { InsuranceSummary } from "@/src/lib/db/types";
import { policyState } from "@/src/lib/insurance";
import { ShieldAlert } from "lucide-react";

interface Props {
	insurance?: InsuranceSummary[];
	citizenshipEligible?: boolean | null;
	todayISO: string;
	horizonISO: string;
}

export function PropertyFlags({
	insurance,
	citizenshipEligible,
	todayISO,
	horizonISO,
}: Props) {
	const dask = (insurance ?? []).find((i) => i.kind === "dask");
	// "No policy row" and "a policy that lapsed" are different problems: the
	// first office has to buy cover, the second only has to renew.
	const daskLabel = !dask
		? "DASK yok"
		: policyState(dask.end_date, todayISO, horizonISO) === "expired"
			? "DASK süresi doldu"
			: null;

	if (!daskLabel && !citizenshipEligible) return null;

	return (
		<>
			{daskLabel && (
				<Badge tone="red">
					<ShieldAlert className="w-3 h-3" />
					{daskLabel}
				</Badge>
			)}
			{citizenshipEligible && <Badge tone="indigo">Vatandaşlığa uygun</Badge>}
		</>
	);
}
