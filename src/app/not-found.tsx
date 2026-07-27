import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
	return (
		<main className="min-h-[70vh] flex items-center justify-center px-6">
			<div className="max-w-sm text-center">
				<div className="mx-auto mb-4 h-12 w-12 rounded-box bg-base-200 flex items-center justify-center">
					<SearchX className="w-6 h-6 text-base-content/50" />
				</div>
				<h1 className="text-subtitle font-semibold text-base-content">Sayfa bulunamadı</h1>
				<p className="mt-2 text-body text-base-content/60">
					Böyle bir sayfa yok — taşınmış ya da bağlantı güncelliğini yitirmiş olabilir.
				</p>
				<Link
					href="/"
					className="mt-5 inline-flex items-center h-10 px-4 rounded-field bg-primary text-primary-content text-body font-semibold hover:brightness-110 transition-[filter] duration-150"
				>
					Genel bakışa dön
				</Link>
			</div>
		</main>
	);
}
