"use client";

/**
 * AuthProvider — client component that subscribes to Supabase auth state changes
 * and keeps the Zustand store's `user` field in sync.
 *
 * Must be mounted inside layout.tsx (client boundary).
 * SSR-safe: the initial render sets user from the server session (or null) without
 * any mismatch — the subscription fires only on the client after hydration.
 */

import { useEffect } from "react";
import { createClient } from "@/src/lib/supabase/client";
import { useAppStore } from "@/src/store";
import { clearCache } from "@/src/lib/useCachedResource";
import { fetchTeamContext } from "@/src/lib/db/teams";
import { checkTrialNotifications } from "@/src/lib/db/notifications";


// Team context + trial-notification sweep. The RPC is idempotent server-side;
// failures are non-fatal (TrialBanner still reflects trial state).
function loadTeam(setTeam: (t: Awaited<ReturnType<typeof fetchTeamContext>>) => void) {
  fetchTeamContext()
    .then((team) => {
      setTeam(team);
      if (team) checkTrialNotifications().catch(() => { });
    })
    .catch(() => setTeam(null));
}

async function resolveUser(supabase: ReturnType<typeof createClient>, id: string, email: string) {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("app_role, avatar_path")
      .eq("id", id)
      .single();
    return { id, email, app_role: data?.app_role ?? undefined, avatar_path: data?.avatar_path ?? null };
  } catch {
    return { id, email };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAppStore((s) => s.setUser);
  const setTeam = useAppStore((s) => s.setTeam);
  const setProperties = useAppStore((s) => s.setProperties);
  const setLeads = useAppStore((s) => s.setLeads);

  useEffect(() => {
    const supabase = createClient();
    // Did <ServerSeed> already fill user/team from the server?
    //
    // `teamLoaded` is the signal, and reading it HERE is what makes it reliable:
    // ServerSeed sits below this provider in the tree, and effects run
    // bottom-up, so its seeding has already happened by the time this runs. On a
    // public route nothing seeds, teamLoaded is still false, and the client-side
    // bootstrap below runs as it always did.
    const seeded = useAppStore.getState().teamLoaded;
    // Supabase re-emits SIGNED_IN on token refresh / tab refocus for the SAME
    // user; clearing the cache then blanks every mounted list. Only clear when
    // the signed-in identity actually changes.
    let lastUserId: string | null = null;

    // Set user immediately from the verified token, then enrich with app_role.
    // getClaims() verifies the JWT locally (ES256) instead of the ~300ms
    // auth-server round-trip getUser() costs. This call gates `teamLoaded`,
    // which in turn gates EVERY dashboard fetch — so it is directly on the
    // critical path to first data, not just page-level bookkeeping.
    //
    // Skipped entirely when the server already seeded the store: it would only
    // re-derive the same values a round-trip later, repainting the shell.
    if (seeded) {
      lastUserId = useAppStore.getState().user?.id ?? null;
    } else {
      supabase.auth.getClaims().then(({ data }) => {
        const claims = data?.claims;
        if (!claims?.sub) { setUser(null); return; }
        const id = claims.sub;
        const email = typeof claims.email === "string" ? claims.email : "";
        lastUserId = id;
        setUser({ id, email });
        resolveUser(supabase, id, email).then(setUser);
        loadTeam(setTeam);
      });
    }

    // Keep in sync as auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const u = session?.user ?? null;
        // Supabase always replays the current session as INITIAL_SESSION on
        // subscribe. When the server already seeded that same identity there is
        // nothing to learn from it, and acting on it would undo the seeding:
        // setUser({id,email}) drops app_role/avatar_path (the avatar flashes to
        // a letter) and loadTeam refetches a team we already have. Only ignore
        // it when the identity matches — a mismatch is a real change.
        if (seeded && event === "INITIAL_SESSION" && u?.id === useAppStore.getState().user?.id) {
          return;
        }
        // Drop the SWR cache on real identity changes so one user never sees
        // another's cached rows. Token refresh keeps the same identity → keep cache.
        if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && u?.id !== lastUserId)) {
          clearCache();
        }
        lastUserId = u?.id ?? lastUserId;
        if (event === "SIGNED_OUT") lastUserId = null;
        if (event === "SIGNED_OUT") {
          // Single source of truth for store cleanup on sign-out.
          setProperties([]);
          setLeads([]);
          setTeam(null);
        }
        if (!u) { setUser(null); return; }
        setUser({ id: u.id, email: u.email ?? "" });
        resolveUser(supabase, u.id, u.email ?? "").then(setUser);
        loadTeam(setTeam);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setTeam, setProperties, setLeads]);

  return <>{children}</>;
}
