// Turn an RSS 2.0 or Atom document into NewsItems.
//
// Pure and dependency-free so it can be unit-tested against real-world feed
// quirks without a network or an XML library. The three things that actually
// break naive parsers, all handled here:
//
//   1. CDATA-wrapped titles (`<title><![CDATA[Konut kredisi …]]></title>`)
//   2. Atom, where the link is an ATTRIBUTE (`<link href="…"/>`) and the item
//      element is <entry>, not <item>
//   3. HTML entities in titles (`&amp;`, `&#39;`)
//
// This is deliberately lenient: a feed element it cannot read yields one fewer
// headline, never a thrown error. A dashboard card is not worth a crash.

import type { NewsItem } from "./sources";

/** Strip CDATA wrappers and decode the handful of entities feeds actually use. */
export function decodeText(raw: string): string {
	const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
	return unwrapped
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#0*39;/g, "'")
		.replace(/&#0*34;/g, '"')
		.replace(/&nbsp;/g, " ")
		// &amp; LAST, so "&amp;lt;" decodes to "&lt;" and not to "<".
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();
}

/** First `<tag>…</tag>` body inside `xml`, or "" when absent. */
function tagContent(xml: string, tag: string): string {
	const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
	return m ? decodeText(m[1]) : "";
}

/**
 * The item's link. RSS puts it in the element body; Atom puts it in a `href`
 * attribute, preferring rel="alternate". Checking the attribute form first is
 * what makes an Atom feed work at all — its `<link/>` is self-closing, so the
 * body form finds nothing.
 */
function itemLink(xml: string): string {
	const alternate = xml.match(/<link[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i);
	if (alternate) return decodeText(alternate[1]);
	const href = xml.match(/<link[^>]*\bhref=["']([^"']+)["']/i);
	if (href) return decodeText(href[1]);
	return tagContent(xml, "link");
}

/** Normalise a feed date to an ISO string, or null if it is unusable. */
function itemDate(xml: string): string | null {
	const raw =
		tagContent(xml, "pubDate") ||
		tagContent(xml, "published") ||
		tagContent(xml, "updated") ||
		tagContent(xml, "dc:date");
	if (!raw) return null;
	const parsed = Date.parse(raw);
	return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/**
 * Parse a feed document into items attributed to `sourceName`.
 *
 * Items with no title or no http(s) link are dropped: a headline that cannot
 * be clicked is not worth a row, and rejecting non-http schemes here stops a
 * hostile or compromised feed from planting a `javascript:` URL in an anchor.
 */
export function parseFeed(xml: string, sourceName: string): NewsItem[] {
	const blocks = xml.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) ?? [];

	const items: NewsItem[] = [];
	for (const block of blocks) {
		const title = tagContent(block, "title");
		const link = itemLink(block);
		if (!title || !link) continue;
		if (!/^https?:\/\//i.test(link)) continue;
		items.push({ title, link, source: sourceName, publishedAt: itemDate(block) });
	}
	return items;
}

/** Merge feeds: drop duplicate links, newest first, undated last. */
export function mergeFeeds(lists: NewsItem[][], limit: number): NewsItem[] {
	const seen = new Set<string>();
	const merged: NewsItem[] = [];
	for (const item of lists.flat()) {
		if (seen.has(item.link)) continue;
		seen.add(item.link);
		merged.push(item);
	}
	merged.sort((a, b) => {
		// An undated item sorts last rather than to 1970, which would bury a
		// perfectly good headline from a feed that simply omits pubDate.
		if (!a.publishedAt && !b.publishedAt) return 0;
		if (!a.publishedAt) return 1;
		if (!b.publishedAt) return -1;
		return b.publishedAt.localeCompare(a.publishedAt);
	});
	return merged.slice(0, limit);
}
