import React from "react";
import { Surface, SurfaceButton, type SurfaceTone } from "./Surface";
import { cn } from "./cn";

/**
 * One stat tile.
 *
 * There used to be two, roughly 30px apart on the dashboard: DashboardStats'
 * (rounded-2xl / shadow / px-4 py-3.5 / value text-xl) and PortfolioAnalytics'
 * (rounded-xl / tinted / no shadow / px-3 py-2.5 / value text-lg). Same icon
 * size, same 12px label, same 4-across grid — alike enough that the difference
 * read as carelessness rather than intent. Near-repetition is the specific
 * mechanism that makes a page look cheap.
 *
 * THE VALUE IS ALWAYS TABULAR AND ALWAYS ONE SIZE. The old tile shrank its
 * value to text-sm — nav-label size — once the string passed 12 characters,
 * which is exactly what a two-currency total does; so the single most important
 * number in the product was rendered smaller than the label above it. It also
 * used font-display rather than font-numeric, so the tabular numerals this
 * project commits to never touched a money figure. A long value now wraps.
 */
export function Stat({
	icon: Icon,
	label,
	value,
	detail,
	tone = "neutral",
	inset = false,
	onClick,
	hint,
	className,
}: {
	icon?: React.ComponentType<{ className?: string }>;
	label: string;
	value: React.ReactNode;
	/** Secondary line under the value. */
	detail?: React.ReactNode;
	tone?: SurfaceTone;
	/** Render recessed, for a tile that lives INSIDE a panel. */
	inset?: boolean;
	onClick?: () => void;
	hint?: string;
	className?: string;
}) {
	const toneInk =
		tone === "error" ? "text-error"
		: tone === "warning" ? "text-warning"
		: tone === "success" ? "text-success"
		: "text-base-content";

	const body = (
		<>
			<div className="flex items-center gap-1.5">
				{Icon && (
					<Icon className={cn("w-3.5 h-3.5 shrink-0", tone === "neutral" ? "text-base-content/50" : toneInk)} />
				)}
				<p className="text-label font-semibold text-base-content/55 truncate">{label}</p>
			</div>
			<p className={cn("mt-1 font-numeric text-title font-semibold wrap-break-word", toneInk)}>
				{value}
			</p>
			{detail && (
				<p className="mt-0.5 text-label text-base-content/60 wrap-break-word">{detail}</p>
			)}
		</>
	);

	if (onClick) {
		return (
			<SurfaceButton tone={tone} padding="md" onClick={onClick} title={hint} className={className}>
				{body}
			</SurfaceButton>
		);
	}
	return (
		<Surface tier={inset ? "inset" : "panel"} tone={tone} padding={inset ? "sm" : "md"} className={className}>
			{body}
		</Surface>
	);
}

/**
 * A row of stats. Owns the grid so no page picks its own column count — the
 * dashboard alone used to run four different breakpoint schemes and three gaps.
 */
export function StatRow({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3", className)}>{children}</div>
	);
}
