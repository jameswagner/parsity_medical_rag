import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query, fmtDate } from '@/lib/db';
import { presetBySlug } from '@/lib/queries';

export const dynamic = 'force-dynamic';

function cell(v: unknown): string {
	if (v == null) return '—';
	if (v instanceof Date) return fmtDate(v);
	return String(v);
}

export default async function PresetPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const preset = presetBySlug(slug);
	if (!preset) notFound();

	const rows = await query<Record<string, unknown>>(preset.sql);
	const cols = rows.length ? Object.keys(rows[0]) : [];

	return (
		<>
			<p className="small"><Link href="/">← Back</Link></p>
			<h1>{preset.title}</h1>
			<p className="muted" style={{ marginTop: 0 }}>{preset.why}</p>
			<pre>{preset.sql}</pre>
			<p className="small muted">{rows.length} rows</p>
			<div className="table-wrap">
				<table>
					<thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
					<tbody>
						{rows.map((r, i) => (
							<tr key={i}>
								{cols.map((c) => (
									<td key={c}>
										{c === preset.patientIdColumn ? (
											<Link href={`/patients/${String(r[c])}`}><code className="small">{String(r[c])}</code></Link>
										) : (
											cell(r[c])
										)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}
