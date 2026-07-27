import { RouteLoading, DetailSkeleton } from "@/src/components/ui";

// The real page titles itself with the team name, which is unknown here; "Ekip"
// is the same fallback that page uses before `team` resolves.
export default function Loading() {
	return (
		<RouteLoading title="Ekip" subtitle="Ekip ve davetler">
			<DetailSkeleton />
		</RouteLoading>
	);
}
