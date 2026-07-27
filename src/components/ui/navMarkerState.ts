/**
 * Where the sidebar's nav marker last sat, for the lifetime of ONE document.
 *
 * AppShell renders the Sidebar per page, so the component unmounts and remounts
 * on every navigation and cannot remember the marker's position in a ref. This
 * module can: module state survives remounts, which lets the marker glide from
 * the previously-active item instead of teleporting.
 *
 * Module scope, deliberately, not sessionStorage — which is what this replaced.
 * sessionStorage also survives a full page RELOAD, so a freshly loaded document
 * found a stale Y from the last route and animated the marker across the nav for
 * a move that never happened. A module variable resets exactly when the document
 * does, which makes `readNavMarkerY() === null` a precise "this is a fresh page
 * load, not a client-side navigation" signal.
 *
 * Exposed as functions rather than a mutable export so callers never assign to
 * imported state (react-hooks/immutability).
 */

let markerY: number | null = null;

/** The marker's Y from the previous route, or null on a fresh document. */
export function readNavMarkerY(): number | null {
	return markerY;
}

/** Record the marker's Y. Call from an effect, never during render. */
export function writeNavMarkerY(y: number): void {
	markerY = y;
}
