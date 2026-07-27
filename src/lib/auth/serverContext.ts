import { cache } from "react";
import { createClient } from "@/src/lib/supabase/server";
import { TEAM_CONTEXT_SELECT, mapTeamContextRow, type TeamContext } from "@/src/lib/db/teamContext";
import type { UserProfile } from "@/src/store/useAppStore";

/**
 * The signed-in user and their team, resolved on the SERVER so the root layout
 * can seed the client store before the first paint.
 *
 * Why this exists: `user` and `team` used to be resolved only in AuthProvider's
 * useEffect, so the very first frame of every page rendered as a signed-OUT app —
 * no sidebar, main content 256px to the left, a "Giriş yap" button, and
 * "…giriş yapın" cards — and then snapped into place. Worse, `useTeamReady()`
 * gates the `enabled` flag of nearly every fetch in the app, so no data request
 * even STARTED until two client round-trips had completed.
 *
 * Cost: identity is free — `getClaims()` verifies the ES256 JWT locally via
 * WebCrypto (see src/lib/supabase/server.ts), no auth-server round-trip. The
 * profile and team rows are ONE wave, and that wave REPLACES two serial client
 * round-trips that used to block every dashboard fetch.
 *
 * The returned `user` must stay field-identical to what AuthProvider's
 * `resolveUser` produces, or the store would visibly change shape at hydration.
 *
 * Wrapped in React's `cache()` so a layout and a page in the same request share
 * one call rather than paying it twice.
 */
export const getServerAppContext = cache(async (): Promise<{
	user: UserProfile | null;
	team: TeamContext | null;
	/** Render time, rounded to the minute so the client's snapshot of the same
	 *  clock matches — see TrialBanner. Lives here rather than in the layout
	 *  because a component body must stay pure (react-hooks/purity). */
	serverNow: number;
}> => {
	const serverNow = Math.floor(Date.now() / 60_000) * 60_000;
	// Never let this throw. It runs in the ROOT layout, so on every route —
	// including /login, /join and the public marketing pages, where there is no
	// session and a thrown error would take down the whole page.
	try {
		const supabase = await createClient();
		const { data: claimsData } = await supabase.auth.getClaims();
		const claims = claimsData?.claims;
		const id = claims?.sub;
		if (!id) return { user: null, team: null, serverNow };
		const email = typeof claims.email === "string" ? claims.email : "";

		// One wave, not two: the profile and the team row are independent. Serially
		// these would cost ~2× a round-trip — see the ONE RULE in HANDOFF.md
		// ("count waves, never queries").
		const [profileRes, teamRes] = await Promise.all([
			supabase.from("profiles").select("app_role, avatar_path").eq("id", id).maybeSingle(),
			supabase.from("team_members").select(TEAM_CONTEXT_SELECT).eq("user_id", id).maybeSingle(),
		]);

		return {
			user: {
				id,
				email,
				app_role: profileRes.data?.app_role ?? undefined,
				avatar_path: profileRes.data?.avatar_path ?? null,
			},
			// A team error (RLS, cold start) must not cost us the signed-in shell —
			// AuthProvider retries on the client and fills it in.
			team: teamRes.error ? null : mapTeamContextRow(teamRes.data),
			serverNow,
		};
	} catch {
		return { user: null, team: null, serverNow };
	}
});
