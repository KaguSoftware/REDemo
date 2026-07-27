import { extendTailwindMerge } from "tailwind-merge";

/**
 * className combiner with real Tailwind conflict resolution.
 *
 * This used to be `parts.filter(Boolean).join(" ")` with the comment "later
 * classes simply win via source order". That is false for conflicting Tailwind
 * utilities: the winner is decided by *stylesheet* emission order, not argument
 * order. Measured against a production build — `p-6` is emitted after `p-5`, so
 * `<Card className="p-5">` silently rendered at 24px, not 20px.
 *
 * The consequence was systemic, not cosmetic: because overriding a primitive's
 * className did not reliably work, callers stopped trying and copy-pasted the
 * surface string instead. That is where 13 hand-rolled card variants and 10
 * border-radius values came from. Fixing the merge is what makes the surface
 * tiers below actually enforceable.
 *
 * clsx is deliberately NOT added: every call site already passes plain
 * `string | false | null | undefined`, so twMerge's variadic form is a drop-in
 * with zero call-site churn.
 */

/**
 * tailwind-merge classifies utilities against an internal value list — it never
 * reads our CSS — so every custom scale value in globals.css is invisible to it
 * and would silently fail to dedupe. Registering them is not optional polish:
 * an unregistered `rounded-box` means `cn("… rounded-box", "rounded-full")`
 * keeps BOTH classes, which is exactly the bug this file exists to remove.
 *
 * Deliberately NOT extended:
 * - `font-display` / `font-numeric` (globals.css) both land in tailwind-merge's
 *   `font-family` group via its catch-all validator, so they are treated as
 *   mutually exclusive. They genuinely both set font-family, and they never
 *   appear on the same element, so the default behaviour is already correct.
 * - `safe-x` / `safe-top` / `safe-bottom` / `skeleton-group` / `settle-in` /
 *   `enter` / `reveal` are unknown to tailwind-merge and pass through
 *   untouched. They own no property that any Tailwind utility also sets.
 */
export const cn = extendTailwindMerge({
	extend: {
		classGroups: {
			// --shadow-soft / --shadow-card / --shadow-pop (globals.css @theme).
			// Not t-shirt sizes, so the default boxShadow scale rejects them.
			shadow: [{ shadow: ["soft", "card", "pop"] }],
			// daisyUI's --radius-box / --radius-field / --radius-selector. The
			// surface tiers are built on these, so this entry is load-bearing:
			// without it the radius consolidation would ship with radius merging
			// silently disabled on the one property being consolidated.
			rounded: [{ rounded: ["box", "field", "selector"] }],
			// Custom keyframes registered in globals.css.
			animate: [{ animate: ["wiggle", "wiggle-loop", "theme-swap", "dropdown-in"] }],
			// The named type scale (--text-micro … --text-display). Without this,
			// `cn("text-label", "text-sm")` keeps BOTH and the element renders at
			// whichever the stylesheet emits last — the exact class of bug this
			// file exists to remove, reintroduced by the scale meant to fix it.
			"font-size": [{ text: ["micro", "label", "body", "subtitle", "title", "display"] }],
		},
	},
});
