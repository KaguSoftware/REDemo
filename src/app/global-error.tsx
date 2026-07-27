"use client";

/**
 * Last-resort error boundary — replaces the root layout entirely when even it
 * crashes, so this file carries its own <html>/<body> and inline styles
 * (globals.css may not have loaded, and no CSS variable can be relied on).
 *
 * That constraint is why it drifted: with no tokens available, someone reached
 * for literal hex and it ended up gold (#d9b96a) on cream (#efeadf) over a warm
 * near-black, with a ⚠️ emoji for an icon and system-ui for type — a palette
 * PRODUCT.md explicitly rules out, on the one screen a user sees at the worst
 * possible moment.
 *
 * The values below are the estate theme's own graphite ramp and kagu accent,
 * resolved to sRGB hex by hand because this file cannot read the theme. They
 * are the ONLY hardcoded copies that are legitimate; if the palette ever moves,
 * this file has to move with it.
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// oklch(21.5% 0.01 255) — --color-base-100, estate-dark
const SURFACE = "#22262e";
// oklch(93% 0.006 250) — --color-base-content, estate-dark
const INK = "#e9eaed";
// oklch(70% 0.155 38) — --color-primary, estate-dark (the kagu's bill)
const ACCENT = "#e8734a";
// oklch(16% 0.04 38) — --color-primary-content
const ON_ACCENT = "#2b1509";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<html lang="tr">
			<body
				style={{
					margin: 0,
					minHeight: "100dvh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: "1.5rem",
					background: SURFACE,
					color: INK,
					// The app's own face if it loaded, the platform's if it did not.
					fontFamily: "var(--font-latin), system-ui, -apple-system, sans-serif",
				}}
			>
				<div style={{ maxWidth: 30 * 16, width: "100%" }}>
					{/* A drawn mark rather than the ⚠️ emoji: an emoji renders as a
					    different picture on every platform and reads as a chat message,
					    not as the product speaking. */}
					<svg
						width="28"
						height="28"
						viewBox="0 0 24 24"
						fill="none"
						stroke={ACCENT}
						strokeWidth="1.75"
						strokeLinecap="round"
						aria-hidden="true"
						style={{ display: "block" }}
					>
						<circle cx="12" cy="12" r="9" />
						<path d="M12 7.5v5.5" />
						<path d="M12 16.4v.2" />
					</svg>

					<h1
						style={{
							fontSize: "2rem",
							lineHeight: 1.15,
							letterSpacing: "-0.02em",
							fontWeight: 600,
							margin: "1.25rem 0 0",
						}}
					>
						Beklenmeyen bir hata oluştu
					</h1>
					<p
						style={{
							fontSize: "0.9375rem",
							lineHeight: 1.6,
							margin: "0.75rem 0 0",
							opacity: 0.65,
							maxWidth: "42ch",
						}}
					>
						Sorun bize otomatik olarak bildirildi. Sayfayı yeniden yüklemeyi
						deneyin; sürerse kısa bir süre sonra tekrar deneyin.
					</p>

					<button
						onClick={reset}
						style={{
							marginTop: "2rem",
							padding: "0 1.5rem",
							height: "2.75rem",
							borderRadius: "0.5rem",
							border: "none",
							background: ACCENT,
							color: ON_ACCENT,
							fontSize: "0.9375rem",
							fontWeight: 600,
							fontFamily: "inherit",
							cursor: "pointer",
						}}
					>
						Yeniden dene
					</button>

					{error.digest && (
						<p
							style={{
								marginTop: "2rem",
								fontSize: "0.6875rem",
								opacity: 0.35,
								fontFamily: "var(--font-mono-face), ui-monospace, monospace",
							}}
						>
							Hata referansı: {error.digest}
						</p>
					)}
				</div>
			</body>
		</html>
	);
}
