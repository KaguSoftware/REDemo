import { describe, it, expect } from "vitest";
import { cn } from "./cn";

/**
 * These tests exist because nothing else in the project can catch a design-system
 * regression: no component has a test, there are no snapshots, and ESLint carries
 * no Tailwind plugin. cn() is the single choke point every primitive's className
 * flows through, so pinning its conflict resolution is the closest thing to a
 * guard rail the surface tiers have.
 *
 * The rule being pinned: a caller's override must beat the primitive's base
 * class. Before tailwind-merge, the winner was decided by stylesheet emission
 * order instead — which is how `<Card className="p-5">` silently rendered at
 * 24px, and why callers stopped overriding primitives and copy-pasted surface
 * strings instead.
 */
describe("cn", () => {
	it("lets a caller's override beat the primitive's base class", () => {
		// The measured real-world failure: p-6 is emitted after p-5 in the built
		// CSS, so the naive joiner rendered this at 24px, not 20px.
		expect(cn("bg-base-100 p-6", "p-5")).toBe("bg-base-100 p-5");
		expect(cn("rounded-2xl", "rounded-full")).toBe("rounded-full");
	});

	it("keeps the old signature working", () => {
		expect(cn("a", false, null, undefined, "b")).toBe("a b");
		expect(cn()).toBe("");
	});

	it("treats a variant-prefixed utility as a separate property", () => {
		// Card's base is `p-6 sm:p-8`; a caller passing `p-10` must not lose the
		// responsive step. This is why the four `p-10` empty-state cards are
		// unaffected by the merge swap.
		expect(cn("p-6 sm:p-8", "p-10")).toBe("sm:p-8 p-10");
		expect(cn("hover:bg-base-200", "bg-base-100")).toBe("hover:bg-base-200 bg-base-100");
	});

	it("separates border width from border colour", () => {
		// The invalid-input case: the error colour must win while `border`
		// (the width) survives, or every form's error state loses its outline.
		expect(cn("border border-base-300", "border-error/40")).toBe("border border-error/40");
	});

	// --- The custom scales registered in extendTailwindMerge. Each of these
	// --- fails on a stock tailwind-merge config, which is the point of the test.

	it("dedupes the custom shadow scale (--shadow-soft/card/pop)", () => {
		expect(cn("shadow-card", "shadow-pop")).toBe("shadow-pop");
		expect(cn("shadow-soft", "shadow-none")).toBe("shadow-none");
	});

	it("dedupes daisyUI's radius tokens — the load-bearing entry", () => {
		// The surface tiers are built on rounded-box / rounded-field. Unregistered,
		// these would BOTH survive and the radius consolidation would ship with
		// merging silently disabled on the one property it consolidates.
		expect(cn("rounded-box", "rounded-full")).toBe("rounded-full");
		expect(cn("rounded-field", "rounded-box")).toBe("rounded-box");
		expect(cn("rounded-2xl", "rounded-box")).toBe("rounded-box");
	});

	it("dedupes the custom keyframe animations", () => {
		expect(cn("animate-wiggle", "animate-wiggle-loop")).toBe("animate-wiggle-loop");
		expect(cn("animate-dropdown-in", "animate-none")).toBe("animate-none");
	});

	it("dedupes the named type scale", () => {
		// Heading's base carries text-label; a caller passing a Tailwind step must
		// replace it, not stack on top of it.
		expect(cn("text-label", "text-sm")).toBe("text-sm");
		expect(cn("text-sm", "text-body")).toBe("text-body");
		expect(cn("text-title", "text-display")).toBe("text-display");
	});

	it("does not merge daisyUI semantic colours into the font-size group", () => {
		// `text-base-content` must classify as a text COLOUR, not as the
		// `text-base` font size, or every label in the app loses its size.
		expect(cn("text-sm", "text-base-content/60")).toBe("text-sm text-base-content/60");
		expect(cn("text-base-content", "text-error")).toBe("text-error");
	});

	it("leaves the project's own non-Tailwind utilities alone", () => {
		// safe-x owns padding-left/right via env(); it must survive next to a
		// Tailwind padding utility rather than being treated as a conflict.
		expect(cn("mx-auto py-6 safe-x", "skeleton-group settle-in")).toBe(
			"mx-auto py-6 safe-x skeleton-group settle-in",
		);
	});

	it("keeps a labelled arbitrary colour distinct from a font size", () => {
		// nodes.tsx:113 carries both on one element. Unlabelled
		// (`text-[var(--doc-primary)]`) tailwind-merge cannot tell them apart and
		// eats one; labelled, both survive.
		expect(cn("text-[color:var(--doc-primary)] text-[11px]")).toBe(
			"text-[color:var(--doc-primary)] text-[11px]",
		);
	});
});
