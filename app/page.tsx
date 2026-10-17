import Link from 'next/link';
import { query, fmtDate } from '@/lib/db';
import { PRESETS } from '@/lib/queries';

export const dynamic = 'force-dynamic';

type PatientRow = {
	id: string;
	firstName: string | null;
	lastName: string | null;
	gender: string | null;
	birthDate: Date | null;
	city: string | null;
	state: string | null;
	notes: string;
};

type NoteHit = { id: string; patientId: string; firstName: string | null; lastName: string | null; date: Date | null; content: string };

// Escape LIKE wildcards so a search for "100%" means the literal text
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

async function findPatients(q: string) {
	const words = q.trim().split(/\s+/).filter(Boolean);
	// Every word must match the first name, last name, or the start of the id
	const conds = words.map(
		(_, i) => `(p."firstName" ILIKE $${i + 1} OR p."lastName" ILIKE $${i + 1} OR p.id ILIKE $${words.length + i + 1})`,
	);
	const params = [...words.map((w) => `%${likeEscape(w)}%`), ...words.map((w) => `${likeEscape(w)}%`)];
	return query<PatientRow>(
		`SELECT p.id, p."firstName", p."lastName", p.gender, p."birthDate", p.city, p.state,
		        (SELECT count(*) FROM notes n WHERE n."patientId" = p.id) AS notes
		 FROM patients p WHERE ${conds.join(' AND ')}
		 ORDER BY p."lastName", p."firstName" LIMIT 50`,
		params,
	);
}

async function searchNotes(text: string) {
	const pattern = `%${likeEscape(text.trim())}%`;
	const [{ total }] = await query<{ total: string }>(`SELECT count(*) AS total FROM notes WHERE content ILIKE $1`, [pattern]);
	const hits = await query<NoteHit>(
		`SELECT n.id, n."patientId", p."firstName", p."lastName", n.date, n.content
		 FROM notes n JOIN patients p ON p.id = n."patientId"
		 WHERE n.content ILIKE $1 ORDER BY n.date DESC NULLS LAST LIMIT 20`,
		[pattern],
	);
	return { total: Number(total), hits };
}

function highlight(text: string, term: string) {
	const i = text.toLowerCase().indexOf(term.toLowerCase());
	if (i < 0) return text.slice(0, 240);
	const start = Math.max(0, i - 100);
	return (
		<>
			{start > 0 && '…'}
			{text.slice(start, i)}
			<mark>{text.slice(i, i + term.length)}</mark>
			{text.slice(i + term.length, i + term.length + 140)}…
		</>
	);
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; notes?: string }> }) {
	const { q = '', notes = '' } = await searchParams;
	const patients = q.trim() ? await findPatients(q) : null;
	const noteResults = notes.trim().length >= 3 ? await searchNotes(notes) : null;

	return (
		<>
			<h1>Look around the data</h1>
			<p className="muted">
				This is the Postgres database your RAG app sits on top of: the system of record. Use it to check what your
				agent <em>should</em> have answered.
			</p>

			<h2>Find a patient</h2>
			<form action="/">
				<input type="text" name="q" defaultValue={q} placeholder="Name or patient id, e.g. Avery Mueller" />
				<button type="submit">Search</button>
			</form>
			{patients && (
				<div style={{ marginTop: 12 }}>
					{patients.length === 0 ? (
						<p className="muted">No patient matches “{q}”.</p>
					) : (
						<div className="table-wrap">
							<table>
								<thead>
									<tr><th>Name</th><th>Gender</th><th>Born</th><th>Location</th><th>Notes</th><th>Id</th></tr>
								</thead>
								<tbody>
									{patients.map((p) => (
										<tr key={p.id}>
											<td><Link href={`/patients/${p.id}`}>{p.firstName} {p.lastName}</Link></td>
											<td>{p.gender ?? '—'}</td>
											<td>{fmtDate(p.birthDate)}</td>
											<td>{[p.city, p.state].filter(Boolean).join(', ') || '—'}</td>
											<td>{p.notes}</td>
											<td><code className="small">{p.id}</code></td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					{patients.length === 50 && <p className="small muted">Showing the first 50. Add more of the name to narrow it.</p>}
				</div>
			)}

			<h2>Keyword search the notes</h2>
			<p className="small muted" style={{ marginTop: 0 }}>
				Exact text match, the way a plain database search works. Try <Link href="/?notes=short+of+breath">short of breath</Link>{' '}
				and then <Link href="/?notes=dyspnea">dyspnea</Link>: same symptom, different words. Vector search is what bridges
				that gap.
			</p>
			<form action="/">
				<input type="text" name="notes" defaultValue={notes} placeholder="At least 3 characters, e.g. dyspnea" />
				<button type="submit">Search notes</button>
			</form>
			{noteResults && (
				<div className="panel" style={{ marginTop: 12 }}>
					<p style={{ marginTop: 0 }}>
						<strong>{noteResults.total.toLocaleString()}</strong> {noteResults.total === 1 ? "note contains" : "notes contain"} “{notes}”
						{noteResults.total > 20 && <span className="muted"> · newest 20 shown</span>}
					</p>
					{noteResults.hits.map((n) => (
						<div key={n.id} style={{ borderTop: '1px solid var(--line)', padding: '8px 0' }}>
							<div className="small">
								<Link href={`/patients/${n.patientId}`}>{n.firstName} {n.lastName}</Link>{' '}
								<span className="muted">· {fmtDate(n.date)}</span>
							</div>
							<div className="small">{highlight(n.content, notes.trim())}</div>
						</div>
					))}
				</div>
			)}

			<h2>Pre-baked queries</h2>
			<div className="grid">
				{PRESETS.map((p) => (
					<Link key={p.slug} href={`/queries/${p.slug}`} className="panel" style={{ color: 'inherit', textDecoration: 'none' }}>
						<strong>{p.title}</strong>
						<div className="small muted" style={{ marginTop: 4 }}>{p.why}</div>
					</Link>
				))}
			</div>
		</>
	);
}
