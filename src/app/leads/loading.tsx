import { RouteLoading, TableSkeleton } from "@/src/components/ui";

export default function Loading() {
	return (
		<RouteLoading title="Müşteriler" subtitle="Müşteriler, kiracılar, alıcılar ve kefiller" width="7xl">
			<TableSkeleton rows={7} columns={["w-32", "w-28", "w-40", "w-20", "w-16"]} label="Kişiler yükleniyor" />
		</RouteLoading>
	);
}
