import { AppShell, type ShellWidth } from "./AppShell";
import { PageSkeleton } from "./skeletons";
import { Skeleton } from "./Skeleton";

/**
 * Route-level loading shell, for `loading.tsx` files and Suspense fallbacks.
 *
 * It renders the real AppShell so the sidebar, chrome and page opening stay put
 * while the route resolves. The two things it replaces both flashed harder than
 * the wait they covered: `<Suspense fallback={null}>` blanked the entire page,
 * and the version before that rendered a bare centred spinner with no chrome at
 * all, so the sidebar vanished and rebuilt on every entry.
 *
 * ⚠️ A route whose title or subtitle is DYNAMIC cannot be matched by a static
 * string here, and guessing produced four routes that visibly re-laid-out on
 * mount: `/projects/[id]` announced "Proje" and became the project's name,
 * `/properties/[id]` gained a city subtitle out of nowhere, and both settings
 * pages gained the team name. That was a 12px line when the title lived in the
 * chrome bar; now that the page opens with a 32px display block, it moves every
 * pixel below it.
 *
 * So an unknown value is not guessed — it is RESERVED. Omit `title`/`subtitle`
 * and this renders a skeleton bar occupying the same geometry the real text
 * will. Pass `subtitle={false}` to say the route genuinely has none.
 */
export function RouteLoading({
	title,
	subtitle,
	width,
	children,
}: {
	/** Omit when the route's title is dynamic — its geometry is reserved instead. */
	title?: string;
	/** Omit when dynamic; `false` when the route genuinely has no subtitle. */
	subtitle?: string | false;
	width?: ShellWidth;
	/** Surface-specific skeleton; defaults to the generic list shape. */
	children?: React.ReactNode;
}) {
	return (
		<AppShell
			// h-8 ≈ the 32px display line; w-64 is a plausible title length, and
			// because the block is a fixed height the width does not affect layout.
			title={title ?? <Skeleton className="h-8 w-56 sm:w-64 align-middle" />}
			subtitle={
				subtitle === false
					? undefined
					: (subtitle ?? <Skeleton className="h-[1.5em] w-40 align-middle" />)
			}
			width={width}
		>
			{children ?? <PageSkeleton />}
		</AppShell>
	);
}
