"use client";

import { useRouter } from "next/navigation";
import { useAppStore, useTeamReady } from "@/src/store";
import { getDashboardStats } from "@/src/lib/db/stats";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { StatsSkeleton, Stat, StatRow } from "@/src/components/ui";
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
		<StatRow>
			<Stat
				icon={Home}
				label="Portföy"
				value={String(properties.vacant + properties.occupied + properties.sold)}
				detail={`${properties.occupied} kirada · ${properties.vacant} boş${properties.sold ? ` · ${properties.sold} satıldı` : ""}`}
				onClick={() => { resetFilters(); router.push("/properties"); }}
				hint="Tüm taşınmazları göster"
			/>
			<Stat
				icon={KeyRound}
				label="Aylık kira"
				value={rent ?? "—"}
				detail={rent ? "etkin kira sözleşmeleri toplamı" : "etkin kira sözleşmesi yok"}
				onClick={() => { setFilters({ status: "occupied" }); router.push("/properties"); }}
				hint="Kiradaki taşınmazları göster"
			/>
			<Stat
				icon={Wallet}
				label="Bekleyen tahsilat"
				value={outstanding ?? "0"}
				detail={outstanding ? "etkin sözleşmelerde ödenmemiş" : "tümü ödendi"}
				tone={outstanding ? "error" : "neutral"}
				onClick={() => { setFilters({ status: "occupied" }); router.push("/properties"); }}
				hint="Kiradaki taşınmazları göster"
			/>
			<Stat
				icon={Users}
				label="Müşteriler"
				value={String(totalLeads)}
				detail={`${activeLeads} etkin · ${leadsByStatus.closed} kapandı`}
				onClick={() => router.push("/leads")}
				hint="Müşterileri aç"
			/>
		</StatRow>
	);
}
