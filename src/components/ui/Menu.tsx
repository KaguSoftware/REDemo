"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "./cn";

/**
 * Popover menu — trigger, panel, items.
 *
 * The app had three of these written by hand (AccountMenu, AddMenu, and a third
 * inline in ContactDashboard), each re-implementing outside-click and each
 * copy-pasting the same item class-string verbatim. Only some of them closed on
 * Escape, and none returned focus to the trigger on close, so a keyboard user
 * who dismissed a menu was dropped at the top of the document.
 *
 * A menu is a `raised` surface — it genuinely floats over the content it covers,
 * which is one of the few places a shadow is earned.
 */
export function Menu({
	trigger,
	children,
	label,
	align = "right",
	width = "w-48",
	className,
}: {
	/** Render-prop so the caller keeps full control of its own button styling. */
	trigger: (props: {
		onClick: () => void;
		"aria-haspopup": "menu";
		"aria-expanded": boolean;
		ref: React.Ref<HTMLButtonElement>;
	}) => React.ReactNode;
	children: React.ReactNode | ((close: () => void) => React.ReactNode);
	label: string;
	align?: "left" | "right";
	width?: string;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);

	// Deliberately touches no ref, because it is handed to children and
	// react-hooks/refs correctly forbids a render-created closure from reading
	// one. It does not need to: a child closing the menu by activating an item
	// has already moved focus itself.
	const close = useCallback(() => setOpen(false), []);

	useEffect(() => {
		if (!open) return;
		function onPointerDown(e: MouseEvent | TouchEvent) {
			// A click outside dismisses without pulling focus back — the pointer
			// has already taken the user's attention elsewhere.
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		}
		function onKeyDown(e: KeyboardEvent) {
			if (e.key !== "Escape") return;
			e.stopPropagation();
			setOpen(false);
			// Only the keyboard dismissal returns focus, and it is the one path
			// that needs to: without this a keyboard user who pressed Escape was
			// dropped at the top of the document. Every hand-rolled copy of this
			// menu omitted it. Reading the ref is legal here — this closure is
			// created inside an effect, not during render.
			triggerRef.current?.focus();
		}
		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("touchstart", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("touchstart", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	return (
		<div ref={rootRef} className={cn("relative", className)}>
			{trigger({
				onClick: () => setOpen((o) => !o),
				"aria-haspopup": "menu",
				"aria-expanded": open,
				ref: triggerRef,
			})}
			{open && (
				<div
					role="menu"
					aria-label={label}
					className={cn(
						"absolute z-40 mt-1.5 rounded-box border border-base-300 bg-base-100 shadow-pop p-1 animate-dropdown-in",
						align === "right" ? "right-0" : "left-0",
						width,
					)}
				>
					{typeof children === "function" ? children(close) : children}
				</div>
			)}
		</div>
	);
}

/** A menu row. The one class-string all three hand-rolled menus duplicated. */
export function MenuItem({
	icon: Icon,
	tone = "neutral",
	className,
	children,
	...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
	icon?: React.ComponentType<{ className?: string }>;
	tone?: "neutral" | "error";
}) {
	return (
		<button
			type="button"
			role="menuitem"
			className={cn(
				"w-full flex items-center gap-3 px-3 py-2.5 rounded-field text-body font-medium text-left",
				"transition-colors duration-150",
				"focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25",
				tone === "error"
					? "text-error hover:bg-error/10"
					: "text-base-content/80 hover:bg-base-200 hover:text-base-content",
				className,
			)}
			{...rest}
		>
			{Icon && <Icon className={cn("w-4 h-4 shrink-0", tone === "error" ? "" : "text-base-content/60")} />}
			{children}
		</button>
	);
}
