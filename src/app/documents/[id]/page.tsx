import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/src/lib/supabase/server";
import { DocumentEditorPage } from "@/src/components/documents/DocumentEditorPage";
import { AppShell } from "@/src/components/ui";
import { ServerSeed } from "@/src/components/auth/ServerSeed";

export default async function DocumentPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const supabase = await createClient();
	const userId = await getUserId(supabase);
	if (!userId) redirect("/");

	const { id } = await params;

	return (
		<ServerSeed>
			<AppShell title="Sözleşme" subtitle="Belgeyi düzenleyin veya PDF indirin" width="5xl">
				<DocumentEditorPage documentId={id} />
			</AppShell>
		</ServerSeed>
	);
}
