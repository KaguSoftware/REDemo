// Render a property as a social-media image, in the browser, with <canvas>.
//
// Why canvas and not next/og: the repo has no rasterizer at all, and an OG
// route would mean a new server endpoint, font binaries, and pulling auth-gated
// property data server-side. Canvas adds ZERO dependencies and keeps this next
// to the rest of the client-side data flow. The output goes through the same
// navigator.share path the PDF export already uses, which is the whole point —
// the target is Instagram on a phone.
//
// SECURITY: the input type is ShareableProperty (whitelist), never Property.
// See storyLines.ts.

import type { ShareableProperty } from "../whatsappMessage";
import type { BrandPalette } from "../pdf/branding";
import { readableOn } from "../pdf/branding";
import { storyLines } from "./storyLines";

export type StorySize = "post" | "story";

/** Instagram's two canonical shapes. Post is the default: it also fits X/LinkedIn. */
const SIZES: Record<StorySize, { w: number; h: number }> = {
	post: { w: 1080, h: 1350 },  // 4:5
	story: { w: 1080, h: 1920 }, // 9:16
};

export interface StoryOptions {
	size: StorySize;
	palette: BrandPalette;
	/** Office name, drawn bottom-left. */
	teamName: string;
	/** Cover photo as a data: URL, or null to render the brand block instead. */
	photoDataUrl: string | null;
	/** Office logo as a data: URL. Optional. */
	logoDataUrl?: string | null;
	/** Font family string — pass the next/font family, not a bare "Geist". */
	fontFamily: string;
}

/** Load an image element from a data URL. Resolves null rather than throwing. */
function loadImage(dataUrl: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = dataUrl;
	});
}

/**
 * Draw `img` to fill the rect, cropping the overflow (CSS `object-fit: cover`).
 * Letterboxing a listing photo would put brand-coloured bars through the middle
 * of the composition.
 */
function drawCover(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	x: number, y: number, w: number, h: number,
) {
	const scale = Math.max(w / img.width, h / img.height);
	const dw = img.width * scale;
	const dh = img.height * scale;
	ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Break `text` into at most `maxLines` lines that fit `maxWidth`. */
function wrap(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	maxLines: number,
): string[] {
	const words = text.split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		const next = current ? `${current} ${word}` : word;
		if (ctx.measureText(next).width <= maxWidth || !current) {
			current = next;
		} else {
			lines.push(current);
			current = word;
			if (lines.length === maxLines) break;
		}
	}
	if (lines.length < maxLines && current) lines.push(current);
	// Ellipsise rather than silently dropping the tail of a long address.
	if (lines.length === maxLines && words.length > lines.join(" ").split(/\s+/).length) {
		let last = lines[maxLines - 1];
		while (last && ctx.measureText(`${last}…`).width > maxWidth) {
			last = last.slice(0, -1);
		}
		lines[maxLines - 1] = `${last}…`;
	}
	return lines;
}

/**
 * Render the image and return it as a PNG File, ready for
 * shareOrDownloadFile().
 *
 * ⚠️ `photoDataUrl` must be a data: URL (use toDataUrl from lib/pdf/imageData).
 * Drawing a cross-origin image TAINTS the canvas and the toBlob() below then
 * throws SecurityError, which would break the feature only in production where
 * photos come from the Supabase CDN.
 */
export async function renderStoryImage(
	property: ShareableProperty,
	opts: StoryOptions,
): Promise<File> {
	const { w, h } = SIZES[opts.size];
	const lines = storyLines(property);
	const { palette } = opts;

	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Bu tarayıcı görsel oluşturmayı desteklemiyor.");

	// Embedded webfonts are loaded lazily by the browser; measuring or drawing
	// before they resolve silently falls back to a system face, and every
	// measureText() above would then be wrong.
	if (typeof document !== "undefined" && document.fonts?.ready) {
		await document.fonts.ready;
	}

	const font = (weight: number, size: number) => `${weight} ${size}px ${opts.fontFamily}`;

	// ── Photo (or a brand block when there is none) ──────────────────────────
	const photoH = Math.round(h * 0.62);
	ctx.fillStyle = palette.primary;
	ctx.fillRect(0, 0, w, h);

	if (opts.photoDataUrl) {
		const img = await loadImage(opts.photoDataUrl);
		if (img) drawCover(ctx, img, 0, 0, w, photoH);
	}

	// Scrim under the photo's lower edge so the chip stays legible over a bright
	// sky or a white façade.
	const scrim = ctx.createLinearGradient(0, photoH - 260, 0, photoH);
	scrim.addColorStop(0, "rgba(0,0,0,0)");
	scrim.addColorStop(1, "rgba(0,0,0,0.55)");
	ctx.fillStyle = scrim;
	ctx.fillRect(0, photoH - 260, w, 260);

	// ── Type chip, over the photo ────────────────────────────────────────────
	const pad = 72;
	if (lines.badge) {
		ctx.font = font(700, 34);
		const tw = ctx.measureText(lines.badge).width;
		const chipW = tw + 48;
		const chipH = 62;
		const chipY = photoH - chipH - 44;
		ctx.fillStyle = palette.accent;
		roundRect(ctx, pad, chipY, chipW, chipH, 16);
		ctx.fill();
		ctx.fillStyle = readableOn(palette.accent);
		ctx.textBaseline = "middle";
		ctx.fillText(lines.badge, pad + 24, chipY + chipH / 2 + 1);
	}

	// ── Text block ───────────────────────────────────────────────────────────
	const onPrimary = readableOn(palette.primary);
	let y = photoH + 96;

	ctx.textBaseline = "alphabetic";
	ctx.fillStyle = onPrimary;
	ctx.font = font(700, 64);
	for (const line of wrap(ctx, lines.headline, w - pad * 2, 2)) {
		ctx.fillText(line, pad, y);
		y += 78;
	}

	if (lines.sub) {
		ctx.font = font(400, 40);
		ctx.globalAlpha = 0.72;
		ctx.fillText(lines.sub, pad, y + 8);
		ctx.globalAlpha = 1;
		y += 62;
	}

	if (lines.stats.length) {
		y += 28;
		ctx.font = font(600, 36);
		let x = pad;
		for (const stat of lines.stats) {
			const tw = ctx.measureText(stat).width;
			const boxW = tw + 44;
			if (x + boxW > w - pad) break; // never run a pill off the edge
			ctx.fillStyle = mixOverlay(onPrimary);
			roundRect(ctx, x, y, boxW, 64, 14);
			ctx.fill();
			ctx.fillStyle = onPrimary;
			ctx.textBaseline = "middle";
			ctx.fillText(stat, x + 22, y + 33);
			ctx.textBaseline = "alphabetic";
			x += boxW + 16;
		}
		y += 108;
	}

	if (lines.price) {
		ctx.font = font(500, 32);
		ctx.fillStyle = onPrimary;
		ctx.globalAlpha = 0.65;
		ctx.fillText(lines.priceLabel, pad, y);
		ctx.globalAlpha = 1;
		ctx.font = font(700, 72);
		ctx.fillStyle = palette.accent;
		ctx.fillText(lines.price, pad, y + 78);
	}

	// ── Footer: office name, and the logo when there is one ──────────────────
	ctx.font = font(600, 32);
	ctx.fillStyle = onPrimary;
	ctx.globalAlpha = 0.6;
	ctx.textBaseline = "alphabetic";
	ctx.fillText(opts.teamName, pad, h - 72);
	ctx.globalAlpha = 1;

	if (opts.logoDataUrl) {
		const logo = await loadImage(opts.logoDataUrl);
		if (logo) {
			const boxH = 72;
			const boxW = Math.min(240, (logo.width / logo.height) * boxH);
			ctx.drawImage(logo, w - pad - boxW, h - 72 - boxH + 24, boxW, boxH);
		}
	}

	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob((b) => resolve(b), "image/png"),
	);
	if (!blob) throw new Error("Görsel oluşturulamadı.");

	return new File([blob], storyFilename(property, opts.size), { type: "image/png" });
}

/** A translucent wash of the text colour — reads on both light and dark brands. */
function mixOverlay(onPrimary: string): string {
	return onPrimary === "#ffffff" ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)";
}

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number, y: number, w: number, h: number, r: number,
) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

/** Filename from the address only — never the homeowner's name. */
export function storyFilename(property: ShareableProperty, size: StorySize): string {
	const slug = (property.address_line || "ilan")
		.toLocaleLowerCase("tr")
		.replace(/[İIı]/g, "i")
		.replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
		.replace(/ö/g, "o").replace(/ç/g, "c")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48) || "ilan";
	return `${slug}-${size}.png`;
}
