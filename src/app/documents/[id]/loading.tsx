import { RouteLoading, DetailSkeleton } from "@/src/components/ui";

export default function Loading() {
	return (
		<RouteLoading title="Sözleşme" subtitle="Belgeyi düzenleyin veya PDF indirin" width="5xl">
			<DetailSkeleton />
		</RouteLoading>
	);
}
