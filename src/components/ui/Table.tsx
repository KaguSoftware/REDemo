"use client";

import React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "./cn";

/**
 * Table parts, not a table component.
 *
 * The four tables in this app (properties, contacts, documents, admin) have
 * genuinely different columns, selection models and row actions, so a single
 * generic <Table data={}/> would fight all four. What they should share is the
 * things they were each getting wrong separately: row height, header treatment,
 * and sort semantics.
 *
 * THE DENSITY CONTRACT. This pass is "calm and spacious" at page and section
 * scale — but a rent table is scanned forty rows at a time, and there density
 * IS legibility. Row height comes from --spacing-row / --spacing-row-media in
 * globals.css, the same tokens TableSkeleton uses, so the two cannot drift.
 */

/** Table header row. base-200 is the recessed tone now, so a header is sunk, not tinted. */
export function Thead({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<thead className={cn("bg-base-200 border-b border-base-300", className)}>
			{children}
		</thead>
	);
}

export type SortDirection = "asc" | "desc";

/**
 * A sortable column header.
 *
 * Sort state used to be communicated by appending a literal "↑"/"↓" character
 * to the header's text — which meant the accessible name of the column changed
 * as you sorted it, no `aria-sort` was ever emitted, and a screen reader user
 * had no way to know the table was sorted at all. The glyph is now an icon
 * marked aria-hidden, and the state is announced by `aria-sort` where assistive
 * technology actually looks for it.
 */
export function SortableTh({
	active,
	direction,
	onSort,
	children,
	className,
	align = "left",
}: {
	active: boolean;
	direction: SortDirection;
	onSort: () => void;
	children: React.ReactNode;
	className?: string;
	align?: "left" | "right";
}) {
	const Icon = !active ? ChevronsUpDown : direction === "asc" ? ChevronUp : ChevronDown;
	return (
		<th
			scope="col"
			aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
			className={cn("px-4 py-2.5", align === "right" ? "text-right" : "text-left", className)}
		>
			<button
				type="button"
				onClick={onSort}
				className={cn(
					"inline-flex items-center gap-1 text-label font-semibold select-none",
					"transition-colors duration-150 rounded-field",
					"focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25",
					align === "right" && "flex-row-reverse",
					active ? "text-base-content" : "text-base-content/50 hover:text-base-content/80",
				)}
			>
				{children}
				<Icon aria-hidden className={cn("w-3.5 h-3.5 shrink-0", !active && "opacity-50")} />
			</button>
		</th>
	);
}

/** A non-sortable column header, matching SortableTh's metrics exactly. */
export function Th({
	children,
	className,
	align = "left",
}: {
	children: React.ReactNode;
	className?: string;
	align?: "left" | "right";
}) {
	return (
		<th
			scope="col"
			className={cn(
				"px-4 py-2.5 text-label font-semibold text-base-content/50",
				align === "right" ? "text-right" : "text-left",
				className,
			)}
		>
			{children}
		</th>
	);
}

/**
 * A data row at the shared density. `media` reserves the taller height for rows
 * carrying a thumbnail — the same distinction TableSkeleton makes.
 */
export function Tr({
	media,
	interactive = true,
	className,
	children,
	...rest
}: React.HTMLAttributes<HTMLTableRowElement> & { media?: boolean; interactive?: boolean }) {
	return (
		<tr
			className={cn(
				media ? "h-row-media" : "h-row",
				"border-b border-base-300 last:border-0",
				interactive && "hover:bg-base-200/60 transition-colors duration-150 cursor-pointer",
				className,
			)}
			{...rest}
		>
			{children}
		</tr>
	);
}

/** A data cell. Body size, normal weight — emphasis is spent on headings and numerals. */
export function Td({
	numeric,
	className,
	children,
	...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
	return (
		<td
			className={cn(
				"px-4 text-body text-base-content",
				numeric && "font-numeric text-right whitespace-nowrap",
				className,
			)}
			{...rest}
		>
			{children}
		</td>
	);
}
