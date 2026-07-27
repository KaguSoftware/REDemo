/**
 * PublicShell — shared chrome for the signed-out surface: landing page and
 * legal pages. Server-renderable (no client hooks) for SEO.
 */

import Link from "next/link";
import { Building2 } from "lucide-react";

export function PublicShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-dvh bg-base-200 flex flex-col">
			<header className="safe-top border-b border-base-300 bg-base-100/80 backdrop-blur sticky top-0 z-30">
				<div className="mx-auto max-w-6xl safe-x flex items-center justify-between h-16">
					<Link href="/" className="font-display flex items-center gap-2.5 text-lg font-semibold text-base-content">
						<span className="h-8 w-8 rounded-box bg-primary text-primary-content flex items-center justify-center">
							<Building2 className="w-4.5 h-4.5" />
						</span>
						Kagu Emlak
					</Link>
					<nav className="flex items-center gap-2">
						<Link
							href="/login"
							className="px-4 h-10 inline-flex items-center rounded-box text-sm font-semibold text-base-content/80 hover:bg-base-200 transition-colors"
						>
							Giriş yap
						</Link>
						<Link
							href="/signup"
							className="px-4 h-10 inline-flex items-center rounded-box text-sm font-semibold bg-primary text-primary-content hover:brightness-110 active:scale-[0.98] transition-[filter,transform]"
						>
							Ücretsiz deneyin
						</Link>
					</nav>
				</div>
			</header>

			<main className="flex-1">{children}</main>

			<footer className="border-t border-base-300 bg-base-100">
				<div className="mx-auto max-w-6xl safe-x py-8 safe-bottom flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-base-content/60">
					<p>© {new Date().getFullYear()} Kagu Emlak. Tüm hakları saklıdır.</p>
					<nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
						<Link href="/kullanim-kosullari" className="hover:text-base-content transition-colors">
							Kullanım Koşulları
						</Link>
						<Link href="/gizlilik-politikasi" className="hover:text-base-content transition-colors">
							Gizlilik Politikası
						</Link>
						<Link href="/kvkk-aydinlatma" className="hover:text-base-content transition-colors">
							KVKK Aydınlatma Metni
						</Link>
					</nav>
				</div>
			</footer>
		</div>
	);
}

/** Simple prose wrapper for legal pages. */
export function LegalArticle({ title, updated, children }: {
	title: string;
	updated: string;
	children: React.ReactNode;
}) {
	return (
		<article className="mx-auto max-w-3xl safe-x py-10 sm:py-14">
			<h1 className="font-display text-display sm:text-4xl font-semibold text-base-content">{title}</h1>
			<p className="mt-2 text-label text-base-content/50">Son güncelleme: {updated}</p>
			{/* The legal pages emit bare <h2>/<p>/<ul> against Preflight's reset, so
			    every rule they get comes from here. `max-w-[68ch]` holds the body
			    measure in the 65–75ch band; without it a 3xl container runs long
			    lines that are genuinely hard to read at 15px. More space above a
			    heading than below it — mt-10 against the list's own rhythm. */}
			<div className="mt-8 max-w-[68ch] space-y-5 text-body text-base-content/80 [&_h2]:font-display [&_h2]:text-subtitle [&_h2]:font-semibold [&_h2]:text-base-content [&_h2]:mt-10 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_strong]:font-medium [&_strong]:text-base-content">
				{children}
			</div>
		</article>
	);
}
