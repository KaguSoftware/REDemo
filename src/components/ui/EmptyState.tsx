import React from "react";
import { Surface } from "./Surface";
import { cn } from "./cn";

/**
 * Consistent empty state — icon, heading, hint, optional action.
 *
 * `inset` renders it as a recessed dashed region, which is what four places in
 * the document wizards were hand-rolling as
 * `text-center py-12 bg-base-200 rounded-2xl border border-dashed border-base-300`
 * rather than using this component. They were not wrong to want that look —
 * inside a wizard step an empty slot should read as a space waiting to be
 * filled, not as a panel — so the variant lives here instead of the copies
 * living out there.
 */
export function EmptyState({
	icon: Icon,
	title,
	hint,
	action,
	inset = false,
	className,
}: {
	icon?: React.ComponentType<{ className?: string }>;
	title: string;
	hint?: string;
	action?: React.ReactNode;
	/** Recessed, dashed — an empty slot inside a larger flow. */
	inset?: boolean;
	className?: string;
}) {
	const body = (
		<div className="flex flex-col items-center justify-center text-center">
			{Icon && <Icon className="w-7 h-7 text-primary/60 mb-3" />}
			<p className="font-display text-subtitle font-semibold text-base-content/90">{title}</p>
			{hint && <p className="text-body text-base-content/60 mt-1.5 max-w-[38ch]">{hint}</p>}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);

	if (inset) {
		return (
			<Surface tier="inset" padding="none" className={cn("border border-dashed border-base-300 px-6 py-12", className)}>
				{body}
			</Surface>
		);
	}
	return <div className={cn("px-6 py-10", className)}>{body}</div>;
}
