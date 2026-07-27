import { getServerAppContext } from "@/src/lib/auth/serverContext";
import { StoreHydrator } from "./StoreHydrator";
import { TrialBanner } from "@/src/components/billing/TrialBanner";

/**
 * Wrap an authenticated page's content in this. It resolves the user and team on
 * the server and seeds the client store before the first paint, so the app shell
 * never renders its signed-OUT state (no sidebar, content 256px off, a
 * "Giriş yap" button) and dashboard fetches are not blocked behind two client
 * round-trips. See src/lib/auth/serverContext.ts for the full reasoning.
 *
 * Why per-page rather than in the root layout: the root layout wraps public
 * routes too, and one `cookies()` read there opts the whole app out of static
 * rendering — measured, it cost the three legal pages and /signup their
 * prerendering. Every authenticated page already reads the session for its own
 * redirect guard, and `getServerAppContext` is `cache()`d, so here it is free.
 *
 * It also renders TrialBanner, which only ever has something to say to a
 * signed-in user with a team.
 */
export async function ServerSeed({ children }: { children: React.ReactNode }) {
	const { user, team, serverNow } = await getServerAppContext();

	return (
		<StoreHydrator user={user} team={team}>
			<TrialBanner serverNow={serverNow} />
			{children}
		</StoreHydrator>
	);
}
