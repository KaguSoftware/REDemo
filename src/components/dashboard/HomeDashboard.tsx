"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/src/store";
import { listProperties } from "@/src/lib/db/properties";
import { listLeads } from "@/src/lib/db/leads";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { AppShell, Card, Badge, Skeleton, SkeletonGroup, Stack, Section, type BadgeTone } from "@/src/components/ui";
import { AttentionPanel } from "@/src/components/properties/AttentionPanel";
import { DashboardStats } from "@/src/components/properties/DashboardStats";
import { PortfolioAnalytics } from "./PortfolioAnalytics";
import { NewsFeed } from "./NewsFeed";
import { CommissionSummary } from "@/src/components/sales/CommissionSummary";
import { LEAD_STATUS_META } from "@/src/components/leads/leadStatus";
import { fmtMoney } from "@/src/lib/format";
import {
	Home, Users, UserPlus, FilePlus2, ArrowRight,
} from "lucide-react";

const QUICK_ACTIONS = [
	{ href: "/properties/new", label: "Taşınmaz ekle", icon: Home },
	{ href: "/leads?new=1", label: "Müşteri ekle", icon: Users },
	{ href: "/tenants?new=1", label: "Kiracı ekle", icon: UserPlus },
	{ href: "/documents/new", label: "Yeni belge", icon: FilePlus2 },
];

const PROPERTY_STATUS_LABEL: Record<string, string> = {
	vacant: "Boş",
	occupied: "Kirada",
	sold: "Satıldı",
};

function statusTone(status: string): BadgeTone {
	return status === "vacant" ? "slate" : status === "occupied" ? "emerald" : "blue";
}

/** Five rows matching the recents lists exactly — including the hairline rules
 *  the real list now draws top and bottom, or the block resizes on arrival. */
function RecentSkeleton() {
	return (
		<SkeletonGroup label="Yükleniyor" className="divide-y divide-base-300 border-y border-base-300">
			{[0, 1, 2, 3, 4].map((i) => (
				<div key={i} className="flex items-center gap-3 py-2.5">
					<div className="min-w-0 flex-1">
						<Skeleton className="h-3.5 w-2/3" />
						<Skeleton className="h-3 w-1/3 mt-1.5" />
					</div>
					<Skeleton className="h-5 w-14 rounded-full shrink-0" />
				</div>
			))}
		</SkeletonGroup>
	);
}

/** Landing page: cross-section of the whole CRM rather than one entity list. */
export function HomeDashboard() {
	const router = useRouter();
	const user = useAppStore((s) => s.user);
	const team = useAppStore((s) => s.team);
	const teamLoaded = useAppStore((s) => s.teamLoaded);

	// Client-side counterpart of the proxy's no-team redirect: soft navigations
	// (e.g. right after signup) never hit the middleware, so a signed-in user
	// without a team would sit on an empty dashboard until a hard refresh.
	useEffect(() => {
		if (user && teamLoaded && !team) router.replace("/onboarding");
	}, [user, teamLoaded, team, router]);

	const teamReady = teamLoaded && team != null;
	// Deliberately the SAME cache key and fetcher as /properties ("properties:all")
	// rather than a private "properties:recent": it is the identical query, so
	// sharing the key means the dashboard and the portfolio page hydrate each
	// other. Landing here first makes /properties paint instantly, and vice
	// versa, instead of each paying its own ~330ms round-trip for the same rows.
	const { data: recentProperties } = useCachedResource(
		user && teamReady ? "properties:all" : null,
		() => listProperties({}),
		undefined,
		{ enabled: !!user && teamReady },
	);
	const { data: recentLeads } = useCachedResource(
		user && teamReady ? "leads:all" : null,
		() => listLeads(),
		undefined,
		{ enabled: !!user && teamReady },
	);

	return (
		<AppShell title="Genel bakış" subtitle="Her şey bir bakışta" width="wide">
			{!user ? (
				<Card className="p-10 text-center">
					<p className="text-body text-base-content/70">Genel bakışı görmek için giriş yapın.</p>
					<p className="text-label text-base-content/50 mt-1">Üst çubuktaki &quot;Giriş yap&quot; düğmesini kullanın.</p>
				</Card>
			) : (
				/* The page owns its rhythm. Every band used to carry its own `mb-4`
				   — including CommissionSummary, which was wrapped in a bare
				   <div className="mb-4"> purely because its component had forgotten
				   to — so the spacing was the sum of six files' independent
				   decisions. `loose` marks the two real seams: what needs doing
				   today, then the state of the book, then everything else. */
				<Stack gap="loose">
					{/* 1. What needs doing today, and the money. An owner opens this
					    at 9am to find overdue rent; that answer leads. */}
					<Stack>
						<AttentionPanel />
						<DashboardStats />
					</Stack>

					{/* 2. The state of the book. */}
					<Stack>
						<PortfolioAnalytics />
						<CommissionSummary />
					</Stack>

					{/* 3. Recent activity, as plain regions. These were two Cards, which
					    is the habit this pass exists to break: a heading and space
					    group a list perfectly well, and the page stays one surface. */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
						<Section
							title="Son eklenen taşınmazlar"
							action={<SeeAll href="/properties" />}
						>
							{/* `null` (not loaded) and `[]` (loaded, genuinely empty) are
							    different answers. Collapsing them with `?.length` told an
							    agent with a full portfolio "Henüz taşınmaz yok" for the
							    half-second before their rows arrived. */}
							{recentProperties == null ? (
								<RecentSkeleton />
							) : recentProperties.length === 0 ? (
								<p className="text-body text-base-content/50 py-4">Henüz taşınmaz yok.</p>
							) : (
								<ul className="divide-y divide-base-300 border-y border-base-300">
									{recentProperties.slice(0, 5).map((p) => (
										<li key={p.id}>
											<Link
												href={`/properties/${p.id}`}
												className="flex items-center gap-3 py-2.5 hover:bg-base-200 -mx-2 px-2 rounded-field transition-colors"
											>
												<div className="min-w-0 flex-1">
													<p className="text-body text-base-content truncate">{p.address_line}</p>
													<p className="text-label text-base-content/50 truncate">
														{[p.city, p.nitelik].filter(Boolean).join(" · ") || p.homeowner_name}
													</p>
												</div>
												{p.list_price != null && (
													<span className="font-numeric text-label font-semibold text-base-content/70 whitespace-nowrap hidden sm:inline">
														{fmtMoney(Number(p.list_price), p.currency)}
													</span>
												)}
												<Badge tone={statusTone(p.status)}>
													{PROPERTY_STATUS_LABEL[p.status] ?? p.status}
												</Badge>
											</Link>
										</li>
									))}
								</ul>
							)}
						</Section>

						<Section title="Son eklenen müşteriler" action={<SeeAll href="/leads" />}>
							{recentLeads == null ? (
								<RecentSkeleton />
							) : recentLeads.length === 0 ? (
								<p className="text-body text-base-content/50 py-4">Henüz müşteri yok.</p>
							) : (
								<ul className="divide-y divide-base-300 border-y border-base-300">
									{recentLeads.slice(0, 5).map((l) => (
										<li key={l.id}>
											<Link
												href="/leads"
												className="flex items-center gap-3 py-2.5 hover:bg-base-200 -mx-2 px-2 rounded-field transition-colors"
											>
												<div className="min-w-0 flex-1">
													<p className="text-body text-base-content truncate">{l.full_name}</p>
													<p className="text-label text-base-content/50 truncate">
														{l.interested_in || l.phone || "—"}
													</p>
												</div>
												<Badge tone={LEAD_STATUS_META[l.status].tone}>
													{LEAD_STATUS_META[l.status].label}
												</Badge>
											</Link>
										</li>
									))}
								</ul>
							)}
						</Section>
					</div>

					{/* 4. The periphery, deliberately quiet. The quick actions were
					    four bordered, shadowed boxes with the same visual weight as
					    the KPI tiles — four navigation links dressed as data. They
					    are links now. The news feed sits last because it is the one
					    thing here that is not this office's own work. */}
					<Stack>
						<Section title="Kısayollar" size="subtitle">
							<div className="flex flex-wrap gap-x-6 gap-y-3">
								{QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
									<Link
										key={href}
										href={href}
										className="inline-flex items-center gap-2 text-body font-medium text-base-content/70 hover:text-primary transition-colors"
									>
										<Icon className="w-4 h-4 text-primary shrink-0" />
										{label}
									</Link>
								))}
							</div>
						</Section>

						{/* Market headlines. Own cache key, own failure mode — nothing
						    above it waits on the feeds. */}
						<NewsFeed />
					</Stack>
				</Stack>
			)}
		</AppShell>
	);
}

function SeeAll({ href }: { href: string }) {
	return (
		<Link
			href={href}
			className="inline-flex items-center gap-1 text-label font-semibold text-primary hover:underline"
		>
			Tümünü gör
			<ArrowRight className="w-3.5 h-3.5" />
		</Link>
	);
}
