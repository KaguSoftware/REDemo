import { describe, it, expect } from "vitest";
import { storyLines, DEFAULT_SOCIAL_CAPTION } from "./storyLines";
import { renderPropertyMessage, type ShareableProperty } from "../whatsappMessage";
import { storyFilename } from "./storyImage";

function prop(over: Partial<ShareableProperty> = {}): ShareableProperty {
	return {
		address_line: "Bağdat Caddesi 12",
		city: "İstanbul",
		nitelik: "3+1",
		size_sqm: 145,
		bedrooms: 3,
		bathrooms: 1,
		listing_type: "for_sale",
		list_price: 8_500_000,
		currency: "TRY",
		...over,
	};
}

describe("storyLines", () => {
	it("builds the badge, headline, stats and price", () => {
		const out = storyLines(prop());
		expect(out.badge).toBe("Satılık");
		expect(out.headline).toBe("Bağdat Caddesi 12");
		expect(out.sub).toBe("İstanbul");
		expect(out.stats).toEqual(["3+1", "145 m²", "3+1"]);
		expect(out.price).toContain("8.500.000");
		expect(out.priceLabel).toBe("Fiyat");
	});

	it("labels a rental's price as monthly rent", () => {
		expect(storyLines(prop({ listing_type: "for_rent" })).priceLabel).toBe("Aylık kira");
	});

	it("omits the price label entirely when there is no price", () => {
		// An empty "Fiyat" box on a public post reads as a broken template.
		const out = storyLines(prop({ list_price: null }));
		expect(out.price).toBe("");
		expect(out.priceLabel).toBe("");
	});

	it("drops missing stats instead of printing placeholders", () => {
		const out = storyLines(
			prop({ nitelik: null, size_sqm: null, bedrooms: null, bathrooms: null, city: null }),
		);
		expect(out.stats).toEqual([]);
		expect(out.sub).toBe("");
	});
});

describe("storyLines — client-safety", () => {
	// The whole point of typing the renderer against ShareableProperty. These
	// fields exist on a Property row and must never reach a public post: a
	// WhatsApp leak reaches one client, an Instagram caption reaches everyone.
	const hostile = {
		...prop(),
		homeowner_name: "Ahmet Yılmaz",
		ada_no: "1234",
		parsel_no: "56",
		mahalle: "Caddebostan",
		notes: "Sahibi acil satıyor, pazarlık payı var",
	} as ShareableProperty;

	it("never surfaces the homeowner, tapu identifiers or internal notes", () => {
		const blob = JSON.stringify(storyLines(hostile));
		expect(blob).not.toContain("Ahmet Yılmaz");
		expect(blob).not.toContain("1234");
		expect(blob).not.toContain("acil satıyor");
	});

	it("keeps them out of the filename too", () => {
		expect(storyFilename(hostile, "post")).not.toContain("ahmet");
		expect(storyFilename(hostile, "post")).toBe("bagdat-caddesi-12-post.png");
	});

	it("resolves no caption token to private data, whatever an owner types", () => {
		// Mirrors the hostile-template tests in whatsappMessage.test.ts: a team
		// owner editing the caption cannot invent a token that reaches these.
		const rendered = renderPropertyMessage(
			hostile,
			{},
			"{homeowner_name} {ada_no} {parsel_no} {notes}",
		);
		expect(rendered).not.toContain("Ahmet Yılmaz");
		expect(rendered).not.toContain("1234");
		// Unknown tokens are left literal so the author sees the mistake.
		expect(rendered).toContain("{homeowner_name}");
	});
});

describe("DEFAULT_SOCIAL_CAPTION", () => {
	it("renders without a client name and keeps the hashtags", () => {
		const out = renderPropertyMessage(prop(), { senderName: "Kagu Emlak" }, DEFAULT_SOCIAL_CAPTION);
		expect(out).toContain("Satılık | Bağdat Caddesi 12, İstanbul");
		expect(out).toContain("Kagu Emlak");
		expect(out).toContain("#emlak");
		expect(out).not.toContain("{");
	});

	it("drops the price line for an unpriced property", () => {
		const out = renderPropertyMessage(prop({ list_price: null }), {}, DEFAULT_SOCIAL_CAPTION);
		expect(out).not.toContain("Fiyat:");
		expect(out).toContain("#emlak");
	});

	it("uses no em dashes", () => {
		// They read as machine-written and render inconsistently across apps.
		expect(DEFAULT_SOCIAL_CAPTION).not.toContain("—");
	});
});
