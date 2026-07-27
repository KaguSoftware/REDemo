// Turkish real-estate / economy feeds shown on the dashboard.
//
// ⚠️ AN ALLOWLIST, NOT A PARAMETER. The route never fetches a caller-supplied
// URL: a server endpoint that does is an open proxy, and inside a hosting
// environment it is an SSRF hole straight at the metadata service. Adding a
// source means editing this file and shipping it.
//
// Only headlines and outbound links are shown, never body text, and every row
// carries its source name — this is a pointer to someone else's journalism, not
// a republication of it.

export interface NewsSource {
	/** Shown on the chip next to each headline. */
	name: string;
	url: string;
}

/**
 * Kept deliberately short. Every feed here is a public RSS endpoint; a feed
 * that 404s, times out, or serves something unparseable is dropped from that
 * response rather than failing the card (see route.ts).
 *
 * SCOPE(slice-4): fixed list, no per-team configuration.
 * GROWS LATER → team-configurable sources + per-city filtering, once offices
 * say which outlets they actually read.
 */
export const NEWS_SOURCES: NewsSource[] = [
	{ name: "Emlak Kulisi", url: "https://emlakkulisi.com/rss" },
	{ name: "AA Ekonomi", url: "https://www.aa.com.tr/tr/rss/default?cat=ekonomi" },
	{ name: "NTV Ekonomi", url: "https://www.ntv.com.tr/ekonomi.rss" },
];

/** How long a cached response stays fresh. These feeds update hourly at best. */
export const NEWS_REVALIDATE_SECONDS = 1800;

/** Headlines returned to the client. Enough to scroll, not enough to dominate. */
export const NEWS_ITEM_LIMIT = 12;

export interface NewsItem {
	title: string;
	link: string;
	source: string;
	/** ISO timestamp, or null when the feed omits a date. */
	publishedAt: string | null;
}
