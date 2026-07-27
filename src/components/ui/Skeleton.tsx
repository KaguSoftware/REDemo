import { cn } from "./cn";

/**
 * Loading placeholders.
 *
 * The rule for every skeleton in this app: it occupies the EXACT geometry of the
 * content that replaces it. Same row height, same column widths, same card
 * padding, same grid. A skeleton that is merely "about the right size" trades a
 * flash of empty state for a layout jump, which is not a fix.
 *
 * Motion lives on `SkeletonGroup`, not on the individual bars — see the
 * .skeleton-group comment in globals.css for why.
 */

/** Wrapper that owns the breathing animation for one surface. */
export function SkeletonGroup({
	className,
	children,
	label = "Yükleniyor",
}: {
	className?: string;
	children: React.ReactNode;
	/** Announced to screen readers in place of the silent visual placeholder. */
	label?: string;
}) {
	return (
		<div role="status" aria-label={label} aria-busy="true" className={cn("skeleton-group", className)}>
			{children}
		</div>
	);
}

/** A single tinted bar/box. Give it the height of the text or element it stands in for. */
export function Skeleton({ className }: { className?: string }) {
	return <div aria-hidden className={cn("bg-base-300/70 rounded-md", className)} />;
}

export function SkeletonCircle({ className }: { className?: string }) {
	return <div aria-hidden className={cn("bg-base-300/70 rounded-full", className)} />;
}

/**
 * A run of text lines. The last line is short, because real paragraphs end
 * mid-measure — equal-length bars read as a UI element, not as prose.
 */
export function SkeletonText({
	lines = 2,
	className,
	lineClassName,
}: {
	lines?: number;
	className?: string;
	lineClassName?: string;
}) {
	return (
		<div className={cn("space-y-2", className)}>
			{Array.from({ length: lines }, (_, i) => (
				<Skeleton
					key={i}
					className={cn("h-3", i === lines - 1 ? "w-1/2" : "w-full", lineClassName)}
				/>
			))}
		</div>
	);
}
