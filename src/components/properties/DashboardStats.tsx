"use client";

import { useRouter } from "next/navigation";
import { useAppStore, useTeamReady } from "@/src/store";
import { getDashboardStats } from "@/src/lib/db/stats";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { cn, StatsSkeleton, SurfaceButton } from "@/src/components/ui";
import { Home, KeyRound, Wallet, Users } from "lucide-react";

function fmtAmount(n: number): string {
	return n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

/** "12,500 TRY · 300 USD" from a currency→amount map; null when empty. */
function joinByCurrency(map: Record<string, number>): string | null {
	const parts = Object.entries(map).map(([cur, amt]) => `${fmtAmount(amt)} ${cur}`);
	return parts.length ? parts.join(" · ") : null;
}

/** KPI strip above the dashboard map. */
export function DashboardStats() {
	const router = useRouter();
	const user = useAppStore((s) => s.user);
	const teamReady = useTeamReady();
	const setFilters = useAppStore((s) => s.setFilters);
	const resetFilters = useAppStore((s) => s.resetFilters);
	const { data } = useCachedResource(
		user && teamReady ? "stats" : null,
		getDashboardStats,
		undefined,
		{ enabled: !!user && teamReady },
	);

	// `data === null` covers both "loading" and "not started yet" (the key is
	// disabled until the team is known). Returning null in either case removed the
	// whole KPI strip from the layout and let it drop in later, shoving the page
	// down — so both render the skeleton, which holds the exact same 4-tile grid.
	if (!data) return <StatsSkeleton />;

	const { properties, monthlyRentByCurrency, outstandingByCurrency, leadsByStatus, totalLeads } = data;
	const rent = joinByCurrency(monthlyRentByCurrency);
	const outstanding = joinByCurrency(outstandingByCurrency);
	const activeLeads = leadsByStatus.new + leadsByStatus.follow_up + leadsByStatus.interested;

	return (
		<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
			<StatCard
				icon={Home}
				label="Portföy"
				value={String(properties.vacant + properties.occupied + properties.sold)}
				detail={`${properties.occupied} kirada · ${properties.vacant} boş${properties.sold ? ` · ${properties.sold} satıldı` : ""}`}
				onClick={() => { resetFilters(); router.push("/properties"); }}
				hint="Tüm taşınmazları göster"
			/>
			<StatCard
				icon={KeyRound}
				label="Aylık kira"
				value={rent ?? "—"}
				detail={rent ? "etkin kira sözleşmeleri toplamı" : "etkin kira sözleşmesi yok"}
				onClick={() => { setFilters({ status: "occupied" }); router.push("/properties"); }}
				hint="Kiradaki taşınmazları göster"
			/>
			<StatCard
				icon={Wallet}
				label="Bekleyen tahsilat"
				value={outstanding ?? "0"}
				detail={outstanding ? "etkin sözleşmelerde ödenmemiş" : "tümü ödendi"}
				danger={!!outstanding}
				onClick={() => { setFilters({ status: "occupied" }); router.push("/properties"); }}
				hint="Kiradaki taşınmazları göster"
			/>
			<StatCard
				icon={Users}
				label="Müşteriler"
				value={String(totalLeads)}
				detail={`${activeLeads} etkin · ${leadsByStatus.closed} kapandı`}
				onClick={() => router.push("/leads")}
				hint="Müşterileri aç"
			/>
		</div>
	);
}

function StatCard({
	icon: Icon,
	label,
	value,
	detail,
	danger,
	onClick,
	hint,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
	detail: string;
	danger?: boolean;
	onClick?: () => void;
	hint?: string;
}) {
	return (
		<SurfaceButton onClick={onClick} title={hint} padding="md">
			<div className="flex items-center gap-1.5 mb-1">
				<Icon className="w-3.5 h-3.5 text-base-content/50" />
				<p className="text-xs font-semibold text-base-content/55">{label}</p>
			</div>
			{/* Money is the reason an office owner opens this app, and it used to
			    be the worst-rendered thing on the page. The value shrank to
			    `text-sm` — nav-label size — as soon as it exceeded 12 characters,
			    which is precisely what a two-currency total does. It also used
			    font-display rather than font-numeric, so the tabular numerals
			    this project commits to never touched its headline figures.
			    Now: one size, always tabular, wrapping rather than shrinking. */}
			<p
				className={cn(
					"font-numeric text-xl font-semibold text-base-content wrap-break-word",
					danger && "text-error",
				)}
				title={value}
			>
				{value}
			</p>
			<p className="text-xs text-base-content/60 mt-0.5 truncate" title={detail}>{detail}</p>
		</SurfaceButton>
	);
}
