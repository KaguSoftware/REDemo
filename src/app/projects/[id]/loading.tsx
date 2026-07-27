import { RouteLoading, DetailSkeleton } from "@/src/components/ui";

export default function Loading() {
	return (
		<RouteLoading subtitle={false}>
			<DetailSkeleton />
		</RouteLoading>
	);
}
