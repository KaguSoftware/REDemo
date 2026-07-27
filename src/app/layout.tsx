import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, IBM_Plex_Mono, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { AuthProvider } from "@/src/components/auth/AuthProvider";
import { ToastHost } from "@/src/components/ui/Toast";
import { OfflineBanner } from "@/src/components/ui/OfflineBanner";
import { BrandTheme } from "@/src/components/ui/BrandTheme";
import { getSiteUrl } from "@/src/lib/siteUrl";

// One grotesque family, weight-driven hierarchy: body and display share
// Schibsted Grotesk (.font-display adds tracking, see globals.css).
const schibsted = Schibsted_Grotesk({ subsets: ["latin", "latin-ext"], variable: "--font-latin" });
// Tabular numerals for money/data columns (rent, payments, analytics).
const plexMono = IBM_Plex_Mono({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-mono-face" });
const notoArabic = Noto_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700", "900"], variable: "--font-arabic" });

const SITE_URL = getSiteUrl();

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: "Kagu Emlak — Emlak ofisiniz için tek uygulama",
		template: "%s — Kagu Emlak",
	},
	description:
		"Portföy yönetimi, müşteri takibi (CRM), kiracı ve tahsilat yönetimi, sözleşme PDF'leri — emlak ofisleri için hepsi bir arada.",
	openGraph: {
		type: "website",
		locale: "tr_TR",
		siteName: "Kagu Emlak",
		title: "Kagu Emlak — Emlak ofisiniz için tek uygulama",
		description:
			"Portföy, müşteri, kiracı, tahsilat ve sözleşmeler — ekibinizle birlikte, tek bir yerde.",
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	// Light is the default; the boot script swaps this for explicit dark
	// users before paint. Matches --color-base-200 (cool silver-grey).
	themeColor: "#f4f5f6",
};

// Light is the default (no attribute needed). Only an explicit "dark" choice
// sets the attribute — before first paint, so there is no flash. The team's
// brand accent (persisted per-theme by BrandTheme under "kagu-brand-vars") is
// applied in the same pass so a hard refresh never flashes the stock palette.
const themeBootScript = `try{var d=localStorage.getItem("kagu-theme")==="dark";if(d)document.documentElement.setAttribute("data-theme","estate-dark");var b=localStorage.getItem("kagu-brand-vars");if(b){var v=JSON.parse(b)[d?"dark":"light"];if(v&&v.p){var s=document.documentElement.style;s.setProperty("--color-primary",v.p);s.setProperty("--color-primary-content",v.pc);}}}catch(e){}`;

// NOTE: this layout must stay free of cookies()/headers() and any other dynamic
// API. Reading the session here would seed the store one level higher, but it
// also opts EVERY route into on-demand rendering — measured: it turned
// /gizlilik-politikasi, /kullanim-kosullari, /kvkk-aydinlatma and /signup from
// static into dynamic. The signed-in seeding lives in <ServerSeed>, which each
// authenticated page renders; those pages already read cookies, so it is free
// there. See src/components/auth/ServerSeed.tsx.
export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="tr" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
			</head>
			<body
				className={`${schibsted.variable} ${plexMono.variable} ${notoArabic.variable} bg-base-200 text-base-content antialiased overflow-x-hidden`}
				style={{ fontFamily: "var(--font-latin), var(--font-arabic), sans-serif" }}
			>
				<AuthProvider>
					<BrandTheme />
					{children}
				</AuthProvider>
				<OfflineBanner />
				<ToastHost />
			</body>
		</html>
	);
}
