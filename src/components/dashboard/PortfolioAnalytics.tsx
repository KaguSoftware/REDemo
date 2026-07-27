"use client";

import Link from "next/link";
import { useAppStore, useTeamReady } from "@/src/store";
import { getDashboardStats, type PropertyHealthRow } from "@/src/lib/db/stats";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { Card, CardLabel, Badge, cn, Skeleton, SkeletonGroup, Surface, Stat, StatRow } from "@/src/components/ui";
import { fmtMoney } from "@/src/lib/format";
import {
	TrendingUp, FileText, CalendarClock, Wallet, PhoneMissed, Building2,
} from "lucide-react";

const EXPIRY_WINDOW_DAYS = 90;
const MAX_HEALTH_ROWS = 5;

function pct(v: number): string {
	return `%${Math.round(v * 100)}`;
}

function fmtAmount(n: number): string {
	return n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

function fmtDate(iso: string): string {
	return new Date(`${iso}T00:00:00`).toLocaleDateString("tr-TR", {
		day: "numeric", month: "short", year: "numeric",
	});
}

/** True when the lease's end date falls within the next 90 days (not past). */
function endsSoon(row: PropertyHealthRow): boolean {
	if (!row.lease_end_date) return false;
	const end = new Date(`${row.lease_end_date}T00:00:00`).getTime();
	const now = Date.now();
	return end >= now - 24 * 60 * 60 * 1000 && end <= now + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/** Mirrors the card below: header row, two meters, a 4-tile grid, a list block. */
function AnalyticsSkeleton() {
	return (
		<Card className="mb-4">
			<SkeletonGroup label="Portföy sağlığı yükleniyor">
				<div className="flex items-center gap-2 mb-4">
					<Skeleton className="w-4 h-4 rounded-sm" />
					<Skeleton className="h-4 w-28" />
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{[0, 1].map((i) => (
						<div key={i}>
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-2 w-full mt-2 rounded-full" />
							<Skeleton className="h-3 w-2/3 mt-2" />
						</div>
					))}
				</div>
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5">
					{[0, 1, 2, 3].map((i) => (
						<Surface key={i} tier="inset" padding="sm">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-7 w-10 mt-1" />
						</Surface>
					))}
				</div>
				<div className="mt-5">
					<Skeleton className="h-3 w-40 mb-2" />
					<Skeleton className="h-4 w-52" />
				</div>
			</SkeletonGroup>
		</Card>
	);
}

/**
 * Portfolio health panel: occupancy + this month's collection meters, compact
 * stat tiles (active leases, expiring soon, overdue, silent leads) and the
 * worst-offender rental list — all derived from the same cached "stats" fetch
 * as the KPI cards (no extra queries). Renders nothing until there is
 * something meaningful to show.
 */
export function PortfolioAnalytics() {
	const user = useAppStore((s) => s.user);
	const teamReady = useTeamReady();
	const { data } = useCachedResource(
		user && teamReady ? "stats" : null,
		getDashboardStats,
		undefined,
		{ enabled: !!user && teamReady },
	);
	// Reserve the card while the shared "stats" fetch is in flight. For any team
	// with data this is the geometry that lands, so nothing below it moves. A
	// brand-new empty team does see it collapse — that is a one-time state, and
	// the alternative (this whole card dropping in late on every load, for
	// everyone) is the worse trade.
	if (!data) return <AnalyticsSkeleton />;

	const {
		occupancyRate, collectionThisMonth,
		activeLeases, leasesExpiringSoon, overdue, leadsWithNoActivity,
		propertyHealth,
	} = data;
	const collections = Object.entries(collectionThisMonth).filter(([, c]) => c.due > 0);

	const attentionRows = (propertyHealth ?? [])
		.filter((r) => r.overdue_count > 0 || endsSoon(r))
		.slice(0, MAX_HEALTH_ROWS);

	const hasMeters = occupancyRate != null || collections.length > 0;
	const hasStats = activeLeases > 0 || leasesExpiringSoon > 0 || overdue.count > 0 || leadsWithNoActivity > 0;
	if (!hasMeters && !hasStats && attentionRows.length === 0) return null;

	const overdueAmounts = Object.entries(overdue.totalByCurrency)
		.filter(([, amount]) => amount > 0)
		.map(([cur, amount]) => fmtMoney(amount, cur))
		.join(" + ");

	return (
		<Card className="mb-4">
			<div className="flex items-center gap-2 mb-4">
				<TrendingUp className="w-4 h-4 text-base-content/50" />
				<CardLabel>Portföy sağlığı</CardLabel>
			</div>

			{/* Meters: occupancy + this month's collection */}
			{hasMeters && (
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{occupancyRate != null && (
						<Meter
							label="Doluluk"
							ratio={occupancyRate}
							caption={`Kiralanabilir taşınmazlarda doluluk oranı: ${pct(occupancyRate)}`}
						/>
					)}
					{collections.map(([cur, c]) => (
						<Meter
							key={cur}
							label={`Bu ay tahsil edilen (${cur})`}
							ratio={c.due > 0 ? Math.min(c.paid / c.due, 1) : 0}
							caption={`${fmtAmount(c.paid)} / ${fmtAmount(c.due)} ${cur} tahsil edildi`}
							danger={c.paid < c.due}
						/>
					))}
				</div>
			)}

			{/* Compact stat tiles. These are the SAME component as the KPI strip
			    above the fold — they used to be two near-identical tile designs
			    30px apart, which is what read as sloppiness. The only difference
			    that survives is the one that means something: these are `inset`
			    because they live inside a panel. */}
			<StatRow className={cn(hasMeters && "mt-5")}>
				<Stat
					inset
					icon={FileText}
					label="Aktif sözleşme"
					value={String(activeLeases)}
				/>
				<Stat
					inset
					icon={CalendarClock}
					label="90 gün içinde bitecek"
					value={String(leasesExpiringSoon)}
					tone={leasesExpiringSoon > 0 ? "warning" : "neutral"}
				/>
				<Stat
					inset
					icon={Wallet}
					label="Geciken ödeme"
					value={String(overdue.count)}
					detail={overdue.count > 0 && overdueAmounts ? overdueAmounts : undefined}
					tone={overdue.count > 0 ? "error" : "neutral"}
				/>
				<Stat
					inset
					icon={PhoneMissed}
					label="Hiç aranmamış müşteri"
					value={String(leadsWithNoActivity)}
				/>
			</StatRow>

			{/* Worst-offender rentals */}
			<div className="mt-5">
				<div className="flex items-center gap-1.5 mb-2">
					<Building2 className="w-3.5 h-3.5 text-base-content/50" />
					<p className="text-xs font-semibold text-base-content/60">Dikkat gereken taşınmazlar</p>
				</div>
				{attentionRows.length === 0 ? (
					<p className="text-sm text-base-content/50">Portföyünüz sağlıklı görünüyor ✓</p>
				) : (
					<ul className="divide-y divide-base-300 rounded-box border border-base-300 overflow-hidden">
						{attentionRows.map((row) => (
							<li key={row.id}>
								<Link
									href={`/properties/${row.id}`}
									className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-sm hover:bg-base-200 transition-colors"
								>
									<span className="font-medium text-base-content truncate min-w-0 flex-1 basis-full sm:basis-0">
										{row.address_line}
									</span>
									{row.overdue_count > 0 && (
										<Badge tone="red">{row.overdue_count} geciken ödeme</Badge>
									)}
									{endsSoon(row) && row.lease_end_date && (
										<Badge tone="amber">Sözleşme bitiyor: {fmtDate(row.lease_end_date)}</Badge>
									)}
								</Link>
							</li>
						))}
					</ul>
				)}
			</div>
		</Card>
	);
}

function Meter({
	label,
	ratio,
	caption,
	danger,
}: {
	label: string;
	ratio: number;
	caption: string;
	danger?: boolean;
}) {
	return (
		<div>
			<div className="flex items-baseline justify-between mb-1.5">
				<p className="text-xs font-semibold text-base-content/55">{label}</p>
				<p className={`font-display text-base font-semibold ${danger ? "text-warning" : "text-base-content"}`}>{pct(ratio)}</p>
			</div>
			<div className="h-2 rounded-full bg-base-200 overflow-hidden" role="meter" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
				<div
					className={`h-full rounded-full transition-[width] duration-300 ${danger ? "bg-warning" : "bg-success"}`}
					style={{ width: `${Math.round(ratio * 100)}%` }}
				/>
			</div>
			<p className="text-xs text-base-content/60 mt-1.5">{caption}</p>
		</div>
	);
}
