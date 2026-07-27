"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
	MoreVertical, LogOut, RefreshCw, HelpCircle,
	UsersRound, CreditCard, UserCog, Shield,
} from "lucide-react";
import { createClient } from "@/src/lib/supabase/client";
import { useAppStore } from "@/src/store";
import { Menu, MenuItem } from "./Menu";
import { cn } from "./cn";

/**
 * The account menu, and now the home of everything that is about the account
 * rather than about the work.
 *
 * The nav rail used to carry a four-item "Hesap" group — Ekip, Abonelik, Profil,
 * Yönetim — permanently competing for attention with the five destinations an
 * agent actually visits during a working day. Settings are visited a few times
 * a month; they do not earn a standing slot next to Portföy. They live here,
 * one click from every page, which is where this menu already was.
 *
 * Sign-out and switch account both land on /login: switching accounts is just
 * signing out for a different person to sign back in.
 */
export function AccountMenu() {
	const router = useRouter();
	const user = useAppStore((s) => s.user);
	const isAdmin = user?.app_role === "admin";

	async function signOutAndRedirect() {
		await createClient().auth.signOut();
		router.push("/login");
	}

	return (
		<Menu
			label="Hesap menüsü"
			width="w-56"
			trigger={(props) => (
				<button
					type="button"
					aria-label="Hesap menüsü"
					className="h-9 w-9 inline-flex items-center justify-center rounded-field text-base-content/70 hover:bg-base-200 transition-colors"
					{...props}
				>
					<MoreVertical className="w-4.5 h-4.5" />
				</button>
			)}
		>
			{(close) => (
				<>
					<MenuLink href="/team" icon={UsersRound} onNavigate={close}>Ekip</MenuLink>
					<MenuLink href="/settings/billing" icon={CreditCard} onNavigate={close}>Abonelik</MenuLink>
					<MenuLink href="/settings/profile" icon={UserCog} onNavigate={close}>Profil</MenuLink>
					{isAdmin && <MenuLink href="/admin" icon={Shield} onNavigate={close}>Yönetim</MenuLink>}

					<hr className="my-1 border-base-300" />

					<MenuItem icon={RefreshCw} onClick={() => { close(); void signOutAndRedirect(); }}>
						Hesap değiştir
					</MenuItem>
					<MenuLinkExternal href="mailto:contact@kagusoftware.com" icon={HelpCircle} onNavigate={close}>
						Yardım
					</MenuLinkExternal>
					<MenuItem icon={LogOut} tone="error" onClick={() => { close(); void signOutAndRedirect(); }}>
						Çıkış yap
					</MenuItem>
				</>
			)}
		</Menu>
	);
}

/** MenuItem's skin on a real <Link>, so navigation keeps prefetch and middle-click. */
const ROW =
	"w-full flex items-center gap-3 px-3 py-2.5 rounded-field text-body font-medium text-left " +
	"text-base-content/80 hover:bg-base-200 hover:text-base-content transition-colors duration-150 " +
	"focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25";

function MenuLink({
	href, icon: Icon, onNavigate, children,
}: {
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	onNavigate: () => void;
	children: React.ReactNode;
}) {
	return (
		<Link href={href} role="menuitem" onClick={onNavigate} className={cn(ROW)}>
			<Icon className="w-4 h-4 shrink-0 text-base-content/60" />
			{children}
		</Link>
	);
}

function MenuLinkExternal({
	href, icon: Icon, onNavigate, children,
}: {
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	onNavigate: () => void;
	children: React.ReactNode;
}) {
	return (
		<a href={href} role="menuitem" onClick={onNavigate} className={cn(ROW)}>
			<Icon className="w-4 h-4 shrink-0 text-base-content/60" />
			{children}
		</a>
	);
}
