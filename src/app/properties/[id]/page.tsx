import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/src/lib/supabase/server";
import { PropertyDetail } from "@/src/components/properties/PropertyDetail";
import { ServerSeed } from "@/src/components/auth/ServerSeed";

export default async function PropertyDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const supabase = await createClient();
	const userId = await getUserId(supabase);
	if (!userId) redirect("/");

	const { id } = await params;

	// PropertyDetail renders its own AppShell (top bar + drawer).
	return <ServerSeed><PropertyDetail propertyId={id} /></ServerSeed>;
}
