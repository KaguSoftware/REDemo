"use client";

import React from "react";
import { cn } from "./cn";

/**
 * Segmented control. The app had five hand-rolled versions of this — in
 * ContactDashboard, AuthModal, TeamSizeCard, onboarding and the billing page —
 * each with its own padding, radius and active treatment, and only one of them
 * carried `role="tablist"`.
 *
 * The active segment reads as raised against a recessed track: base-100 on a
 * base-200 well. It used to add `shadow-soft` for the same effect, which is the
 * elevation rule broken at 2px — a segment does not float, it is simply the one
 * that is not sunk.
 */
export interface TabOption<T extends string> {
	value: T;
	label: React.ReactNode;
	/** Optional trailing count, rendered quieter than the label. */
	count?: number;
}

export function Tabs<T extends string>({
	options,
	value,
	onChange,
	label,
	className,
	size = "md",
}: {
	options: readonly TabOption<T>[];
	value: T;
	onChange: (value: T) => void;
	/** Accessible name for the group — required, this is a real tablist. */
	label: string;
	className?: string;
	size?: "sm" | "md";
}) {
	return (
		<div
			role="tablist"
			aria-label={label}
			className={cn("inline-flex rounded-field bg-base-200 p-0.5", className)}
		>
			{options.map((o) => {
				const active = o.value === value;
				return (
					<button
						key={o.value}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(o.value)}
						className={cn(
							"inline-flex items-center justify-center gap-1.5 rounded-field font-semibold",
							"transition-colors duration-150",
							"focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25",
							size === "sm" ? "h-8 px-3 text-label" : "h-9 px-3.5 text-body",
							active
								? "bg-base-100 text-base-content"
								: "text-base-content/60 hover:text-base-content",
						)}
					>
						{o.label}
						{o.count != null && (
							<span className={cn("font-numeric text-micro", active ? "text-base-content/50" : "text-base-content/40")}>
								{o.count}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
