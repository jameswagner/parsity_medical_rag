/**
 * Pre-baked queries. Each one shows the SQL it runs, so students can copy it
 * into their own experiments, and most are picked to line up with something
 * the RAG app does (or gets wrong).
 */
export type Preset = {
	slug: string;
	title: string;
	why: string;
	sql: string;
	// columns whose value is a patient id → rendered as a link to the patient page
	patientIdColumn?: string;
};

export const PRESETS: Preset[] = [
	{
		slug: 'table-sizes',
		title: 'How big is each table?',
		why: 'The shape of what you are searching: a couple hundred patients, tens of thousands of rows about them.',
		sql: `SELECT 'patients' AS "table", count(*) AS "rows" FROM patients
UNION ALL SELECT 'notes', count(*) FROM notes
UNION ALL SELECT 'conditions', count(*) FROM conditions
UNION ALL SELECT 'medications', count(*) FROM medications
UNION ALL SELECT 'observations', count(*) FROM observations
UNION ALL SELECT 'encounters', count(*) FROM encounters`,
	},
	{
		slug: 'most-notes',
		title: 'Patients with the most notes',
		why: 'A filter by patientId on one of these still returns hundreds of notes. That is why topK and reranking matter even after filtering.',
		sql: `SELECT p.id, p."firstName", p."lastName", count(n.id) AS notes
FROM patients p JOIN notes n ON n."patientId" = p.id
GROUP BY p.id ORDER BY notes DESC LIMIT 25`,
		patientIdColumn: 'id',
	},
	{
		slug: 'shared-first-names',
		title: 'First names shared by several patients',
		why: 'The "Avery Mueller" problem: semantically, Avery Mueller is close to Avery Kemmer. Exact lookups belong in SQL, not vector search.',
		sql: `SELECT "firstName", count(*) AS patients, string_agg("lastName", ', ' ORDER BY "lastName") AS "last names"
FROM patients WHERE "firstName" IS NOT NULL
GROUP BY "firstName" HAVING count(*) > 1 ORDER BY patients DESC, "firstName" LIMIT 50`,
	},
	{
		slug: 'common-conditions',
		title: 'Most common conditions',
		why: 'The exact strings stored in conditions.display. "Heart attack" is not in here; "Myocardial infarction" is. This is what grounding the SQL agent is about.',
		sql: `SELECT display, count(DISTINCT "patientId") AS patients
FROM conditions GROUP BY display ORDER BY patients DESC LIMIT 50`,
	},
	{
		slug: 'common-medications',
		title: 'Most common active medications',
		why: 'What ends up in the currentMedications metadata on each vector.',
		sql: `SELECT display, count(DISTINCT "patientId") AS patients
FROM medications WHERE status = 'active' GROUP BY display ORDER BY patients DESC LIMIT 50`,
	},
	{
		slug: 'smoking-status',
		title: 'Smoking status values',
		why: 'Ask the RAG app about "smokers" and compare with what is actually stored. "Smoker" is not a value; "Smokes tobacco daily" is.',
		sql: `SELECT "valueString" AS value, count(DISTINCT "patientId") AS patients
FROM observations WHERE display ILIKE '%tobacco smoking status%'
GROUP BY "valueString" ORDER BY patients DESC`,
	},
	{
		slug: 'note-types',
		title: 'Note types',
		why: 'The kinds of documents in the vector index.',
		sql: `SELECT coalesce(type, '(none)') AS type, count(*) AS notes FROM notes GROUP BY type ORDER BY notes DESC`,
	},
	{
		slug: 'demographics',
		title: 'Patients by gender and race',
		why: 'Good metadata filter candidates: few distinct values, almost always filled.',
		sql: `SELECT gender, race, count(*) AS patients FROM patients GROUP BY gender, race ORDER BY patients DESC`,
	},
	{
		slug: 'random-patients',
		title: '20 random patients',
		why: 'Grab a patient id to use as a filter in your search route.',
		sql: `SELECT id, "firstName", "lastName", gender, "birthDate"::date AS born, city, state
FROM patients ORDER BY random() LIMIT 20`,
		patientIdColumn: 'id',
	},
];

export function presetBySlug(slug: string): Preset | undefined {
	return PRESETS.find((p) => p.slug === slug);
}
