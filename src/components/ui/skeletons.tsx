import { Card } from "./Card";
import { Surface } from "./Surface";
import { Skeleton, SkeletonCircle, SkeletonText, SkeletonGroup } from "./Skeleton";
import { cn } from "./cn";

/**
 * Per-surface loading placeholders.
 *
 * Each one mirrors the geometry of the component it stands in for — the grid,
 * the row height, the column rhythm, the card padding. When the data lands the
 * bars are replaced in place and nothing moves. If you change a table's row
 * padding, change its skeleton too; a skeleton that has drifted out of sync is
 * worse than none, because it promises a layout it will not deliver.
 *
 * That rule is why these no longer hand-write the card chrome. StatsSkeleton
 * and TableSkeleton used to carry their own literal
 * `bg-base-100 rounded-2xl border border-base-300 shadow-card` strings — two of
 * the app's 13 card variants, living inside the design system itself and
 * disagreeing with `Card` on border opacity. Any change to the surface tier
 * updated the real components and silently left these behind. They now render
 * the same `Surface` the real thing does, so drift is impossible rather than
 * merely discouraged.
 */

/** DashboardStats' 4-tile KPI strip. Mirrors StatCard's Surface + padding. */
export function StatsSkeleton({ className }: { className?: string }) {
	return (
		<SkeletonGroup
			label="Özet yükleniyor"
			className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3", className)}
		>
			{[0, 1, 2, 3].map((i) => (
				<Surface key={i} padding="md">
					<div className="flex items-center gap-1.5 mb-1">
						<Skeleton className="w-3.5 h-3.5 rounded-sm" />
						<Skeleton className="h-3 w-16" />
					</div>
					<Skeleton className="h-7 w-20" />
					<Skeleton className="h-3 w-24 mt-1.5" />
				</Surface>
			))}
		</SkeletonGroup>
	);
}

/**
 * A table inside a Card, with the mobile card-list variant the real tables also
 * render. `columns` are flex-basis-ish widths so the bars line up under the real
 * headers instead of forming an even, obviously-fake grid.
 */
export function TableSkeleton({
	rows = 6,
	columns = ["w-32", "w-48", "w-16", "w-20", "w-24"],
	thumb = false,
	className,
	label = "Liste yükleniyor",
}: {
	rows?: number;
	columns?: string[];
	/** Reserve the 44px cover-image cell (property table). */
	thumb?: boolean;
	className?: string;
	label?: string;
}) {
	return (
		<SkeletonGroup label={label} className={className}>
			{/* Mobile: the card list the real tables render below sm. */}
			<div className="block sm:hidden space-y-3">
				{Array.from({ length: Math.min(rows, 4) }, (_, i) => (
					<Surface key={i} padding="md">
						<div className="flex items-start gap-3">
							{thumb && <Skeleton className="w-11 h-11 rounded-field shrink-0" />}
							<div className="min-w-0 flex-1">
								<Skeleton className="h-4 w-2/3" />
								<Skeleton className="h-3 w-1/2 mt-2" />
							</div>
							<Skeleton className="h-5 w-16 rounded-full shrink-0" />
						</div>
					</Surface>
				))}
			</div>

			{/* Desktop: the table body. Row height comes from the shared density
			    token (--spacing-row / --spacing-row-media in globals.css) rather
			    than the inline `style={{ height: 44 | 60 }}` it used to carry —
			    a raw pixel escape hatch no token sweep could ever have found. */}
			<Card padded={false} className="hidden sm:block overflow-hidden">
				{Array.from({ length: rows }, (_, i) => (
					<div
						key={i}
						className={cn(
							"flex items-center gap-4 px-4 border-b border-base-300 last:border-0",
							thumb ? "h-row-media" : "h-row",
						)}
					>
						{thumb && <Skeleton className="w-11 h-11 rounded-field shrink-0" />}
						{columns.map((w, c) => (
							<Skeleton key={c} className={cn("h-3.5 shrink-0", w)} />
						))}
					</div>
				))}
			</Card>
		</SkeletonGroup>
	);
}

/** Card grid — projects, documents, and other tile surfaces. */
export function CardListSkeleton({
	cards = 6,
	columns = "sm:grid-cols-2 lg:grid-cols-3",
	className,
	label = "Yükleniyor",
}: {
	cards?: number;
	columns?: string;
	className?: string;
	label?: string;
}) {
	return (
		<SkeletonGroup label={label} className={cn("grid grid-cols-1 gap-4", columns, className)}>
			{/* padding="md" matches the tile surfaces this stands in for. It used
			    to pass `className="p-5"` into a Card whose base is `p-6 sm:p-8`,
			    which the old cn() silently discarded — the skeleton rendered 4px
			    wider than it claimed for as long as it has existed. */}
			{Array.from({ length: cards }, (_, i) => (
				<Surface key={i} padding="md">
					<div className="flex items-start gap-3">
						<SkeletonCircle className="w-9 h-9 shrink-0" />
						<div className="min-w-0 flex-1">
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-3 w-1/2 mt-2" />
						</div>
					</div>
					<SkeletonText lines={2} className="mt-4" />
				</Surface>
			))}
		</SkeletonGroup>
	);
}

/** Detail pages: a heading block, a stat row, then two content panels. */
export function DetailSkeleton({ className }: { className?: string }) {
	return (
		<SkeletonGroup label="Kayıt yükleniyor" className={cn("space-y-5", className)}>
			<Card>
				<Skeleton className="h-6 w-1/2" />
				<Skeleton className="h-3.5 w-1/3 mt-3" />
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
					{[0, 1, 2, 3].map((i) => (
						<div key={i}>
							<Skeleton className="h-3 w-14" />
							<Skeleton className="h-4 w-20 mt-2" />
						</div>
					))}
				</div>
			</Card>
			<Card>
				<Skeleton className="h-4 w-32" />
				<SkeletonText lines={4} className="mt-4" />
			</Card>
		</SkeletonGroup>
	);
}

/**
 * Whole-route fallback for `loading.tsx`, where AppShell renders its own chrome
 * and only the main column is unknown. Deliberately generic: a route-level
 * loading file cannot know which surface it precedes.
 */
export function PageSkeleton({ className }: { className?: string }) {
	return (
		<SkeletonGroup label="Sayfa yükleniyor" className={cn("space-y-4", className)}>
			<Skeleton className="h-9 w-full rounded-field" />
			<Card padded={false} className="overflow-hidden">
				{Array.from({ length: 6 }, (_, i) => (
					<div key={i} className="flex items-center gap-4 px-4 h-row border-b border-base-300 last:border-0">
						<Skeleton className="h-3.5 w-32" />
						<Skeleton className="h-3.5 w-48" />
						<Skeleton className="h-3.5 w-20" />
						<Skeleton className="h-3.5 w-24" />
					</div>
				))}
			</Card>
		</SkeletonGroup>
	);
}
