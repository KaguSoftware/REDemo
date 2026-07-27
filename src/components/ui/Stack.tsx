import React from "react";
import { Heading } from "./Heading";
import { cn } from "./cn";

/**
 * Vertical rhythm, owned by the page rather than by each block.
 *
 * Every band on the dashboard used to hardcode its own `mb-4`, including one
 * wrapped in `<div className="mb-4">` for no reason except that its component
 * had forgotten to — so the page's spacing was the sum of decisions taken
 * independently in six files, and the final band's margin pushed dead space
 * against the footer. A block should not know what follows it.
 *
 * `gap` names the relationship, not a number:
 *   tight    items inside one idea
 *   default  separate blocks in one section
 *   loose    the seam between sections — the pause that makes a page read as
 *            edited rather than accumulated
 */
const GAPS = {
	tight: "space-y-3",
	default: "space-y-6",
	loose: "space-y-12",
} as const;

export function Stack({
	gap = "default",
	as: Tag = "div",
	className,
	children,
	...rest
}: React.HTMLAttributes<HTMLElement> & {
	gap?: keyof typeof GAPS;
	as?: React.ElementType;
}) {
	return (
		<Tag className={cn(GAPS[gap], className)} {...rest}>
			{children}
		</Tag>
	);
}

/**
 * A titled region with no chrome — tier 0, the default way to group content.
 *
 * This is the shape most of the app should have used all along. A `Card` around
 * every group is what turned each page into a stack of identical white boxes;
 * a heading and space separate content just as well and leave the page reading
 * as one surface.
 */
export function Section({
	title,
	action,
	as = "h2",
	size = "subtitle",
	className,
	children,
}: {
	title: React.ReactNode;
	/** Optional trailing control — a "see all" link, a filter, a button. */
	action?: React.ReactNode;
	as?: "h2" | "h3";
	size?: "title" | "subtitle";
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<section className={className}>
			<div className="mb-3 flex items-center justify-between gap-3">
				<Heading as={as} size={size}>{title}</Heading>
				{action && <div className="shrink-0">{action}</div>}
			</div>
			{children}
		</section>
	);
}
