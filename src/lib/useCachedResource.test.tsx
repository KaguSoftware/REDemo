// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useCachedResource, mutateCache, clearCache, invalidateCache } from "./useCachedResource";

/**
 * These tests exist because of one specific, app-wide bug: `loading` was derived
 * from a state flag raised inside a queueMicrotask in the hook's effect, so it
 * was FALSE for the entire first render. Every
 * `loading ? <Skeleton/> : <EmptyState/>` in the app therefore rendered the
 * empty state first — an agent with a full portfolio saw "Henüz taşınmaz yok"
 * and an "add your first property" CTA for a frame on every page load.
 *
 * The invariant to protect: `loading` must be true on the FIRST render pass,
 * before any effect has run, whenever there is nothing to show yet.
 */

/** Renders the hook and records what it returned on every render, in order. */
function renderResource<T>(
	key: string | null,
	fetcher: () => Promise<T>,
	options?: { enabled?: boolean },
) {
	const renders: { data: T | null; loading: boolean }[] = [];
	function Probe() {
		const { data, loading } = useCachedResource(key, fetcher, undefined, options);
		renders.push({ data, loading });
		return null;
	}
	const utils = render(<Probe />);
	return { renders, ...utils };
}

/** Lets queued microtasks and promise callbacks settle inside act(). */
async function settle() {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
}

describe("useCachedResource", () => {
	beforeEach(() => {
		clearCache();
		window.sessionStorage.clear();
	});
	afterEach(cleanup);

	it("is loading on the very first render when there is no cached value", async () => {
		const { renders } = renderResource("k:1", async () => ["row"]);

		// The regression: this used to be false, so consumers painted their empty
		// state before the first effect had even run.
		expect(renders[0]).toEqual({ data: null, loading: true });

		await settle();
	});

	it("resolves to the fetched data and stops loading", async () => {
		const { renders } = renderResource("k:2", async () => ["a", "b"]);
		await settle();

		const last = renders[renders.length - 1];
		expect(last.data).toEqual(["a", "b"]);
		expect(last.loading).toBe(false);
	});

	it("never reports loading once a value is cached", async () => {
		mutateCache("k:3", ["cached"]);
		const { renders } = renderResource("k:3", async () => ["fresh"]);

		// Cached data paints immediately; a background revalidation is `validating`,
		// not `loading`, so the list must never blank out.
		expect(renders[0]).toEqual({ data: ["cached"], loading: false });
		expect(renders.every((r) => r.loading === false)).toBe(true);

		await settle();
	});

	it("distinguishes 'not loaded' (null) from 'loaded and empty' ([])", async () => {
		const { renders } = renderResource("k:4", async () => [] as string[]);

		expect(renders[0].data).toBeNull();
		expect(renders[0].loading).toBe(true);

		await settle();

		const last = renders[renders.length - 1];
		// The empty array is a real answer — this is the moment a consumer may
		// legitimately show "Henüz kayıt yok", and not one render earlier.
		expect(last.data).toEqual([]);
		expect(last.loading).toBe(false);
	});

	it("does not fetch or report loading while disabled", async () => {
		let calls = 0;
		const { renders } = renderResource(
			null,
			async () => { calls++; return ["x"]; },
			{ enabled: false },
		);
		await settle();

		expect(calls).toBe(0);
		// An inactive key is not "loading" — it is waiting. Consumers tell the two
		// apart via `data === null`, which is why they must branch on null first.
		expect(renders.every((r) => r.loading === false && r.data === null)).toBe(true);
	});

	it("shows the cached value again after an invalidation refetch, not a blank", async () => {
		let call = 0;
		const { renders } = renderResource("k:5", async () => [`v${++call}`]);
		await settle();
		expect(renders[renders.length - 1].data).toEqual(["v1"]);

		await act(async () => {
			invalidateCache("k:5");
			await Promise.resolve();
			await Promise.resolve();
		});
		await settle();

		expect(renders[renders.length - 1].data).toEqual(["v2"]);
	});

	it("serves a sessionStorage snapshot on the client after a reload", async () => {
		mutateCache("k:6", ["persisted"]);
		expect(window.sessionStorage.getItem("kagu:cache:k:6")).toBeTruthy();

		// Simulate a fresh document: in-memory cache gone, sessionStorage intact.
		clearCache();
		window.sessionStorage.setItem(
			"kagu:cache:k:6",
			JSON.stringify({ data: ["persisted"], fetchedAt: Date.now() }),
		);

		const { renders } = renderResource("k:6", async () => ["fresh"]);
		await settle();

		expect(renders[0].data).toEqual(["persisted"]);
		expect(renders[0].loading).toBe(false);
	});

	it("emits NO cached data during a server render, even with a snapshot present", () => {
		window.sessionStorage.setItem(
			"kagu:cache:k:7",
			JSON.stringify({ data: ["persisted"], fetchedAt: Date.now() }),
		);
		clearCache();

		function Probe() {
			const { data, loading } = useCachedResource("k:7", async () => ["fresh"]);
			return <span>{loading ? "loading" : JSON.stringify(data)}</span>;
		}
		const html = renderToString(<Probe />);

		// The server has no sessionStorage. Reading the cache during render (rather
		// than through useSyncExternalStore's server snapshot) put rows in the SSR
		// HTML that the client could not reproduce — a real hydration mismatch that
		// made React throw away and re-render the subtree.
		expect(html).not.toContain("persisted");
		expect(html).toContain("loading");
	});
});
