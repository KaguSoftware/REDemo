"use client";

// Insurance policies on one property.
//
// Lives on the detail page rather than in PropertyForm: a new property's cover
// is rarely known at the moment it is added, and an N-row editor inside an
// already-long create form is the wrong trade.
//
// DASK gets visual priority because it is the one that is legally mandatory —
// a missing or lapsed DASK stops a tapu appointment on the day.

import { useCallback, useEffect, useState } from "react";
import { humanizeError } from "@/src/lib/errors";
import {
	listInsurance,
	createInsurance,
	updateInsurance,
	deleteInsurance,
	oneYearLater,
	type InsuranceInput,
} from "@/src/lib/db/propertyInsurance";
import type { InsuranceKind, PropertyInsurance } from "@/src/lib/db/types";
import {
	INSURANCE_KINDS,
	INSURANCE_KIND_LABEL,
	INSURANCE_KIND_SHORT,
	INSURANCE_WARN_DAYS,
	TURKISH_INSURERS,
	isoDaysFrom,
	policyState,
} from "@/src/lib/insurance";
import { fmtMoney } from "@/src/lib/format";
import { invalidateCache } from "@/src/lib/useCachedResource";
import {
	Card, CardLabel, Button, Badge, Alert, Sheet, FormField, Input, NumberInput,
	DatePicker, Dropdown, Combobox, Textarea, toast, type DropdownOption,
} from "@/src/components/ui";
import { Plus, Pencil, Trash2, ShieldCheck, ShieldAlert } from "lucide-react";

const KIND_OPTIONS: DropdownOption<InsuranceKind>[] = INSURANCE_KINDS.map((k) => ({
	value: k,
	label: INSURANCE_KIND_LABEL[k],
}));

const CURRENCY_OPTIONS: DropdownOption<string>[] = [
	{ value: "TRY", label: "₺ TRY" },
	{ value: "USD", label: "$ USD" },
	{ value: "EUR", label: "€ EUR" },
];

function fmtDate(iso: string): string {
	const [y, m, d] = iso.split("-");
	return `${d}.${m}.${y}`;
}

interface Props {
	propertyId: string;
	/**
	 * Policies embedded by getProperty. Seeding from them rather than fetching
	 * on mount is the whole point: this card only renders once the detail page
	 * has resolved, so its own query would be a SECOND ~330ms wave serialised
	 * behind the first. It refetches only after a mutation, when it must.
	 */
	initial: PropertyInsurance[];
}

export function InsuranceCard({ propertyId, initial }: Props) {
	const [rows, setRows] = useState<PropertyInsurance[]>(initial);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState<PropertyInsurance | "new" | null>(null);

	// Read once per mount so the badge tones don't shift between renders.
	const [todayISO] = useState(() => new Date().toISOString().slice(0, 10));
	const horizonISO = isoDaysFrom(todayISO, INSURANCE_WARN_DAYS);

	// The parent reloads the whole property after an edit, which remounts this
	// with fresh `initial`; this keeps the card correct if it ever doesn't.
	useEffect(() => { setRows(initial); }, [initial]);

	const reload = useCallback(() => {
		listInsurance(propertyId)
			.then((data) => { setRows(data); setError(null); })
			.catch((e) => setError(humanizeError(e)));
	}, [propertyId]);

	async function handleDelete(row: PropertyInsurance) {
		if (!confirm(`${INSURANCE_KIND_SHORT[row.kind]} poliçesi silinsin mi?`)) return;
		try {
			await deleteInsurance(row.id);
			// The portfolio list embeds these rows and the attention feed counts
			// them, so both caches are now wrong.
			invalidateCache("properties");
			invalidateCache("attention");
			toast.success("Poliçe silindi.");
			reload();
		} catch (e) {
			setError(humanizeError(e));
		}
	}

	const dask = rows.find((r) => r.kind === "dask");
	const daskState = dask ? policyState(dask.end_date, todayISO, horizonISO) : null;

	return (
		<Card>
			<div className="flex items-center justify-between gap-2 mb-4">
				<CardLabel>Sigortalar</CardLabel>
				<Button size="sm" variant="ghost" onClick={() => setEditing("new")}>
					<Plus className="w-4 h-4" />
					Sigorta ekle
				</Button>
			</div>

			{error && <Alert className="mb-3">{error}</Alert>}

			{/* DASK is called out separately: it is the mandatory one, and its
			    absence is the actionable state — an empty list would otherwise say
			    nothing at all about the thing that blocks a tapu transfer. */}
			<div className="mb-3">
				{daskState == null ? (
					<Badge tone="red">
						<ShieldAlert className="w-3.5 h-3.5" />
						DASK kaydı yok
					</Badge>
				) : daskState === "expired" ? (
					<Badge tone="red">
						<ShieldAlert className="w-3.5 h-3.5" />
						DASK süresi doldu
					</Badge>
				) : daskState === "expiring" ? (
					<Badge tone="amber">
						<ShieldAlert className="w-3.5 h-3.5" />
						DASK yakında bitiyor
					</Badge>
				) : (
					<Badge tone="emerald">
						<ShieldCheck className="w-3.5 h-3.5" />
						DASK geçerli
					</Badge>
				)}
			</div>

			{/* No skeleton here, and no `rows == null` branch: the policies arrive
			    embedded with the property, so by the time this card renders they
			    are already known. There is no loading state to confuse with an
			    empty one. */}
			{rows.length === 0 ? (
				<p className="text-sm text-base-content/60">
					Kayıtlı poliçe yok. DASK zorunludur ve tapu devri ile abonelik
					işlemlerinde istenir.
				</p>
			) : (
				<ul className="space-y-2">
					{rows.map((row) => {
						const state = policyState(row.end_date, todayISO, horizonISO);
						return (
							<li
								key={row.id}
								id={`sigorta-${row.kind}`}
								className="flex items-center justify-between gap-3 p-3 rounded-xl bg-base-200 border border-base-300"
							>
								<div className="min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<Badge tone={row.kind === "dask" ? "indigo" : "slate"}>
											{INSURANCE_KIND_SHORT[row.kind]}
										</Badge>
										<span className="text-sm truncate">{row.insurer || "Sigorta şirketi belirtilmedi"}</span>
									</div>
									<p className="text-xs text-base-content/60 mt-1 truncate">
										{row.policy_no ? `Poliçe ${row.policy_no} · ` : ""}
										<span
											className={
												state === "expired" ? "text-error font-semibold"
													: state === "expiring" ? "text-warning font-semibold"
														: ""
											}
										>
											{state === "expired" ? "Bitti: " : "Bitiş: "}{fmtDate(row.end_date)}
										</span>
										{row.premium != null ? ` · ${fmtMoney(row.premium, row.currency)}` : ""}
									</p>
								</div>
								<div className="flex items-center gap-1 shrink-0">
									<Button size="sm" variant="ghost" onClick={() => setEditing(row)} aria-label="Poliçeyi düzenle">
										<Pencil className="w-4 h-4" />
									</Button>
									<Button size="sm" variant="ghost" onClick={() => handleDelete(row)} aria-label="Poliçeyi sil">
										<Trash2 className="w-4 h-4" />
									</Button>
								</div>
							</li>
						);
					})}
				</ul>
			)}

			{editing && (
				<InsuranceSheet
					propertyId={propertyId}
					policy={editing === "new" ? null : editing}
					onClose={() => setEditing(null)}
					onSaved={() => { setEditing(null); reload(); }}
				/>
			)}
		</Card>
	);
}

function InsuranceSheet({
	propertyId,
	policy,
	onClose,
	onSaved,
}: {
	propertyId: string;
	policy: PropertyInsurance | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const [kind, setKind] = useState<InsuranceKind>(policy?.kind ?? "dask");
	const [insurer, setInsurer] = useState(policy?.insurer ?? "");
	const [policyNo, setPolicyNo] = useState(policy?.policy_no ?? "");
	const [startDate, setStartDate] = useState(policy?.start_date ?? "");
	const [endDate, setEndDate] = useState(policy?.end_date ?? "");
	const [premium, setPremium] = useState<number | null>(
		policy?.premium != null ? Number(policy.premium) : null,
	);
	const [currency, setCurrency] = useState(policy?.currency ?? "TRY");
	const [notes, setNotes] = useState(policy?.notes ?? "");

	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldError, setFieldError] = useState<string | null>(null);

	/**
	 * DASK and konut policies run for exactly one year, so entering the start
	 * date fills in the end date. Only fills a BLANK end date — never silently
	 * overwrites one the agent typed, or one loaded from an existing policy.
	 */
	function handleStartDate(value: string) {
		setStartDate(value);
		if (value && !endDate) setEndDate(oneYearLater(value));
	}

	async function handleSave() {
		setError(null);
		if (!endDate) {
			setFieldError("Bitiş tarihi gereklidir; hatırlatmalar buna göre çalışır.");
			return;
		}
		if (startDate && Date.parse(endDate) < Date.parse(startDate)) {
			setFieldError("Bitiş tarihi başlangıçtan önce olamaz.");
			return;
		}
		setFieldError(null);
		setBusy(true);
		try {
			const input: InsuranceInput = {
				property_id: propertyId,
				kind,
				insurer: insurer.trim() || null,
				policy_no: policyNo.trim() || null,
				start_date: startDate || null,
				end_date: endDate,
				premium,
				currency,
				notes: notes.trim() || null,
			};
			if (policy) await updateInsurance(policy.id, input);
			else await createInsurance(input);
			// The portfolio list embeds policies and the attention feed counts them.
			invalidateCache("properties");
			invalidateCache("attention");
			toast.success(policy ? "Poliçe güncellendi." : "Poliçe eklendi.");
			onSaved();
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
			title={policy ? "Poliçeyi düzenle" : "Sigorta ekle"}
			footer={
				<div className="flex gap-2 justify-end">
					<Button variant="ghost" onClick={onClose} disabled={busy}>Vazgeç</Button>
					<Button onClick={handleSave} loading={busy}>Kaydet</Button>
				</div>
			}
		>
			<div className="space-y-5">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Sigorta türü">
						<Dropdown options={KIND_OPTIONS} value={kind} onChange={setKind} />
					</FormField>
					<FormField
						label="Sigorta şirketi"
						hint="Listede olmayan bir şirketi de yazabilirsiniz."
					>
						<Combobox
							value={insurer}
							onChange={setInsurer}
							options={TURKISH_INSURERS}
							placeholder="örn. Anadolu Sigorta"
						/>
					</FormField>
				</div>

				<FormField label="Poliçe numarası">
					<Input
						value={policyNo}
						onChange={(e) => setPolicyNo(e.target.value)}
						placeholder="Poliçe üzerindeki numara"
					/>
				</FormField>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Başlangıç tarihi" hint="Bitiş tarihi otomatik olarak bir yıl sonrasına ayarlanır.">
						<DatePicker value={startDate} onChange={handleStartDate} />
					</FormField>
					<FormField label="Bitiş tarihi" error={fieldError ?? undefined}>
						<DatePicker value={endDate} onChange={setEndDate} />
					</FormField>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Prim">
						<NumberInput mode="decimal" format="money" min={0} value={premium} onChange={setPremium} />
					</FormField>
					<FormField label="Para birimi">
						<Dropdown options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} />
					</FormField>
				</div>

				<FormField label="Notlar">
					<Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
				</FormField>

				{error && <Alert>{error}</Alert>}
			</div>
		</Sheet>
	);
}
