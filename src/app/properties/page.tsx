import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/src/lib/supabase/server";
import { PropertyDashboard } from "@/src/components/properties/PropertyDashboard";
import Loading from "./loading";
import { ServerSeed } from "@/src/components/auth/ServerSeed";

export default async function PropertiesPage() {
	// Server-side guard: unauthenticated visitors land on the home dashboard.
	const supabase = await createClient();
	const userId = await getUserId(supabase);
	if (!userId) redirect("/");

	// PropertyDashboard reads filter params via useSearchParams, which requires
	// a Suspense boundary so the route can still be prerendered.
	// The fallback keeps the AppShell chrome; `null` blanked the whole page.
	return (
		<ServerSeed>
			<Suspense fallback={<Loading />}>
				<PropertyDashboard />
			</Suspense>
		</ServerSeed>
	);
}
