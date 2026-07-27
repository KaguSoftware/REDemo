// Single source of truth for app navigation — consumed by the mobile
// NavDrawer and the desktop Sidebar so the two can never drift apart.

import type { ComponentType } from "react";
import { LayoutDashboard, Home, Users, Files, Shield, UsersRound, CreditCard, UserCog, Building2 } from "lucide-react";

export interface NavItem {
	href: string;
	label: string;
	icon: ComponentType<{ className?: string }>;
	adminOnly?: boolean;
}

export interface NavGroup {
	/** Group heading on desktop; ignored (flattened) in the mobile drawer. */
	label: string | null;
	items: NavItem[];
}

/**
 * The rail carries DESTINATIONS an agent visits during a working day. Two kinds
 * of thing used to be in here that are not that:
 *
 * - "Yeni belge" is an ACTION, not a place, and the global AddMenu exists for
 *   exactly that. A create button in a list of locations makes the list stop
 *   reading as a map.
 * - The four-item "Hesap" group — Ekip, Abonelik, Profil, Yönetim — took four
 *   permanent slots competing with the five daily destinations, for pages
 *   visited a few times a month. They moved into AccountMenu, one click from
 *   every page, which is where the account already lived.
 *
 * Result: nine rail items down to five, all of them work.
 */
export const NAV_GROUPS: NavGroup[] = [
	{
		label: null,
		items: [{ href: "/", label: "Genel bakış", icon: LayoutDashboard }],
	},
	{
		label: "Çalışma",
		items: [
			{ href: "/properties", label: "Portföy", icon: Home },
			{ href: "/projects", label: "Projeler", icon: Building2 },
			{ href: "/leads", label: "Müşteriler", icon: Users },
			{ href: "/documents", label: "Belgeler", icon: Files },
		],
	},
];

/**
 * Account destinations, rendered by AccountMenu (desktop) and the NavDrawer's
 * footer (mobile). Kept here so the two can never drift, the same reason
 * NAV_GROUPS exists.
 */
export const ACCOUNT_ITEMS: NavItem[] = [
	{ href: "/team", label: "Ekip", icon: UsersRound },
	{ href: "/settings/billing", label: "Abonelik", icon: CreditCard },
	{ href: "/settings/profile", label: "Profil", icon: UserCog },
	{ href: "/admin", label: "Yönetim", icon: Shield, adminOnly: true },
];

/** Flat item list (drawer order = group order). */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/**
 * The single item that should render as active for a pathname: longest
 * matching href wins, so "/documents/new" doesn't also light up "/documents".
 */
export function activeNavHref(pathname: string, items: NavItem[]): string | null {
	const matches = (h: string) => (h === "/" ? pathname === "/" : pathname.startsWith(h));
	const best = items.filter((i) => matches(i.href)).sort((a, b) => b.href.length - a.href.length)[0];
	return best?.href ?? null;
}
