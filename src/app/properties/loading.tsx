import { RouteLoading, TableSkeleton } from "@/src/components/ui";

// Title/subtitle/width must match PropertyDashboard's own AppShell, or the
// header text changes when the page mounts.
export default function Loading() {
	return (
		<RouteLoading title="Portföy" subtitle="İlanlar, kiracılar ve sözleşmeler" width="7xl">
			<TableSkeleton rows={8} thumb columns={["w-28", "w-56", "w-10", "w-16", "w-16", "w-20", "w-16"]} label="Portföy yükleniyor" />
		</RouteLoading>
	);
}
