"use client";

import { useEffect } from "react";
import { useAppStore } from "@/src/store";
import { deriveUiAccent, readableOn } from "@/src/lib/color";

// Persisted, theme-resolved brand vars; read by the pre-paint boot script in
// layout.tsx so a hard refresh paints the team's accent immediately instead of
// flashing the stock palette first. Shape:
//   { light: { p, pc }, dark: { p, pc } }
export const BRAND_VARS_STORAGE_KEY = "kagu-brand-vars";

function currentTheme(): "light" | "dark" {
	return document.documentElement.getAttribute("data-theme") === "estate-dark" ? "dark" : "light";
}

/**
 * Applies the team's brand color to the app UI — safely.
 *
 * The three stored brand colors are designed for PDF documents (see
 * src/lib/pdf/branding.ts) and are often very dark; using them verbatim as the
 * daisyUI palette made buttons/icons invisible. So the app takes ONLY a single
 * accent, derived from brand_color_main and contrast-adjusted per theme
 * (--color-primary + content). secondary/accent stay stock. Documents keep the
 * exact colors the team picked.
 */
export function BrandTheme() {
	const main = useAppStore((s) => s.team?.brand_color_main);
	// "No brand color" and "we don't know yet" are different answers, and only the
	// first one may clear the accent. Conflating them meant this effect ran while
	// the team was merely unresolved and DELETED the accent the boot script had
	// just painted — plus the localStorage snapshot the boot script reads — so
	// every primary button flashed stock terracotta on load.
	const teamLoaded = useAppStore((s) => s.teamLoaded);

	useEffect(() => {
		if (!teamLoaded) return;
		const root = document.documentElement;

		const apply = () => {
			if (!main) {
				root.style.removeProperty("--color-primary");
				root.style.removeProperty("--color-primary-content");
				try { localStorage.removeItem(BRAND_VARS_STORAGE_KEY); } catch {}
				return;
			}
			const light = deriveUiAccent(main, "light");
			const dark = deriveUiAccent(main, "dark");
			const vars = {
				light: { p: light, pc: readableOn(light) },
				dark: { p: dark, pc: readableOn(dark) },
			};
			const active = vars[currentTheme()];
			root.style.setProperty("--color-primary", active.p);
			root.style.setProperty("--color-primary-content", active.pc);
			try { localStorage.setItem(BRAND_VARS_STORAGE_KEY, JSON.stringify(vars)); } catch {}
		};

		apply();

		// Re-resolve when the user toggles light/dark (ThemeToggle flips the
		// data-theme attribute) — the safe accent differs per theme.
		const observer = new MutationObserver(apply);
		observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

		// Only the observer is torn down. Clearing the vars here would strip the
		// accent on any unmount — including React StrictMode's double-mount in dev
		// — and the next mount re-applies them anyway.
		return () => observer.disconnect();
	}, [main, teamLoaded]);

	return null;
}
