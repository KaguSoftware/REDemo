"use client";

// "Sosyal medya görseli" — render the property as an Instagram-shaped PNG and
// hand it to the phone's share sheet, with the caption on the clipboard.
//
// SECURITY: everything below is built from a ShareableProperty, the same
// explicit whitelist the WhatsApp message uses. No Property object is spread
// into the renderer or the caption, so the homeowner's name and the tapu
// identifiers cannot reach a public post.

import { useEffect, useState } from "react";
import { humanizeError } from "@/src/lib/errors";
import { renderStoryImage, type StorySize } from "@/src/lib/share/storyImage";
import { DEFAULT_SOCIAL_CAPTION } from "@/src/lib/share/storyLines";
import { renderPropertyMessage, type ShareableProperty } from "@/src/lib/whatsappMessage";
import { getMessageTemplate } from "@/src/lib/db/messageTemplates";
import { getPdfBrandingFromStore } from "@/src/lib/pdf";
import { toDataUrl } from "@/src/lib/pdf/imageData";
import { listPropertyImages } from "@/src/lib/db/propertyImages";
import { shareOrDownloadFile } from "@/src/lib/downloadFile";
import { logActivity } from "@/src/lib/db/contactActivity";
import { useAppStore } from "@/src/store";
import {
	Sheet, Button, Alert, FormField, Textarea, Dropdown, toast, type DropdownOption,
} from "@/src/components/ui";
import { Copy, Download } from "lucide-react";

const SIZE_OPTIONS: DropdownOption<StorySize>[] = [
	{ value: "post", label: "Gönderi (4:5)" },
	{ value: "story", label: "Hikaye (9:16)" },
];

interface Props {
	property: ShareableProperty & { id: string };
	onClose: () => void;
}

export function SocialShareSheet({ property, onClose }: Props) {
	const team = useAppStore((s) => s.team);
	const [size, setSize] = useState<StorySize>("post");
	const [caption, setCaption] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// The office's own caption template when it has one, otherwise the built-in
	// default. A failed lookup must not block the image, so it falls back
	// silently rather than surfacing an error the agent can't act on.
	useEffect(() => {
		let cancelled = false;
		getMessageTemplate("social_caption")
			.catch(() => null)
			.then((template) => {
				if (cancelled) return;
				setCaption(
					renderPropertyMessage(
						property,
						{ senderName: team?.name ?? null },
						template ?? DEFAULT_SOCIAL_CAPTION,
					),
				);
			});
		return () => { cancelled = true; };
	}, [property, team?.name]);

	async function copyCaption() {
		try {
			await navigator.clipboard.writeText(caption);
			toast.success("Açıklama kopyalandı.");
		} catch {
			// Clipboard is permission-gated and blocked outright in some in-app
			// browsers. The textarea is selectable, so say so instead of failing.
			toast.error("Kopyalanamadı. Metni seçip elle kopyalayabilirsiniz.");
		}
	}

	async function handleGenerate() {
		setBusy(true);
		setError(null);
		try {
			const branding = await getPdfBrandingFromStore();
			const images = await listPropertyImages(property.id);
			// ⚠️ Must be a data: URL. Pointing the canvas at the Supabase CDN URL
			// taints it and toBlob() then throws SecurityError.
			const photoDataUrl = images[0] ? await toDataUrl(images[0].url) : null;

			const file = await renderStoryImage(property, {
				size,
				palette: branding.palette,
				teamName: branding.teamName,
				photoDataUrl,
				logoDataUrl: branding.logoDataUrl,
				fontFamily: getBodyFontFamily(),
			});
			await shareOrDownloadFile(file);

			// Best-effort: a failed activity row must not look like a failed share.
			logActivity({ kind: "whatsapp", property_id: property.id, body: "Sosyal medya görseli oluşturuldu." })
				.catch(() => {});
		} catch (e) {
			setError(humanizeError(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Sheet
			open
			onClose={onClose}
			title="Sosyal medya görseli"
			footer={
				<div className="flex gap-2 justify-end">
					<Button variant="ghost" onClick={onClose} disabled={busy}>Kapat</Button>
					<Button onClick={handleGenerate} loading={busy}>
						{!busy && <Download className="w-4 h-4" />}
						Görseli oluştur
					</Button>
				</div>
			}
		>
			<div className="space-y-5">
				<FormField label="Boyut" hint="Gönderi akışta, hikaye tam ekran görünür.">
					<Dropdown options={SIZE_OPTIONS} value={size} onChange={setSize} />
				</FormField>

				<FormField
					label="Açıklama"
					hint="Kopyalayıp paylaşımın altına yapıştırın. Ekip şablonunuzu Ayarlar > Mesaj şablonları'ndan düzenleyebilirsiniz."
				>
					<Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={9} />
				</FormField>

				<Button variant="outline" size="sm" onClick={copyCaption}>
					<Copy className="w-4 h-4" />
					Açıklamayı kopyala
				</Button>

				<p className="text-label text-base-content/50">
					Görselde mülk sahibinin adı ve ada/parsel bilgileri yer almaz.
				</p>

				{error && <Alert>{error}</Alert>}
			</div>
		</Sheet>
	);
}

/**
 * The real font family for canvas.
 *
 * next/font mints a hashed family name at build time, so a literal "Geist" in
 * ctx.font silently falls back to a system face and every measureText() result
 * is wrong. Reading the computed style off <body> gets whatever the app is
 * actually rendering with, whatever that hash turns out to be.
 */
function getBodyFontFamily(): string {
	if (typeof window === "undefined") return "sans-serif";
	const family = getComputedStyle(document.body).fontFamily;
	return family || "sans-serif";
}
