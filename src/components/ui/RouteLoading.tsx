import { AppShell } from "./AppShell";
import { PageSkeleton } from "./skeletons";

/**
 * Route-level loading shell, for `loading.tsx` files and Suspense fallbacks.
 *
 * It renders the real AppShell so the sidebar, header and page title stay put
 * while the route resolves. The two things it replaces both flashed harder than
 * the wait they covered: `<Suspense fallback={null}>` blanked the entire page,
 * and the previous version of this component rendered a bare centred spinner
 * with no chrome at all, so the sidebar vanished and rebuilt on every entry.
 *
 * Pass the same title/subtitle/width the route's own AppShell uses, or the
 * header text will visibly change once the page mounts.
 */
export function RouteLoading({
	title,
	subtitle,
	width,
	children,
}: {
	title: string;
	subtitle?: string;
	width?: "5xl" | "7xl" | "3xl";
	/** Surface-specific skeleton; defaults to the generic list shape. */
	children?: React.ReactNode;
}) {
	return (
		<AppShell title={title} subtitle={subtitle} width={width}>
			{children ?? <PageSkeleton />}
		</AppShell>
	);
}
