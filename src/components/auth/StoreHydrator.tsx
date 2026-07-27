"use client";

import { useState } from "react";
import { useAppStore, type UserProfile } from "@/src/store/useAppStore";
import type { TeamContext } from "@/src/lib/db/teamContext";

/**
 * Seeds the zustand store with the server-resolved user and team DURING the
 * first render, before anything paints.
 *
 * It has to be during render, not in an effect: an effect runs after the first
 * commit, which is exactly the frame we are trying to eliminate — the one where
 * the whole app renders signed-out (no sidebar, "Giriş yap", "…giriş yapın"
 * cards) and then snaps into place.
 *
 * `useState`'s initializer is the standard way to do that safely: React
 * guarantees it runs exactly once per mount, so this can never loop, and it
 * writes only the INITIAL value — every later change still flows through
 * AuthProvider's onAuthStateChange subscription, which stays the source of truth.
 *
 * `teamLoaded` is set to true even when `team` is null: "the server looked and
 * there is no team" is a real answer, and it is what bounces a team-less user to
 * /onboarding instead of leaving them on a permanently-loading screen.
 */
export function StoreHydrator({
	user,
	team,
	children,
}: {
	user: UserProfile | null;
	team: TeamContext | null;
	children: React.ReactNode;
}) {
	useState(() => {
		// Signed out is also a fact worth seeding — it stops a public page from
		// rendering as if auth were still pending.
		useAppStore.setState({ user, team, teamLoaded: true });
		return true;
	});

	return <>{children}</>;
}
