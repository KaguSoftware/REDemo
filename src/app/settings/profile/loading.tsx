import { RouteLoading, DetailSkeleton } from "@/src/components/ui";

export default function Loading() {
	return (
		<RouteLoading title="Profiliniz" width="narrow">
			<DetailSkeleton />
		</RouteLoading>
	);
}
