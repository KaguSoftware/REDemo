"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
	useAppStore,
	type FurnishedFilter,
	type NewBuildFilter,
	type CitizenshipFilter,
	type InsuranceFilter,
} from "@/src/store";
import { Input, Dropdown, Button, Sheet, FormField, MultiSelect, NumberInput, Surface, cn, type DropdownOption } from "@/src/components/ui";
import type { ListingType, PropertyStatus } from "@/src/lib/db/types";
import { SlidersHorizontal, Search, Plus } from "lucide-react";

const FURNISHED_OPTIONS: DropdownOption<FurnishedFilter>[] = [
	{ value: "all", label: "Tümü" },
	{ value: "yes", label: "Eşyalı" },
	{ value: "no", label: "Eşyasız" },
];

const LISTING_TYPE_OPTIONS: DropdownOption<ListingType | "all">[] = [
	{ value: "all", label: "Tüm ilanlar" },
	{ value: "for_rent", label: "Kiralık" },
	{ value: "for_sale", label: "Satılık" },
];

const STATUS_OPTIONS: DropdownOption<PropertyStatus | "all">[] = [
	{ value: "all", label: "Tüm durumlar" },
	{ value: "vacant", label: "Boş" },
	{ value: "occupied", label: "Kirada" },
	{ value: "sold", label: "Satıldı" },
];

const NEW_BUILD_OPTIONS: DropdownOption<NewBuildFilter>[] = [
	{ value: "all", label: "Tümü" },
	{ value: "yes", label: "Sıfır" },
	{ value: "no", label: "İkinci el" },
];

const CITIZENSHIP_OPTIONS: DropdownOption<CitizenshipFilter>[] = [
	{ value: "all", label: "Tümü" },
	{ value: "yes", label: "Uygun" },
	{ value: "no", label: "Uygun değil" },
];

// "DASK yok" deliberately excludes properties whose DASK has merely LAPSED —
// those need a renewal, not a new policy, and they show up under "Yakında
// bitiyor" instead.
const INSURANCE_OPTIONS: DropdownOption<InsuranceFilter>[] = [
	{ value: "all", label: "Tümü" },
	{ value: "dask_missing", label: "DASK yok" },
	{ value: "dask_valid", label: "DASK geçerli" },
	{ value: "expiring", label: "Yakında bitiyor" },
];

// Rentals are quoted in TRY, sales commonly in USD. Prices are never
// FX-converted, so a budget range always applies to exactly one currency.
const CURRENCY_OPTIONS: DropdownOption<string>[] = [
	{ value: "TRY", label: "₺ TRY" },
	{ value: "USD", label: "$ USD" },
	{ value: "EUR", label: "€ EUR" },
];

export function PropertyFilters() {
	const router = useRouter();
	const filters = useAppStore((s) => s.filters);
	const properties = useAppStore((s) => s.allProperties);
	const setFilter = useAppStore((s) => s.setFilter);
	const resetFilters = useAppStore((s) => s.resetFilters);

	// Local input state so we can debounce the text writes into the store.
	const [q, setQ] = useState(filters.q);
	const [sheetOpen, setSheetOpen] = useState(false);

	// Keep local input in sync when filters are set externally
	// (e.g. a lead's "Find matches" pre-fills them before navigation).
	useEffect(() => { setQ(filters.q); }, [filters.q]);

	// The 250ms debounce that used to live here existed only to avoid a network
	// round-trip per keystroke. Filtering is now client-side (clientFilters.ts),
	// so the store is written immediately and the table narrows as you type.
	useEffect(() => {
		if (q !== filters.q) setFilter("q", q);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [q]);

	// Dropdown options derived from the properties currently loaded — the list
	// self-populates and grows as more properties are added.
	const typeOptions = useMemo(
		() => uniqueSorted(properties.map((p) => p.nitelik)),
		[properties],
	);
	const locationOptions = useMemo(
		() => uniqueSorted(properties.flatMap((p) => [p.mahalle, p.mevkii, p.city])),
		[properties],
	);

	const hasBudget = filters.min_price != null || filters.max_price != null;

	const activeCount =
		(filters.listing_type !== "all" ? 1 : 0) +
		(filters.status !== "all" ? 1 : 0) +
		(filters.nitelik.length > 0 ? 1 : 0) +
		(filters.furnished !== "all" ? 1 : 0) +
		(filters.location.length > 0 ? 1 : 0) +
		(filters.new_build !== "all" ? 1 : 0) +
		(filters.citizenship !== "all" ? 1 : 0) +
		(filters.insurance !== "all" ? 1 : 0) +
		// A budget range counts once regardless of how many bounds are set.
		(hasBudget ? 1 : 0);
	const hasActiveFilter = activeCount > 0 || filters.q !== "";

	function clearAll() {
		setQ(""); resetFilters();
	}

	// The secondary controls — reused inline on desktop and inside the sheet on mobile.
	const controls = (stacked: boolean) => (
		<div className={cn(stacked ? "space-y-4" : "contents")}>
			<FieldWrap stacked={stacked} label="Nitelik">
				<MultiSelect
					label="Tüm nitelikler"
					options={typeOptions}
					selected={filters.nitelik}
					onChange={(next) => setFilter("nitelik", next)}
					className={stacked ? "" : "sm:w-36"}
				/>
			</FieldWrap>
			<FieldWrap stacked={stacked} label="Konum / site">
				<MultiSelect
					label="Tüm konumlar"
					options={locationOptions}
					selected={filters.location}
					onChange={(next) => setFilter("location", next)}
					className={stacked ? "" : "sm:w-48"}
				/>
			</FieldWrap>
			<FieldWrap stacked={stacked} label="Eşya durumu">
				<Dropdown
					options={FURNISHED_OPTIONS}
					value={filters.furnished}
					onChange={(v) => setFilter("furnished", v)}
					className={stacked ? "" : "sm:w-auto"}
				/>
			</FieldWrap>
			<FieldWrap stacked={stacked} label="İlan">
				<Dropdown options={LISTING_TYPE_OPTIONS}
					value={filters.listing_type}
					onChange={(v) => setFilter("listing_type", v)}
					className={stacked ? "" : "sm:w-auto"} />
			</FieldWrap>
			<FieldWrap stacked={stacked} label="Durum">
				<Dropdown options={STATUS_OPTIONS}
					value={filters.status}
					onChange={(v) => setFilter("status", v)}
					className={stacked ? "" : "sm:w-auto"} />
			</FieldWrap>
			<FieldWrap stacked={stacked} label="Yapı durumu">
				<Dropdown options={NEW_BUILD_OPTIONS}
					value={filters.new_build}
					onChange={(v) => setFilter("new_build", v)}
					className={stacked ? "" : "sm:w-auto"} />
			</FieldWrap>
			<FieldWrap stacked={stacked} label="Sigorta">
				<Dropdown options={INSURANCE_OPTIONS}
					value={filters.insurance}
					onChange={(v) => setFilter("insurance", v)}
					className={stacked ? "" : "sm:w-auto"} />
			</FieldWrap>
			<FieldWrap stacked={stacked} label="Vatandaşlık">
				<Dropdown options={CITIZENSHIP_OPTIONS}
					value={filters.citizenship}
					onChange={(v) => setFilter("citizenship", v)}
					className={stacked ? "" : "sm:w-auto"} />
			</FieldWrap>
			<FieldWrap stacked={stacked} label="Bütçe">
				{/* Kept as one unit so the range reads as a range. shrink-0 stops the
				    pair from being squeezed below legibility when the row wraps. */}
				<div className={cn("flex flex-wrap items-center gap-2", !stacked && "shrink-0")}>
					<NumberInput
						mode="decimal"
						format="money"
						min={0}
						value={filters.min_price}
						onChange={(v) => setFilter("min_price", v)}
						placeholder="En az"
						aria-label="En az fiyat"
						className={stacked ? "flex-1 min-w-28" : "sm:w-28"}
					/>
					<span className="text-base-content/40 shrink-0" aria-hidden>–</span>
					<NumberInput
						mode="decimal"
						format="money"
						min={0}
						value={filters.max_price}
						onChange={(v) => setFilter("max_price", v)}
						placeholder="En çok"
						aria-label="En çok fiyat"
						className={stacked ? "flex-1 min-w-28" : "sm:w-28"}
					/>
					{/* Currency is meaningless without a bound, so it stays out of the
					    row until one is set — the filter bar is already dense. */}
					{hasBudget && (
						<Dropdown
							options={CURRENCY_OPTIONS}
							value={filters.currency}
							onChange={(v) => setFilter("currency", v)}
							className="shrink-0 basis-32"
							aria-label="Para birimi"
						/>
					)}
				</div>
			</FieldWrap>
		</div>
	);

	return (
		<div className="mb-4">
			{/* Always-visible search + (mobile) Filters trigger */}
			<div className="flex gap-2 items-center">
				<div className="relative flex-1 min-w-0">
					<Search className="w-4 h-4 text-base-content/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
					<Input
						placeholder="Mülk sahibi, adres veya şehir ara…"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						className="pl-9"
					/>
				</div>

				{/* Mobile: open the filters sheet */}
				<Button
					variant="outline"
					size="md"
					onClick={() => setSheetOpen(true)}
					className="sm:hidden relative shrink-0"
					aria-label="Filtreler"
				>
					<SlidersHorizontal className="w-4 h-4" />
					{activeCount > 0 && (
						<span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-content text-xs font-bold flex items-center justify-center">
							{activeCount}
						</span>
					)}
				</Button>
			</div>

			{/* Desktop: inline filter row.
			    Given a container at last — this was the densest region in the app
			    and the only major one sitting bare on the page, which is part of
			    why nine controls in a wrapping flex read as clutter rather than as
			    a panel of controls. `items-end` so the controls line up along their
			    baselines now that each carries a label above it. */}
			<Surface padding="md" className="hidden sm:block mt-4">
				<div className="flex flex-wrap gap-x-3 gap-y-3 items-end">
					{controls(false)}
					{hasActiveFilter && (
						<Button variant="ghost" size="sm" onClick={clearAll}>Temizle</Button>
					)}
					<Button size="sm" onClick={() => router.push("/properties/new")} className="ml-auto shrink-0">
						<Plus className="w-4 h-4" />
						Taşınmaz ekle
					</Button>
				</div>
			</Surface>

			{/* Mobile: filters sheet */}
			<Sheet
				open={sheetOpen}
				onClose={() => setSheetOpen(false)}
				title="Filtreler"
				footer={
					<div className="flex gap-2">
						<Button variant="ghost" block onClick={clearAll}>Tümünü temizle</Button>
						<Button block onClick={() => setSheetOpen(false)}>Sonuçları göster</Button>
					</div>
				}
			>
				{controls(true)}
			</Sheet>
		</div>
	);
}

/** Distinct, trimmed, sorted non-empty values from a list that may contain nulls. */
function uniqueSorted(values: (string | null | undefined)[]): string[] {
	const set = new Set<string>();
	for (const v of values) {
		const t = v?.trim();
		if (t) set.add(t);
	}
	return [...set].sort((a, b) => a.localeCompare(b));
}

/** On mobile (stacked) wrap each control in a labeled FormField; inline on desktop render bare. */
/**
 * Every filter carries its label on BOTH layouts.
 *
 * The mobile sheet always had proper FormField labels; the desktop row rendered
 * the same nine controls bare — the densest region in the app, and the only one
 * where you had to open each dropdown to find out what it filtered. `w-auto`
 * because here the field is a flex item in a wrapping row, not a form row.
 */
function FieldWrap({ stacked, label, children }: { stacked: boolean; label: string; children: React.ReactNode }) {
	return (
		<FormField label={label} className={stacked ? undefined : "w-auto"}>
			{children}
		</FormField>
	);
}
