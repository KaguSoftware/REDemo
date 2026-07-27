// Hand a generated file to the user: native share sheet on mobile, download
// otherwise.
//
// This lived in lib/pdf/index.ts as downloadPdfFile, but it only ever read
// file.name and file bytes — nothing about it was PDF-specific. The social
// media image needs exactly this behaviour (on a phone, "share to Instagram"
// IS the feature), so it moved here rather than being copied.

/** Share or download an already-rendered File. */
export async function shareOrDownloadFile(file: File) {
	const safeFilename = file.name;

	// On iOS/mobile, use the Web Share API (triggers the native share/"Save to
	// Files" sheet, which is how a PNG reaches Instagram).
	const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
	const isMobile = isIOS || /Android/i.test(navigator.userAgent);

	if (isMobile && "canShare" in navigator && navigator.canShare({ files: [file] })) {
		try {
			await navigator.share({ files: [file], title: safeFilename });
			return;
		} catch (e) {
			if ((e as DOMException).name === "AbortError") return;
			// otherwise fall through to anchor click
		}
	}

	const url = URL.createObjectURL(file);
	const link = document.createElement("a");
	link.href = url;
	link.download = safeFilename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	setTimeout(() => URL.revokeObjectURL(url), 5_000);
}
