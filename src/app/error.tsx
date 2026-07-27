"use client";

// Route-level error boundary: a crash in any page renders this instead of a
// blank screen, with a way back that doesn't require knowing what happened.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function RouteError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<main className="min-h-[70vh] flex items-center justify-center px-6">
			<div className="max-w-sm text-center">
				<div className="mx-auto mb-4 h-12 w-12 rounded-box bg-error/10 flex items-center justify-center">
					<AlertTriangle className="w-6 h-6 text-error" />
				</div>
				<h1 className="text-lg font-bold text-base-content">Bir sorun oluştu</h1>
				<p className="mt-2 text-sm text-base-content/60">
					Sayfa beklenmedik bir hatayla karşılaştı. Verileriniz güvende — tekrar deneyin
					veya genel bakışa dönün.
				</p>
				<div className="mt-5 flex items-center justify-center gap-2">
					<button
						type="button"
						onClick={reset}
						className="inline-flex items-center gap-1.5 h-10 px-4 rounded-field bg-primary text-primary-content text-sm font-semibold hover:brightness-110 transition-[filter] duration-150"
					>
						<RotateCcw className="w-4 h-4" />
						Tekrar dene
					</button>
					<Link
						href="/"
						className="inline-flex items-center h-10 px-4 rounded-box border border-base-300 text-sm font-semibold text-base-content/80 hover:bg-base-200 transition-colors"
					>
						Genel bakışa dön
					</Link>
				</div>
				{error.digest && (
					<p className="mt-4 text-micro text-base-content/30">Hata referansı: {error.digest}</p>
				)}
			</div>
		</main>
	);
}
