// The team-context TYPE and its row→object mapping, with no Supabase client
// bound to it.
//
// Why it is split out of teams.ts: teams.ts imports the browser Supabase client
// and the zustand store, so importing it from a Server Component would drag
// client-only code into the server bundle. The team context is now resolved on
// BOTH sides — server-side in the root layout (so the app shell renders signed-in
// on the very first paint) and client-side on auth-state changes — and both must
// produce byte-identical objects or the store would visibly change shape at
// hydration. So the select string and the mapper live here, once.

export type TeamSizeBracket = "solo" | "2-5" | "6-20" | "20+";

export interface TeamContext {
	id: string;
	name: string;
	role: "owner" | "agent";
	trial_ends_at: string;
	subscription_status: "trialing" | "active" | "past_due" | "canceled" | null;
	plan_id: string | null;
	current_period_end: string | null;
	/** Mirror of the DB-side team_is_writable() check; RLS is authoritative. */
	is_writable: boolean;
	/** Path inside the team-logos bucket, or null when no logo uploaded. */
	logo_path: string | null;
	/** User-picked document colors (hex, e.g. "#1e242e") — main brand color
	 *  plus two accents. The 5 PDF roles are derived in src/lib/pdf/branding.ts. */
	brand_color_main: string;
	brand_color_accent1: string;
	brand_color_accent2: string;
	/** How many people the team said they are (onboarding); informational only. */
	size_bracket: TeamSizeBracket | null;
}

const GRACE_DAYS = 7;

export function computeIsWritable(
	trialEndsAt: string,
	status: TeamContext["subscription_status"],
	currentPeriodEnd: string | null,
): boolean {
	if (new Date(trialEndsAt).getTime() > Date.now()) return true;
	if (status === "active") return true;
	if (status === "past_due" && currentPeriodEnd) {
		return new Date(currentPeriodEnd).getTime() + GRACE_DAYS * 86_400_000 > Date.now();
	}
	return false;
}

/** The one select that produces a full TeamContext. Must stay in sync with the mapper. */
export const TEAM_CONTEXT_SELECT =
	"role, teams(id, name, trial_ends_at, size_bracket, logo_path, brand_color_main, brand_color_accent1, brand_color_accent2, subscriptions(status, plan_id, current_period_end))";

interface TeamContextRow {
	role: string;
	teams: unknown;
}

/** Map a `team_members` row selected with TEAM_CONTEXT_SELECT into a TeamContext. */
export function mapTeamContextRow(data: TeamContextRow | null): TeamContext | null {
	if (!data) return null;

	// One-team-per-user makes both joins single rows, but PostgREST types them loosely.
	const teamRaw = data.teams;
	const team = (Array.isArray(teamRaw) ? teamRaw[0] : teamRaw) as {
		id: string;
		name: string;
		trial_ends_at: string;
		size_bracket: TeamSizeBracket | null;
		logo_path: string | null;
		brand_color_main: string | null;
		brand_color_accent1: string | null;
		brand_color_accent2: string | null;
		subscriptions:
			| { status: TeamContext["subscription_status"]; plan_id: string | null; current_period_end: string | null }
			| { status: TeamContext["subscription_status"]; plan_id: string | null; current_period_end: string | null }[]
			| null;
	} | null;
	if (!team) return null;
	const sub = Array.isArray(team.subscriptions) ? team.subscriptions[0] : team.subscriptions;

	return {
		id: team.id,
		name: team.name,
		role: data.role as "owner" | "agent",
		trial_ends_at: team.trial_ends_at,
		subscription_status: sub?.status ?? null,
		plan_id: sub?.plan_id ?? null,
		current_period_end: sub?.current_period_end ?? null,
		is_writable: computeIsWritable(team.trial_ends_at, sub?.status ?? null, sub?.current_period_end ?? null),
		logo_path: team.logo_path ?? null,
		brand_color_main: team.brand_color_main ?? "#1e242e",
		brand_color_accent1: team.brand_color_accent1 ?? "#b74427",
		brand_color_accent2: team.brand_color_accent2 ?? "#8b929e",
		size_bracket: team.size_bracket ?? null,
	};
}
