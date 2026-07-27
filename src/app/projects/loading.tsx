import { RouteLoading, CardListSkeleton } from "@/src/components/ui";

export default function Loading() {
	return (
		<RouteLoading title="Projeler">
			<CardListSkeleton cards={6} label="Projeler yükleniyor" />
		</RouteLoading>
	);
}
