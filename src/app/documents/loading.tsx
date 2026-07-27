import { RouteLoading, TableSkeleton } from "@/src/components/ui";

export default function Loading() {
	return (
		<RouteLoading title="Belgeler" subtitle="Oluşturulan sözleşmeler ve belgeler" width="7xl">
			<TableSkeleton rows={6} columns={["w-44", "w-28", "w-24", "w-20", "w-16"]} label="Belgeler yükleniyor" />
		</RouteLoading>
	);
}
