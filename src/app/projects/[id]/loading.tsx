import { RouteLoading, DetailSkeleton } from "@/src/components/ui";

export default function Loading() {
	return (
		<RouteLoading title="Proje">
			<DetailSkeleton />
		</RouteLoading>
	);
}
