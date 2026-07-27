// Per-user settings stored in profiles.settings (JSONB, migration 0008).
// Unknown/invalid values fall back to defaults, so old rows and hand-edited
// JSON can never break the dashboard.

import { z } from "zod";
import { createClient } from "@/src/lib/supabase/client";
import { DEFAULT_ATTENTION_THRESHOLDS } from "./attentionLogic";

const userSettingsSchema = z.object({
	upcomingDays: z.number().int().min(1).max(90)
		.catch(DEFAULT_ATTENTION_THRESHOLDS.upcomingDays),
	leaseWarnDays: z.number().int().min(1).max(365)
		.catch(DEFAULT_ATTENTION_THRESHOLDS.leaseWarnDays),
	leadSilentDays: z.number().int().min(1).max(365)
		.catch(DEFAULT_ATTENTION_THRESHOLDS.leadSilentDays),
	// Absent on every profile row written before migration 0031, so it must have
	// a default rather than only a .catch() — a missing key fails `safeParse`
	// outright and would reset the user's other three thresholds with it.
	insuranceWarnDays: z.number().int().min(1).max(365)
		.catch(DEFAULT_ATTENTION_THRESHOLDS.insuranceWarnDays)
		.default(DEFAULT_ATTENTION_THRESHOLDS.insuranceWarnDays),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;

export const DEFAULT_USER_SETTINGS: UserSettings = { ...DEFAULT_ATTENTION_THRESHOLDS };

function parseSettings(raw: unknown): UserSettings {
	const result = userSettingsSchema.safeParse(raw ?? {});
	return result.success ? result.data : { ...DEFAULT_USER_SETTINGS };
}

export async function getUserSettings(): Promise<UserSettings> {
	const supabase = createClient();
	const { data: { session }, error: authErr } = await supabase.auth.getSession();
	if (authErr || !session?.user) throw new Error("Not authenticated");

	const { data, error } = await supabase
		.from("profiles").select("settings").eq("id", session.user.id).single();
	if (error) throw error;
	return parseSettings((data as { settings: unknown }).settings);
}

export async function updateUserSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
	const supabase = createClient();
	const { data: { session }, error: authErr } = await supabase.auth.getSession();
	if (authErr || !session?.user) throw new Error("Not authenticated");

	const current = await getUserSettings();
	const next = parseSettings({ ...current, ...patch });
	const { error } = await supabase
		.from("profiles").update({ settings: next }).eq("id", session.user.id);
	if (error) throw error;
	return next;
}
