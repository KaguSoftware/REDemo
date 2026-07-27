"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, useTeamReady } from "@/src/store";
import { listProperties } from "@/src/lib/db/properties";
import { filterProperties, type PropertyClientFilter } from "@/src/lib/clientFilters";
import type { PropertyWithInsurance } from "@/src/lib/db/types";
import { INSURANCE_WARN_DAYS, isoDaysFrom } from "@/src/lib/insurance";
import { useCachedResource } from "@/src/lib/useCachedResource";
import { AppShell, Card, Alert, Button } from "@/src/components/ui";
import { PropertyFilters } from "./PropertyFilters";
import { PropertyTable } from "./PropertyTable";
import { PropertyMap } from "./PropertyMap";
import { MatchingProjects } from "@/src/components/projects/MatchingProjects";
import { Plus } from "lucide-react";

/** Serialize non-default filter values so views are shareable/bookmarkable. */
function filtersToParams(filters: {
	listing_type: string; status: string; q: string;
	nitelik: string[]; furnished: string; location: string[];
	min_price: number | null; max_price: number | null; currency: string;
	new_build: string; citizenship: string; insurance: string;
}): string {
	const p = new URLSearchParams();
	if (filters.listing_type !== "all") p.set("type", filters.listing_type);
	if (filters.status !== "all") p.set("status", filters.status);
	if (filters.furnished !== "all") p.set("furnished", filters.furnished);
	if (filters.q) p.set("q", filters.q);
	if (filters.nitelik.length) p.set("nitelik", filters.nitelik.join(","));
	if (filters.location.length) p.set("loc", filters.location.join(","));
	if (filters.new_build !== "all") p.set("new", filters.new_build);
	if (filters.citizenship !== "all") p.set("vat", filters.citizenship);
	if (filters.insurance !== "all") p.set("sigorta", filters.insurance);
	if (filters.min_price != null) p.set("min", String(filters.min_price));
	if (filters.max_price != null) p.set("max", String(filters.max_price));
	// Only meaningful alongside a bound, so don't clutter the URL otherwise.
	if ((filters.min_price != null || filters.max_price != null) && filters.currency !== "TRY") {
		p.set("cur", filters.currency);
	}
	return p.toString();
}

/** Parse a URL price bound; ignores blanks and anything non-numeric. */
function parsePriceParam(raw: string | null): number | null {
	if (!raw) return null;
	const n = Number(raw);
	return Number.isFinite(n) && n >= 0 ? n : null;
}

export function PropertyDashboard() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const user = useAppStore((s) => s.user);
	const teamReady = useTeamReady();
	const filters = useAppStore((s) => s.filters);
	const setFilters = useAppStore((s) => s.setFilters);
	const setProperties = useAppStore((s) => s.setProperties);
	const setAllProperties = useAppStore((s) => s.setAllProperties);

	// One-time hydration: an arriving URL with filter params wins over the store,
	// so shared/bookmarked links reproduce the same view. Afterwards the store is
	// the source of truth and is mirrored back into the URL below.
	const hydrated = useRef(false);
	useEffect(() => {
		if (hydrated.current) return;
		hydrated.current = true;
		const type = searchParams.get("type");
		const status = searchParams.get("status");
		const furnished = searchParams.get("furnished");
		const q = searchParams.get("q");
		const nitelik = searchParams.get("nitelik");
		const loc = searchParams.get("loc");
		const min = searchParams.get("min");
		const max = searchParams.get("max");
		const cur = searchParams.get("cur");
		const newBuild = searchParams.get("new");
		const vat = searchParams.get("vat");
		const sigorta = searchParams.get("sigorta");
		if (
			!type && !status && !furnished && !q && !nitelik && !loc && !min && !max &&
			!newBuild && !vat && !sigorta
		) return;
		const min_price = parsePriceParam(min);
		const max_price = parsePriceParam(max);
		setFilters({
			...(type === "for_rent" || type === "for_sale" ? { listing_type: type } : {}),
			...(status === "vacant" || status === "occupied" || status === "sold" ? { status } : {}),
			...(furnished === "yes" || furnished === "no" ? { furnished } : {}),
			...(q ? { q } : {}),
			...(nitelik ? { nitelik: nitelik.split(",").filter(Boolean) } : {}),
			...(loc ? { location: loc.split(",").filter(Boolean) } : {}),
			...(min_price != null ? { min_price } : {}),
			...(max_price != null ? { max_price } : {}),
			...(cur && cur.length === 3 ? { currency: cur.toUpperCase() } : {}),
			...(newBuild === "yes" || newBuild === "no" ? { new_build: newBuild } : {}),
			...(vat === "yes" || vat === "no" ? { citizenship: vat } : {}),
			...(sigorta === "dask_valid" || sigorta === "dask_missing" || sigorta === "expiring"
				? { insurance: sigorta }
				: {}),
		});
	}, [searchParams, setFilters]);

	// Mirror filter changes into the URL (replace, so history isn't spammed).
	useEffect(() => {
		if (!hydrated.current) return;
		const qs = filtersToParams(filters);
		const current = searchParams.toString();
		if (qs !== current) router.replace(qs ? `/properties?${qs}` : "/properties", { scroll: false });
	}, [filters, router, searchParams]);

	// Filtering happens IN THE BROWSER, not on the server.
	//
	// This used to fold every filter value into the SWR cache key, so each
	// dropdown pick — and each debounced keystroke in the search box — minted a
	// new key and paid a fresh ~330ms round-trip to show rows the client already
	// had. The whole team's portfolio is hundreds of rows, so it is fetched once
	// under ONE stable key and narrowed locally at zero network cost. Filtering
	// is now instant and works offline over the cached list.
	//
	// The predicate in filterProperties() mirrors listProperties()'s WHERE clause
	// and is unit-tested against it (clientFilters.test.ts) — if the server
	// query changes, change both.
	// "Today" is read ONCE per mount rather than per render: the insurance
	// predicate compares dates against it, and a value that changed every render
	// would rebuild clientFilter and re-filter the whole list each pass. A tab
	// left open across midnight keeps yesterday's date until the next navigation,
	// which is the right trade for a 30-day warning window.
	const [todayISO] = useState(() => new Date().toISOString().slice(0, 10));

	const cacheKey = user && teamReady ? "properties:all" : null;

	const { data: allProperties, loading, error, refetch } = useCachedResource(
		cacheKey,
		() => listProperties({}),
		undefined,
		{ enabled: !!user && teamReady },
	);

	const clientFilter: PropertyClientFilter = useMemo(() => ({
		listing_type: filters.listing_type === "all" ? undefined : filters.listing_type,
		status: filters.status === "all" ? undefined : filters.status,
		q: filters.q || undefined,
		nitelik: filters.nitelik.length ? filters.nitelik : undefined,
		furnished: filters.furnished === "all" ? undefined : filters.furnished === "yes",
		location: filters.location.length ? filters.location : undefined,
		min_price: filters.min_price ?? undefined,
		max_price: filters.max_price ?? undefined,
		// Scope the range to one currency; without a bound it would needlessly
		// exclude properties priced in other currencies.
		currency:
			filters.min_price != null || filters.max_price != null ? filters.currency : undefined,
		is_new_build: filters.new_build === "all" ? undefined : filters.new_build === "yes",
		citizenship_eligible:
			filters.citizenship === "all" ? undefined : filters.citizenship === "yes",
		insurance: filters.insurance === "all" ? undefined : filters.insurance,
		todayISO,
		insuranceHorizonISO: isoDaysFrom(todayISO, INSURANCE_WARN_DAYS),
	}), [filters, todayISO]);

	const visible = useMemo(
		() => (allProperties ? filterProperties(allProperties, clientFilter) : null),
		[allProperties, clientFilter],
	);

	// Publish the filtered view to the store, which is what PropertyTable and the
	// map read.
	//
	// Adjusted DURING RENDER rather than in an effect: an effect would let React
	// commit and paint the previous filter's rows first, so every filter change
	// would flash stale results for a frame. Comparing state to the value we just
	// derived lets React throw the stale pass away before it reaches the screen —
	// the same pattern useCachedResource uses, and what `react-hooks/
	// set-state-in-effect` is pointing at when it flags the effect version.
	const [publishedRows, setPublishedRows] = useState<PropertyWithInsurance[] | null>(null);
	if (visible && publishedRows !== visible) {
		setPublishedRows(visible);
		setProperties(visible);
	}

	// The filter bar builds its dropdown options from the UNFILTERED list, so
	// choosing "Mesken" doesn't erase every other nitelik from the menu.
	const [publishedAll, setPublishedAll] = useState<PropertyWithInsurance[] | null>(null);
	if (allProperties && publishedAll !== allProperties) {
		setPublishedAll(allProperties);
		setAllProperties(allProperties);
	}

	return (
		<AppShell
			title="Portföy"
			subtitle="İlanlar, kiracılar ve sözleşmeler"
			width="7xl"
		>
			{!user ? (
				<Card className="p-10 text-center">
					<p className="text-sm text-base-content/70">Portföyünüzü yönetmek için giriş yapın.</p>
					<p className="text-xs text-base-content/50 mt-1">Üst çubuktaki Giriş yap düğmesini kullanın.</p>
				</Card>
			) : (
				<>
					<PropertyMap />
					<PropertyFilters />

					{/* Projects whose entry price fits the active budget. Renders
					    nothing when no budget is set or nothing matches. */}
					<MatchingProjects
						minPrice={filters.min_price}
						maxPrice={filters.max_price}
						currency={filters.currency}
					/>

					{error && (
						<Alert
							className="mb-4"
							action={<Button size="sm" variant="outline" onClick={refetch}>Tekrar dene</Button>}
						>
							Portföy yüklenemedi: {error}
						</Alert>
					)}

					<PropertyTable isLoading={loading} />

					{/* Mobile FAB — thumb-reachable primary action. */}
					<button
						onClick={() => router.push("/properties/new")}
						aria-label="Taşınmaz ekle"
						className="sm:hidden fixed right-4 bottom-4 z-20 h-14 w-14 rounded-full bg-primary text-primary-content shadow-pop flex items-center justify-center active:brightness-95 safe-bottom"
					>
						<Plus className="w-6 h-6" />
					</button>
				</>
			)}
		</AppShell>
	);
}
