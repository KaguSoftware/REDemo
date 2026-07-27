"use client";

/**
 * Global trial/paywall banner. Rendered once in the root layout:
 *  - last 3 trial days → amber countdown with a subscribe link
 *  - trial over & no active subscription → red "read-only" banner
 * RLS is the real write lock; this keeps the user informed before they hit it.
 */

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TriangleAlert, Lock } from "lucide-react";
import { useAppStore } from "@/src/store";

/**
 * @param serverNow The render time from the root layout, rounded to the minute.
 *   The server snapshot used to be a hardcoded `0`, which suppressed the banner
 *   in the SSR HTML — so it was INSERTED after hydration, and since it is
 *   sticky and in normal flow it shoved the entire page down a row. Passing the
 *   real server clock lets the HTML contain the banner from the start. Both
 *   sides round to the same minute, so they normally agree; if they don't
 *   (clock skew, a minute boundary) useSyncExternalStore just re-renders — this
 *   is the one hook where differing server/client snapshots are legal, not a
 *   hydration mismatch.
 */
export function TrialBanner({ serverNow }: { serverNow: number }) {
	const team = useAppStore((s) => s.team);
	const pathname = usePathname();
	// Minute-granular clock via useSyncExternalStore, so render stays pure.
	const now = useSyncExternalStore(
		(onTick) => {
			const t = setInterval(onTick, 60_000);
			return () => clearInterval(t);
		},
		() => Math.floor(Date.now() / 60_000) * 60_000,
		() => serverNow,
	);

	if (!team || now === 0 || pathname.startsWith("/settings/billing") || pathname.startsWith("/onboarding")) {
		return null;
	}

	const onTrial = team.subscription_status === "trialing" || team.subscription_status === null;
	const daysLeft = Math.ceil((new Date(team.trial_ends_at).getTime() - now) / 86_400_000);

	if (!team.is_writable) {
		return (
			<div className="sticky top-0 z-40 bg-error text-error-content text-body px-4 py-2 flex items-center justify-center gap-2 text-center">
				<Lock className="w-4 h-4 shrink-0" />
				<span>
					{onTrial ? "Ücretsiz denemeniz sona erdi" : "Aboneliğiniz etkin değil"} — çalışma
					alanı salt okunur.{" "}
					{team.role === "owner" ? (
						<Link href="/settings/billing" className="underline font-semibold">
							Devam etmek için abone olun
						</Link>
					) : (
						"Abone olması için ekip sahibinizle iletişime geçin."
					)}
				</span>
			</div>
		);
	}

	if (onTrial && daysLeft <= 3) {
		return (
			<div className="sticky top-0 z-40 bg-warning text-warning-content text-body px-4 py-2 flex items-center justify-center gap-2 text-center">
				<TriangleAlert className="w-4 h-4 shrink-0" />
				<span>
					{daysLeft <= 0
						? "Ücretsiz denemeniz bugün sona eriyor"
						: `Ücretsiz denemenizin bitmesine ${daysLeft} gün kaldı`}
					.{" "}
					{team.role === "owner" && (
						<Link href="/settings/billing" className="underline font-semibold">
							Plan seçin
						</Link>
					)}
				</span>
			</div>
		);
	}

	return null;
}
