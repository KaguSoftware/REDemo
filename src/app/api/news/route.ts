// Turkish real-estate / economy headlines for the dashboard card.
//
//   GET /api/news → { items: NewsItem[] }
//
// Only fetches URLs from the hard-coded allowlist in lib/news/sources.ts — see
// the warning there. Signed-in only, so the app isn't a free RSS proxy for the
// internet, and every upstream fetch is cached for 30 minutes so a dashboard
// load never costs a real round-trip to a news site.

import { NextResponse } from "next/server";
import { createClient, getUserId } from "@/src/lib/supabase/server";
import { mergeFeeds, parseFeed } from "@/src/lib/news/parseFeed";
import {
	NEWS_ITEM_LIMIT,
	NEWS_REVALIDATE_SECONDS,
	NEWS_SOURCES,
	type NewsItem,
} from "@/src/lib/news/sources";

/** A slow feed must not hold the dashboard's card open indefinitely. */
const FEED_TIMEOUT_MS = 6000;

async function fetchSource(name: string, url: string): Promise<NewsItem[]> {
	try {
		const res = await fetch(url, {
			// Some outlets 403 a bare fetch; identify the app the way the geocode
			// route does for Nominatim.
			headers: { "User-Agent": "KaguEmlak/1.0 (+https://kagu.com.tr)", Accept: "application/rss+xml, application/xml, text/xml, */*" },
			signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
			next: { revalidate: NEWS_REVALIDATE_SECONDS },
		});
		if (!res.ok) return [];
		return parseFeed(await res.text(), name);
	} catch {
		// One dead or renamed feed must not empty the card. Returning [] lets the
		// other sources through; the alternative is that a single outlet's outage
		// looks to the agent like "no news".
		return [];
	}
}

export async function GET() {
	// getUserId(), never getUser(): the latter is a ~330ms round-trip to the auth
	// server, and this route's whole point is to be cheap.
	const supabase = await createClient();
	const userId = await getUserId(supabase);
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	// All feeds in ONE wave. Serially this would be 3 × the slowest feed.
	const lists = await Promise.all(
		NEWS_SOURCES.map((s) => fetchSource(s.name, s.url)),
	);
	const items = mergeFeeds(lists, NEWS_ITEM_LIMIT);

	return NextResponse.json(
		{ items },
		{
			headers: {
				// `private`, not `s-maxage`: the response is behind a session check,
				// so a shared cache must not hand one visitor's result to the next.
				// What actually stops repeated outbound requests is the
				// `next: { revalidate }` on each feed fetch above, which is shared
				// across every user of the deployment.
				"Cache-Control": `private, max-age=${NEWS_REVALIDATE_SECONDS}`,
			},
		},
	);
}
