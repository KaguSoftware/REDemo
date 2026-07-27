import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/src/lib/supabase/server";
import { ProjectDashboard } from "@/src/components/projects/ProjectDashboard";
import Loading from "./loading";
import { ServerSeed } from "@/src/components/auth/ServerSeed";

export default async function ProjectsPage() {
	// Server-side guard: unauthenticated visitors land on the home page instead
	// of an empty client-rendered shell. Data itself remains RLS-protected.
	const supabase = await createClient();
	const userId = await getUserId(supabase);
	if (!userId) redirect("/");

	// ProjectDashboard reads ?new= via useSearchParams, which requires a Suspense
	// boundary so the route can still be prerendered.
	return (
		<ServerSeed>
			<Suspense fallback={<Loading />}>
				<ProjectDashboard />
			</Suspense>
		</ServerSeed>
	);
}
