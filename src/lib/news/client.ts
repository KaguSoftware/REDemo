// Client-side reader for /api/news. Not in lib/db — this is not Supabase data,
// there is no RLS involved, and it must never be treated as team-scoped.

import type { NewsItem } from "./sources";

export type { NewsItem };

export async function listNews(): Promise<NewsItem[]> {
	const res = await fetch("/api/news");
	if (!res.ok) throw new Error("Haberler yüklenemedi");
	const body = (await res.json()) as { items?: NewsItem[] };
	return body.items ?? [];
}
