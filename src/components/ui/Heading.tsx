import React from "react";
import { cn } from "./cn";

/**
 * The app's only heading. Before this existed there were 19 distinct heading
 * class-strings across 40 call sites and no primitive at all: `CardLabel`'s look
 * was re-typed inline 12 times, the old SectionHeader's look 8 times — with
 * `font-semibold` where the component itself used `font-bold` — and
 * `font-display` was applied to 8 of the 19 variants and forgotten on the rest.
 *
 * Two decisions are enforced here rather than remembered:
 *
 * 1. SIZE IS SEMANTIC. `size` names the job (display / title / subtitle /
 *    label), not a pixel value, and is independent of `as` so a visually quiet
 *    heading can still be the correct level for a screen reader. That
 *    separation is what the old code lacked: PropertyDetail emitted a second
 *    <h1> purely to get bigger text, so the semantic top-level heading and the
 *    visually dominant one were different elements with different content.
 *
 * 2. WEIGHT IS SPARSE. The app ran 174 `font-semibold` against 5
 *    `font-normal` — roughly three-quarters of all text at semibold or heavier,
 *    which is why "weight-driven hierarchy" produced none. Weight is now
 *    spent only here and on numerals; body copy is normal weight.
 */
export type HeadingSize = "display" | "title" | "subtitle" | "label";

const SIZES: Record<HeadingSize, string> = {
	// font-display adds the tighter tracking and balanced wrapping; it belongs
	// on the two sizes large enough for tracking to be visible, and nowhere else.
	display: "font-display text-display font-semibold text-base-content",
	title: "font-display text-title font-semibold text-base-content",
	subtitle: "text-subtitle font-semibold text-base-content",
	// The quiet one: a group label above content, not a title. Deliberately
	// dimmed and small — it orients, it does not announce.
	label: "text-label font-semibold text-base-content/60",
};

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
	as?: "h1" | "h2" | "h3" | "h4";
	size?: HeadingSize;
}

export function Heading({
	as: Tag = "h2",
	size = "title",
	className,
	children,
	...rest
}: HeadingProps) {
	return (
		<Tag className={cn(SIZES[size], className)} {...rest}>
			{children}
		</Tag>
	);
}

/**
 * A heading with its own optional trailing action, and the space that separates
 * it from what follows. Exists because "more space above a heading than below
 * it" is a rhythm rule no call site remembers — every section in the app used
 * to pick its own `mb-2` / `mb-4` / `mb-6`.
 */
export function SectionHeading({
	as = "h2",
	size = "subtitle",
	action,
	className,
	children,
	...rest
}: HeadingProps & { action?: React.ReactNode }) {
	return (
		<div className={cn("flex items-center justify-between gap-3 mb-3", className)}>
			<Heading as={as} size={size} {...rest}>
				{children}
			</Heading>
			{action && <div className="shrink-0">{action}</div>}
		</div>
	);
}
