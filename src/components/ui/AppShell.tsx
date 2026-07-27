"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useAppStore } from "@/src/store";
import { getTeamLogoUrl } from "@/src/lib/db/teams";
import { getAvatarUrl } from "@/src/lib/db/profiles";
import { NotificationBell } from "@/src/components/notifications/NotificationBell";
import { NavDrawer } from "./NavDrawer";
import { Sidebar } from "./Sidebar";
import { Button } from "./Button";
import { Heading } from "./Heading";
import { AddMenu } from "./AddMenu";
import { AccountMenu } from "./AccountMenu";
import { cn } from "./cn";

/**
 * Content column widths, named for the reading job rather than a Tailwind step.
 *
 * `wide` widens again at 2xl because agencies put this dashboard on an office
 * screen; `reading` deliberately does not, because a contract or a property
 * record is read, and a 1500px measure is not read, it is scanned past.
 */
const WIDTHS = {
	wide: "max-w-7xl 2xl:max-w-[90rem]",
	reading: "max-w-5xl",
	narrow: "max-w-3xl",
} as const;

export type ShellWidth = keyof typeof WIDTHS;

interface AppShellProps {
	/** ReactNode so RouteLoading can reserve a dynamic title's exact geometry. */
	title: React.ReactNode;
	subtitle?: React.ReactNode;
	/** Actions for THIS page — rendered beside the page title, not in the chrome. */
	actions?: React.ReactNode;
	children: React.ReactNode;
	width?: ShellWidth;
}

/**
 * App chrome + the page's opening.
 *
 * The title used to live in the top bar, at text-lg (18px), beside the avatar —
 * making the page's one <h1> the smallest heading on the page and giving every
 * screen the same flat opening regardless of what it was for. Two consequences
 * followed: CardLabel (the h2) was quieter than the body text next to it, and
 * PropertyDetail emitted a SECOND <h1> in the content just to get a heading with
 * any presence, so the header read "Taşınmaz / İstanbul" while the body 24px
 * below it read "<address> / İstanbul".
 *
 * Now the split is by job:
 *   - the bar is chrome — navigation and the three global controls (bell, add,
 *     account). It is slim, it never scrolls away, and it carries no content.
 *   - the page opens in the content plane with a real display-size h1, its
 *     context line, and its own actions. It scrolls with the page, because a
 *     page title is content.
 *
 * The bar is full-bleed while `main` is a centred column. Previously both shared
 * one max-width, so on a route change between two different widths the entire
 * chrome shifted horizontally, not just the content.
 */
export function AppShell({ title, subtitle, actions, children, width = "reading" }: AppShellProps) {
	const user = useAppStore((s) => s.user);
	const team = useAppStore((s) => s.team);
	const [drawerOpen, setDrawerOpen] = useState(false);

	const maxW = WIDTHS[width];
	const logoUrl = getTeamLogoUrl(team?.logo_path ?? null);
	const avatarUrl = getAvatarUrl(user?.avatar_path ?? null);

	// Surface inversion: the content area is ONE continuous light plane
	// (base-100), not a grey field with white boxes floating on it. That
	// inversion is what lets most page content carry no chrome at all — on a
	// grey ground every region had to be a card just to look finished, which is
	// where the stack of identical white boxes came from. base-200 is demoted
	// to a recessed tone for insets and table headers.
	return (
		<div className={cn("min-h-screen bg-base-100", user && "lg:pl-64")}>
			{user && <Sidebar />}

			<header className="safe-top sticky top-0 z-30 bg-base-100/85 backdrop-blur border-b border-base-300">
				<div className="safe-x h-14 flex items-center gap-2.5">
					<button
						onClick={() => setDrawerOpen(true)}
						aria-label="Menüyü aç"
						className={cn(
							"h-11 w-11 -ml-1 inline-flex items-center justify-center rounded-field text-base-content/70 hover:bg-base-200 transition-colors",
							user && "lg:hidden", // desktop gets the persistent sidebar
						)}
					>
						<Menu className="w-5 h-5" />
					</button>

					{logoUrl && (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={logoUrl} alt={team?.name ?? "Ekip logosu"} className={cn("h-8 w-auto max-w-27.5 object-contain shrink-0", user && "lg:hidden")} />
					)}

					{/* The bar carries no content, so the global controls sit hard
					    right on every breakpoint. */}
					<div className="flex items-center gap-2 ml-auto">
						{user && team && <NotificationBell />}
						{user && <AddMenu />}
						{user && <AccountMenu />}
						{user ? (
							<button
								onClick={() => setDrawerOpen(true)}
								aria-label="Hesap"
								className="lg:hidden h-9 w-9 rounded-full bg-primary text-primary-content ring-1 ring-primary/40 ring-offset-2 ring-offset-base-100 flex items-center justify-center text-sm font-bold uppercase select-none overflow-hidden"
							>
								{avatarUrl ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img src={avatarUrl} alt="Profil fotoğrafı" className="h-full w-full object-cover" />
								) : (
									user.email.charAt(0)
								)}
							</button>
						) : (
							<Link href="/login"><Button size="sm">Giriş yap</Button></Link>
						)}
					</div>
				</div>
			</header>

			{/* `safe-x` owns horizontal padding (base 12/24px + notch insets); don't
			    also set `px-*` here or the two longhands race in the cascade. */}
			<main className={cn("mx-auto pt-8 pb-16 sm:pt-12 sm:pb-24 safe-x", maxW)}>
				<PageHeader title={title} subtitle={subtitle} actions={actions} />
				{children}
			</main>

			<NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
		</div>
	);
}

/**
 * The page's opening block: one h1 at display size, one line of context, and the
 * page's own actions. No rule underneath it — the space below is the separator,
 * and a border here would just reinstate the boxed look one level up.
 *
 * `mb-8` against the header's own `pt-8` is the "more space above a heading than
 * below it" rule applied at page scale.
 */
export function PageHeader({
	title,
	subtitle,
	actions,
}: {
	title: React.ReactNode;
	subtitle?: React.ReactNode;
	actions?: React.ReactNode;
}) {
	return (
		<div className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
			<div className="min-w-0">
				<Heading as="h1" size="display" className="wrap-break-word">
					{title}
				</Heading>
				{subtitle && (
					<p className="mt-2 text-body text-base-content/60 wrap-break-word">{subtitle}</p>
				)}
			</div>
			{actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
		</div>
	);
}
