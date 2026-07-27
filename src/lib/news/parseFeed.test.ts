import { describe, it, expect } from "vitest";
import { parseFeed, mergeFeeds, decodeText } from "./parseFeed";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
	<title>Emlak Kulisi</title>
	<item>
		<title><![CDATA[Konut kredisi faizleri & yeni oranlar]]></title>
		<link>https://emlakkulisi.com/haber/1</link>
		<pubDate>Mon, 27 Jul 2026 08:30:00 +0300</pubDate>
	</item>
	<item>
		<title>Tapu harcı &amp; masraflar</title>
		<link>https://emlakkulisi.com/haber/2</link>
		<pubDate>Sun, 26 Jul 2026 10:00:00 +0300</pubDate>
	</item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
	<entry>
		<title>Kentsel dönüşümde yeni dönem</title>
		<link rel="alternate" href="https://example.com/atom/1"/>
		<published>2026-07-27T05:00:00Z</published>
	</entry>
</feed>`;

describe("parseFeed", () => {
	it("reads RSS items, unwrapping CDATA and decoding entities", () => {
		const items = parseFeed(RSS, "Emlak Kulisi");
		expect(items).toHaveLength(2);
		expect(items[0].title).toBe("Konut kredisi faizleri & yeni oranlar");
		expect(items[1].title).toBe("Tapu harcı & masraflar");
		expect(items[0].link).toBe("https://emlakkulisi.com/haber/1");
		expect(items[0].source).toBe("Emlak Kulisi");
		expect(items[0].publishedAt).toBe("2026-07-27T05:30:00.000Z");
	});

	it("reads Atom, where the link is an attribute on a self-closing tag", () => {
		// The failure mode a body-only parser hits: <link/> has no content, so
		// every entry would be dropped for having no link.
		const items = parseFeed(ATOM, "Example");
		expect(items).toHaveLength(1);
		expect(items[0].link).toBe("https://example.com/atom/1");
		expect(items[0].publishedAt).toBe("2026-07-27T05:00:00.000Z");
	});

	it("drops items with no title, no link, or a non-http scheme", () => {
		// A javascript: URL from a hostile or compromised feed would otherwise be
		// rendered straight into an anchor href.
		const xml = `<rss><channel>
			<item><title>Başlıksız değil ama linksiz</title></item>
			<item><link>https://ok.example/1</link></item>
			<item><title>Zararlı</title><link>javascript:alert(1)</link></item>
			<item><title>İyi</title><link>https://ok.example/2</link></item>
		</channel></rss>`;
		const items = parseFeed(xml, "S");
		expect(items.map((i) => i.link)).toEqual(["https://ok.example/2"]);
	});

	it("tolerates a missing date rather than dropping the headline", () => {
		const xml = `<rss><channel><item>
			<title>Tarihsiz</title><link>https://ok.example/x</link>
		</item></channel></rss>`;
		expect(parseFeed(xml, "S")[0].publishedAt).toBeNull();
	});

	it("returns [] for garbage instead of throwing", () => {
		// A feed that starts serving an HTML error page must cost one card row,
		// not a crashed dashboard.
		expect(parseFeed("<html><body>502 Bad Gateway</body></html>", "S")).toEqual([]);
		expect(parseFeed("", "S")).toEqual([]);
	});
});

describe("decodeText", () => {
	it("decodes &amp; last so double-escaped entities survive", () => {
		expect(decodeText("&amp;lt;b&amp;gt;")).toBe("&lt;b&gt;");
		expect(decodeText("Ev &amp; Bahçe")).toBe("Ev & Bahçe");
	});

	it("collapses the whitespace feeds leave around CDATA", () => {
		expect(decodeText("<![CDATA[\n  İki   satır\n]]>")).toBe("İki satır");
	});
});

describe("mergeFeeds", () => {
	const item = (link: string, publishedAt: string | null) =>
		({ title: link, link, source: "s", publishedAt });

	it("sorts newest first and caps at the limit", () => {
		const out = mergeFeeds(
			[
				[item("a", "2026-07-01T00:00:00Z"), item("b", "2026-07-27T00:00:00Z")],
				[item("c", "2026-07-15T00:00:00Z")],
			],
			2,
		);
		expect(out.map((i) => i.link)).toEqual(["b", "c"]);
	});

	it("drops duplicate links across sources", () => {
		// Wire copy gets syndicated; the same story from two outlets is one row.
		const out = mergeFeeds(
			[[item("same", "2026-07-27T00:00:00Z")], [item("same", "2026-07-27T00:00:00Z")]],
			10,
		);
		expect(out).toHaveLength(1);
	});

	it("puts undated items last, not first", () => {
		// Treating null as epoch-0 would sort them to the bottom by accident and
		// as "now" would bury real news. Both are wrong; this pins the intent.
		const out = mergeFeeds(
			[[item("undated", null), item("old", "2020-01-01T00:00:00Z")]],
			10,
		);
		expect(out.map((i) => i.link)).toEqual(["old", "undated"]);
	});
});
