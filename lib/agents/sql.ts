/**
 * SQL agent — Week 3. Filter extraction + a dynamic WHERE. Returns TEXT.
 *
 *   1. load the DISTINCT condition names that really exist in the data
 *      ("heart attack" is stored as "Myocardial Infarction")
 *   2. the model reads the question + that list and extracts FILTERS
 *      (structured output) — it never writes SQL
 *   3. buildWhere() turns the filters into a Prisma `where` — parameterized,
 *      so there is nothing to inject and no validator to bolt on
 *   4. run it, hand the rows back as text for the aggregator to summarize
 */

import { zodTextFormat } from 'openai/helpers/zod';

import type { Message } from '../agent';
import { openai } from '../openai';
import { prisma } from '../prisma';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

const FiltersSchema = z.object({
	conditions: z
		.array(z.array(z.string()))
		.describe(
			'One inner list per medical concept the question asks about. Each inner list holds every stored name for that concept (e.g. ["Myocardial Infarction", "History of myocardial infarction (situation)"]), copied EXACTLY from the provided list. Empty if none.',
		),
	conditionLogic: z
		.enum(['all', 'any'])
		.describe(
			'How the concepts (outer list) combine: all = patient must match every concept ("and", "both"); any = at least one ("or", "either"). Names inside one concept always count as alternatives.',
		),
	excludeConditions: z
		.array(z.string())
		.describe(
			'Condition names the patient must NOT have ("without", "no history of", "do not have"), copied EXACTLY from the provided list. Empty if none.',
		),
	gender: z.enum(['male', 'female']).nullable(),
	minAge: z
		.number()
		.int()
		.nullable()
		.describe('Minimum age in years, if stated.'),
	maxAge: z
		.number()
		.int()
		.nullable()
		.describe('Maximum age in years, if stated.'),
	city: z.string().nullable(),
	alive: z
		.boolean()
		.nullable()
		.describe('true = still alive, false = deceased, null = not stated.'),
});

export type Filters = z.infer<typeof FiltersSchema>;

// One question can ask for several different patient groups ("how many had a
// heart attack? how many had both heart attack and hypertension?"), and one
// set of filters can't describe that — so the model returns one query per group.
const QueriesSchema = z.object({
	queries: z
		.array(
			FiltersSchema.extend({
				label: z
					.string()
					.describe('Short name for the patient group this query counts, e.g. "heart attack".'),
			}),
		)
		.describe(
			'One entry per distinct patient group the question asks about. A single-part question has exactly one.',
		),
});

const yearsAgo = (years: number) => {
	const d = new Date();
	d.setFullYear(d.getFullYear() - years);
	return d;
};

/** Filters -> Prisma where. Only the filters that were actually set are applied. */
export function buildWhere(f: Filters): Prisma.PatientWhereInput {
	// One clause per concept; any of its stored names satisfies it.
	const conds = f.conditions.map(
		(names): Prisma.PatientWhereInput => ({
			conditions: { some: { display: { in: names } } },
		}),
	);
	return {
		...(conds.length &&
			(f.conditionLogic === 'any' ? { OR: conds } : { AND: conds })),
		...(f.excludeConditions.length && {
			NOT: { conditions: { some: { display: { in: f.excludeConditions } } } },
		}),
		...(f.gender && { gender: f.gender }),
		...(f.city && { city: { equals: f.city, mode: 'insensitive' } }),
		...(f.alive != null && { deathDate: f.alive ? null : { not: null } }),
		...((f.minAge != null || f.maxAge != null) && {
			birthDate: {
				...(f.minAge != null && { lte: yearsAgo(f.minAge) }),
				...(f.maxAge != null && { gt: yearsAgo(f.maxAge + 1) }),
			},
		}),
	};
}

/**
 * Keep only condition names that really exist, and report the rest — the model
 * can invent names ("chest pain"), and silently dropping them would widen the
 * query to every patient.
 */
export function resolveFilters(parsed: Filters, known: string[]) {
	const isKnown = (c: string) => known.includes(c);
	return {
		filters: {
			...parsed,
			conditions: parsed.conditions
				.map((names) => names.filter(isKnown))
				.filter((names) => names.length),
			excludeConditions: parsed.excludeConditions.filter(isKnown),
		},
		unknown: [...parsed.conditions.flat(), ...parsed.excludeConditions].filter(
			(c) => !isKnown(c),
		),
	};
}

const LIMIT = 50;

/** Run one filter set against the database and render it as text. */
async function runQuery(parsed: Filters, known: string[]): Promise<string> {
	// The model copies names from the list, but may invent some.
	const { filters, unknown } = resolveFilters(parsed, known);
	const notes = unknown.length
		? [`Not a condition in the data (ignored): ${unknown.join(', ')}`]
		: [];

	const where = buildWhere(filters); // function NO AI

	// An empty where matches every patient — that is not an answer.
	if (Object.keys(where).length === 0) {
		return [
			...notes,
			'No structured filter applies to this question, so no patients were selected from the database.',
		].join('\n');
	}

	const [total, patients] = await Promise.all([
		prisma.patient.count({ where }), // heres the where clause that is generated by the ai
		prisma.patient.findMany({
			where,
			take: LIMIT,
			select: {
				firstName: true,
				lastName: true,
				gender: true,
				birthDate: true,
				deathDate: true,
				city: true,
				state: true,
				conditions: { select: { display: true, clinicalStatus: true } },
			},
		}),
	]);

	return [
		...notes,
		`Matching patients: ${total}${total > LIMIT ? ` (showing first ${LIMIT})` : ''}`,
		...patients.map((p) => JSON.stringify(p)),
	].join('\n');
}

export async function runSql(
	query: string, // tell me about patient wiht a cold under 82
	history: Message[] = [],
): Promise<string> {
	const conditionRows = await prisma.condition.findMany({
		distinct: ['display'],
		select: { display: true },
		orderBy: { display: 'asc' },
	});
	const known = conditionRows.map((c) => c.display);

	const response = await openai.responses.parse({
		model: 'gpt-6-luna',
		input: [
			{
				role: 'system',
				content: `Extract patient filters from the question. 
				Only set a filter the question actually asks for.
				If the question asks about several different patient groups, return one query per group
				(a group that adds a condition to another group is its own query).
				The same medical concept is often stored under more than one name
				(e.g. "Myocardial Infarction" and "History of myocardial infarction (situation)"):
				put every stored name that matches into one inner list of "conditions", one inner list per concept.\n\n
				Conditions that exist in the data:\n${known.join('\n')}\n\n`,
			},
			...history.map((m) => ({ role: m.role, content: m.content })),
			{ role: 'user', content: query },
		],
		text: { format: zodTextFormat(QueriesSchema, 'queries') },
	}); // get the filters from the question

	const { queries } = QueriesSchema.parse(response.output_parsed);

	console.log('parsed', JSON.stringify(queries, null, 2));

	if (queries.length === 0) {
		return 'No structured filter applies to this question, so no patients were selected from the database.';
	}

	const results = await Promise.all(queries.map(({ label, ...f }) => runQuery(f, known)));

	// One group needs no heading; several do, so the counts stay attributable.
	return queries.length === 1
		? results[0]
		: queries.map((q, i) => `### ${q.label}\n${results[i]}`).join('\n\n');
}
