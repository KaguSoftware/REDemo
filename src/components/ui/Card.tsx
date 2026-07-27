import React from "react";
import { Surface } from "./Surface";
import { cn } from "./cn";

/**
 * Standard content panel — now a thin alias over `Surface` tier="panel" so the
 * 60-odd existing call sites keep their API while inheriting the one surface
 * vocabulary. Prefer `<Surface>` directly in new code, and prefer NO surface at
 * all where a heading and space would do: the page is the surface, not the card.
 *
 * What changed: this used to be `rounded-2xl border-base-300/70 shadow-card`.
 * The shadow is gone (a panel does not float — see Surface.tsx), the radius now
 * comes from daisyUI's `--radius-box` token instead of a literal Tailwind step,
 * and the border is full-opacity `base-300` so it matches every other hairline
 * in the app rather than being the one surface at 70%.
 */
export function Card({
	className,
	padded = true,
	children,
	...rest
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
	return (
		<Surface padding={padded ? "lg" : "none"} className={className} {...rest}>
			{children}
		</Surface>
	);
}

/** Card section label — quiet sentence-case ink, weight carries hierarchy. */
export function CardLabel({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<h2 className={cn("text-sm font-semibold text-base-content/60", className)}>
			{children}
		</h2>
	);
}
