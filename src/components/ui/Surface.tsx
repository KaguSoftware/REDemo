import React from "react";
import { cn } from "./cn";

/**
 * The one surface vocabulary. Three tiers, and only three.
 *
 * Before this existed the app carried 13 distinct hand-rolled card class-strings
 * — three of them inside src/components/ui/ itself, disagreeing with each other
 * on border opacity — plus 10 border-radius values. The cause was cn() silently
 * failing to merge overrides (see cn.ts), so callers copy-pasted surface strings
 * rather than overriding the primitive. With merging fixed, this file is what
 * makes the raw strings unreachable.
 *
 * The rule that drives the tiers: ELEVATION MEANS "FLOATING ABOVE THE PAGE".
 * Previously shadow-card sat on the page's main panels AND on the tiles beside
 * them AND on the mobile list rows, while shadow-pop — the floating tier — was
 * used just as often (23 vs 25 vs 14). Depth encoded nothing. Now a shadow
 * appears only on something that genuinely floats over the content it covers.
 *
 *   flat    no chrome. Not a component — just a heading and space. This is the
 *           DEFAULT for page content; reach for `panel` only when a border
 *           earns its keep. (Nested panels are always wrong.)
 *   panel   hairline border on the page plane, `rounded-box`, NO shadow.
 *           For content that is genuinely a bounded group.
 *   inset   recessed `base-200` fill, no border. For a sub-region *inside* a
 *           panel — the one legitimate way to nest, because it reads as carved
 *           in rather than stacked on.
 *   raised  `shadow-pop`. ONLY for things that float over the page: Sheet,
 *           ConfirmDialog, dropdown and menu popovers, Toast, BulkActionBar.
 *
 * Radius comes from daisyUI's theme tokens, which were declared in globals.css
 * and then used exactly zero times: `rounded-box` (0.75rem) for surfaces,
 * `rounded-field` (0.5rem) for controls. Two values, both semantic.
 */
export type SurfaceTier = "panel" | "inset" | "raised";

/** Semantic fills. `neutral` is the default; the rest are attention states. */
export type SurfaceTone = "neutral" | "primary" | "error" | "warning" | "success" | "info";

export type SurfacePadding = "none" | "sm" | "md" | "lg";

/**
 * Tone fills are deliberately quieter on `panel` than on `inset`: a panel is
 * usually large, and a /10 wash across a full-width region reads as an alarm
 * even when the content is routine. An inset is small, so it needs more fill to
 * register at all.
 */
const PANEL_TONES: Record<SurfaceTone, string> = {
	neutral: "bg-base-100 border-base-300",
	primary: "bg-primary/6 border-primary/30",
	error:   "bg-error/6 border-error/30",
	warning: "bg-warning/6 border-warning/30",
	success: "bg-success/6 border-success/30",
	info:    "bg-info/6 border-info/30",
};

const INSET_TONES: Record<SurfaceTone, string> = {
	neutral: "bg-base-200",
	primary: "bg-primary/10",
	error:   "bg-error/10",
	warning: "bg-warning/10",
	success: "bg-success/10",
	info:    "bg-info/10",
};

const PADDING: Record<SurfacePadding, string> = {
	none: "",
	sm: "p-3",
	md: "p-4 sm:p-5",
	lg: "p-6 sm:p-8",
};

export interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
	tier?: SurfaceTier;
	tone?: SurfaceTone;
	padding?: SurfacePadding;
	/** Render as a different element — `section`, `li`, `button`, … */
	as?: React.ElementType;
}

export function Surface({
	tier = "panel",
	tone = "neutral",
	padding = "md",
	as: Tag = "div",
	className,
	children,
	...rest
}: SurfaceProps) {
	return (
		<Tag
			className={cn(
				"rounded-box",
				tier === "inset"
					? INSET_TONES[tone]
					: cn("border", PANEL_TONES[tone], tier === "raised" && "shadow-pop"),
				PADDING[padding],
				className,
			)}
			{...rest}
		>
			{children}
		</Tag>
	);
}

/**
 * Interactive surface — a panel that is itself the click target (stat tiles,
 * quick actions, picker cells). Hover lifts the border rather than adding a
 * shadow, because a shadow here would claim the element floats when it does not.
 */
export function SurfaceButton({
	tone = "neutral",
	padding = "md",
	className,
	children,
	...rest
}: Omit<SurfaceProps, "tier" | "as"> & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type="button"
			className={cn(
				"rounded-box border text-left w-full min-w-0",
				PANEL_TONES[tone],
				PADDING[padding],
				"transition-colors duration-150 cursor-pointer",
				"hover:border-base-content/25 hover:bg-base-200/50",
				"focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25",
				className,
			)}
			{...rest}
		>
			{children}
		</button>
	);
}
