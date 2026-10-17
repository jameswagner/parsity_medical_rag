import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query, fmtDate, ageOf } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Patient = {
	id: string;
	firstName: string | null;
	lastName: string | null;
	gender: string | null;
	birthDate: Date | null;
	deathDate: Date | null;
	maritalStatus: string | null;
	race: string | null;
	ethnicity: string | null;
	city: string | null;
	state: string | null;
};
type Condition = { display: string; clinicalStatus: string | null; onsetDate: Date | null; abatementDate: Date | null };
type Medication = { display: string; status: string | null; authoredOn: Date | null; dosage: string | null };
type Observation = { display: string; valueNumber: number | null; valueString: string | null; unit: string | null; effectiveDate: Date | null };
type Note = { id: string; type: string | null; date: Date | null; content: string };

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const [patient] = await query<Patient>(
		`SELECT id, "firstName", "lastName", gender, "birthDate", "deathDate", "maritalStatus", race, ethnicity, city, state
		 FROM patients WHERE id = $1`,
		[id],
	);
	if (!patient) notFound();

	const [conditions, medications, observations, notes, [{ encounters }]] = await Promise.all([
		query<Condition>(
			`SELECT display, "clinicalStatus", "onsetDate", "abatementDate" FROM conditions
			 WHERE "patientId" = $1 ORDER BY ("clinicalStatus" = 'active') DESC, "onsetDate" DESC NULLS LAST`,
			[id],
		),
		query<Medication>(
			`SELECT display, status, "authoredOn", dosage FROM medications
			 WHERE "patientId" = $1 ORDER BY (status = 'active') DESC, "authoredOn" DESC NULLS LAST LIMIT 100`,
			[id],
		),
		// Latest value of each observation type, so vitals don't drown everything else
		query<Observation>(
			`SELECT DISTINCT ON (display) display, "valueNumber", "valueString", unit, "effectiveDate"
			 FROM observations WHERE "patientId" = $1 ORDER BY display, "effectiveDate" DESC NULLS LAST`,
			[id],
		),
		query<Note>(`SELECT id, type, date, content FROM notes WHERE "patientId" = $1 ORDER BY date DESC NULLS LAST`, [id]),
		query<{ encounters: string }>(`SELECT count(*) AS encounters FROM encounters WHERE "patientId" = $1`, [id]),
	]);

	const active = medications.filter((m) => m.status === 'active');

	return (
		<>
			<p className="small"><Link href="/">← Back</Link></p>
			<h1>{patient.firstName} {patient.lastName}</h1>
			<p className="muted" style={{ marginTop: 0 }}>
				<code>{patient.id}</code> · use this id as the <code>patientId</code> filter in your search route
			</p>

			<div className="panel">
				<div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
					<Field label="Gender" value={patient.gender} />
					<Field label="Born" value={fmtDate(patient.birthDate)} />
					<Field label="Age" value={ageOf(patient.birthDate, patient.deathDate)} />
					<Field label="Race" value={patient.race} />
					<Field label="Ethnicity" value={patient.ethnicity} />
					<Field label="Marital status" value={patient.maritalStatus} />
					<Field label="Location" value={[patient.city, patient.state].filter(Boolean).join(', ')} />
					<Field label="Counts" value={`${notes.length} notes · ${encounters} encounter${encounters === "1" ? "" : "s"}`} />
				</div>
			</div>

			<h2>Active medications <span className="pill">{active.length}</span></h2>
			{active.length === 0 ? <p className="muted">None.</p> : (
				<p style={{ marginTop: 0 }}>{active.map((m) => m.display).join(' · ')}</p>
			)}
			<p className="small muted" style={{ marginTop: 0 }}>This is the list that becomes <code>currentMedications</code> on each vector.</p>

			<h2>Conditions <span className="pill">{conditions.length}</span></h2>
			<Table
				head={['Condition', 'Status', 'Onset', 'Resolved']}
				rows={conditions.map((c) => [c.display, c.clinicalStatus ?? '—', fmtDate(c.onsetDate), fmtDate(c.abatementDate)])}
			/>

			<h2>Latest observations <span className="pill">{observations.length} types</span></h2>
			<Table
				head={['Observation', 'Latest value', 'Date']}
				rows={observations.map((o) => [
					o.display,
					o.valueNumber != null ? `${o.valueNumber}${o.unit ? ` ${o.unit}` : ''}` : (o.valueString ?? '—'),
					fmtDate(o.effectiveDate),
				])}
			/>

			<h2>Medication history <span className="pill">{medications.length}</span></h2>
			<Table
				head={['Medication', 'Status', 'Prescribed', 'Dosage']}
				rows={medications.map((m) => [m.display, m.status ?? '—', fmtDate(m.authoredOn), m.dosage ?? '—'])}
			/>

			<h2>Notes <span className="pill">{notes.length}</span></h2>
			<p className="small muted" style={{ marginTop: 0 }}>Newest first. These are exactly the texts that were embedded into Pinecone.</p>
			<div className="panel">
				{notes.length === 0 && <p className="muted">No notes.</p>}
				{notes.map((n) => (
					<details key={n.id}>
						<summary>
							<strong>{fmtDate(n.date)}</strong> <span className="muted">· {n.type ?? 'note'} · {n.content.slice(0, 90)}…</span>
						</summary>
						<p className="note">{n.content}</p>
						<p className="small muted">note id <code>{n.id}</code></p>
					</details>
				))}
			</div>
		</>
	);
}

function Field({ label, value }: { label: string; value: string | null }) {
	return (
		<div>
			<div className="small muted">{label}</div>
			<div>{value || '—'}</div>
		</div>
	);
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
	if (rows.length === 0) return <p className="muted">None.</p>;
	return (
		<div className="table-wrap">
			<table>
				<thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
				<tbody>
					{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
				</tbody>
			</table>
		</div>
	);
}
