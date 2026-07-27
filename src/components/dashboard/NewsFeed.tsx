"use client";

// Turkish real-estate / economy headlines on the dashboard.
//
// The most isolated surface in the app on purpose: it owns its own cache key,
// it links out rather than rendering anyone's article body, and every failure
// mode (dead feed, 401, offline) resolves to a quiet empty state. Nothing else
// on the dashboard waits on it.

import Link from "next/link";
import { useAppStore } from "@/src/store";
import { listNews } from "@/src/lib/news/client";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { Card, CardLabel, SkeletonGroup, Skeleton } from "@/src/components/ui";
import { Newspaper, ExternalLink } from "lucide-react";

/** "3 saat önce" — same shape as the notification bell's timeAgo. */
function timeAgo(iso: string | null): string {
	if (!iso) return "";
	const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
	if (s < 3600) return `${Math.floor(s / 60) || 1} dk önce`;
	if (s < 86_400) return `${Math.floor(s / 3600)} saat önce`;
	const d = Math.floor(s / 86_400);
	return d === 1 ? "dün" : `${d} gün önce`;
}

export function NewsFeed() {
	const user = useAppStore((s) => s.user);

	// Not gated on teamReady: headlines are the same for everyone and have no
	// team scope, so waiting on the team round-trip would delay them for nothing.
	const { data, loading } = useCachedResource(
		user ? "news:tr" : null,
		listNews,
		undefined,
		{ enabled: !!user },
	);

	// ⚠️ Branch on `data === null` BEFORE `data.length === 0`. "Not loaded yet"
	// and "loaded and genuinely empty" are different answers, and `data ?? []`
	// erases the difference — that is the exact bug the flash pass fixed across
	// ~13 screens.
	if (loading || data == null) return <NewsSkeleton />;
	// Every feed failed (offline, all three down). Say nothing rather than
	// showing an error for something the agent cannot act on and did not ask for.
	if (data.length === 0) return null;

	return (
		<Card>
			<div className="flex items-center gap-2 mb-3">
				<Newspaper className="w-4 h-4 text-base-content/50" />
				<CardLabel>Sektörden haberler</CardLabel>
			</div>
			<ul className="divide-y divide-base-200">
				{data.map((item) => (
					<li key={item.link}>
						<Link
							href={item.link}
							target="_blank"
							rel="noopener noreferrer"
							className="group flex items-start gap-3 py-2.5 -mx-2 px-2 rounded-field hover:bg-base-200 transition-colors"
						>
							<span className="flex-1 min-w-0 text-body text-base-content/85 group-hover:text-base-content line-clamp-2">
								{item.title}
							</span>
							<span className="flex items-center gap-1.5 shrink-0 text-label text-base-content/45 whitespace-nowrap pt-0.5">
								{/* Attribution on every row: this points at someone else's
								    reporting, it does not reproduce it. */}
								{item.source}
								{item.publishedAt && ` · ${timeAgo(item.publishedAt)}`}
								<ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
							</span>
						</Link>
					</li>
				))}
			</ul>
		</Card>
	);
}

/**
 * Same geometry as the real card: py-2.5 rows inside a Card with the identical
 * header, so the headlines replace the bars in place and nothing moves.
 * One breathing animation on the group, not one per bar.
 */
function NewsSkeleton() {
	return (
		<Card>
			<div className="flex items-center gap-2 mb-3">
				<Skeleton className="w-4 h-4 rounded-sm" />
				<Skeleton className="h-3 w-32" />
			</div>
			<SkeletonGroup label="Haberler yükleniyor" className="divide-y divide-base-200">
				{[0, 1, 2, 3].map((i) => (
					<div key={i} className="flex items-start gap-3 py-2.5">
						<Skeleton className="h-4 flex-1" />
						<Skeleton className="h-3 w-20 shrink-0 mt-0.5" />
					</div>
				))}
			</SkeletonGroup>
		</Card>
	);
}
