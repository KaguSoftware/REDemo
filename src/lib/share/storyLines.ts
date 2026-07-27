// The text that goes ON a social media image, as plain strings.
//
// Split out from storyImage.ts on purpose: a <canvas> cannot be asserted on in
// vitest, but this can — and this is where the security property lives.
//
// CLIENT-SAFE BY CONSTRUCTION, same rule as whatsappMessage.ts: the input type
// is ShareableProperty, an explicit whitelist of named fields. Nothing here
// spreads a Property, so the homeowner's name and the tapu identifiers
// (ada/parsel) cannot reach a public post. On a WhatsApp message that leak
// would go to one client; on Instagram it goes to everyone, which is why the
// same discipline is applied twice rather than relaxed once.

import { fmtMoney } from "../format";
import type { ShareableProperty } from "../whatsappMessage";

export interface StoryLines {
	/** "Satılık" / "Kiralık" — the chip above the address. */
	badge: string;
	/** Street + district, the largest text on the image. */
	headline: string;
	/** City, under the headline. Empty when unknown. */
	sub: string;
	/** Up to three short facts: nitelik, m², oda/banyo. */
	stats: string[];
	/** Formatted price, or "" when the property has none. */
	price: string;
	/** "Fiyat" / "Aylık kira". Empty when there is no price to label. */
	priceLabel: string;
}

/**
 * Reduce a property to the handful of strings the image renders.
 *
 * An absent value yields "" or an omitted entry rather than a placeholder: a
 * post is a marketing surface, so "—" or "Belirtilmedi" would be worse than
 * simply not drawing that row.
 */
export function storyLines(property: ShareableProperty): StoryLines {
	const badge =
		property.listing_type === "for_rent" ? "Kiralık"
		: property.listing_type === "for_sale" ? "Satılık"
		: "";

	const headline = property.address_line?.trim() || "";
	const sub = property.city?.trim() || "";

	const stats = [
		property.nitelik?.trim() || null,
		property.size_sqm != null ? `${property.size_sqm} m²` : null,
		property.bedrooms != null && property.bathrooms != null
			? `${property.bedrooms}+${property.bathrooms}`
			: property.bedrooms != null
				? `${property.bedrooms} oda`
				: null,
	].filter((v): v is string => v !== null);

	const hasPrice = property.list_price != null;
	return {
		badge,
		headline,
		sub,
		stats,
		price: hasPrice ? fmtMoney(property.list_price as number, property.currency || "TRY") : "",
		// No price means no label — an empty "Fiyat" box reads as an error.
		priceLabel: hasPrice ? (property.listing_type === "for_rent" ? "Aylık kira" : "Fiyat") : "",
	};
}

/**
 * Default caption. Turkish, no em dashes (they render inconsistently and read
 * as machine-written), hashtags last so the copy stands on its own if a
 * platform strips them.
 *
 * Uses the same {token} vocabulary as the WhatsApp template so an office owner
 * only ever learns one set.
 */
export const DEFAULT_SOCIAL_CAPTION = [
	"{tur} | {adres}",
	"{ozellikler}",
	"{fiyatEtiketi}: {fiyat}",
	"",
	"Detaylı bilgi ve randevu için bize ulaşın.",
	"{gonderen}",
	"",
	"#emlak #satılıkdaire #kiralıkdaire #gayrimenkul",
].join("\n");
