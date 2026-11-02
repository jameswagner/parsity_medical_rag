import { describe, expect, it, vi } from 'vitest';

vi.mock('../openai', () => ({ openai: {} }));
vi.mock('../prisma', () => ({ prisma: {} }));
import { buildWhere, resolveFilters, type Filters } from './sql';

const none: Filters = {
	conditions: [],
	conditionLogic: 'all',
	excludeConditions: [],
	gender: null,
	minAge: null,
	maxAge: null,
	city: null,
	alive: null,
};

describe('buildWhere', () => {
	it('is empty when no filter is set', () => {
		expect(buildWhere(none)).toEqual({});
	});

	it('ANDs conditions for "all" and ORs them for "any"', () => {
		const c = [['Hypertension'], ['Diabetes']];
		expect(buildWhere({ ...none, conditions: c }).AND).toHaveLength(2);
		expect(buildWhere({ ...none, conditions: c, conditionLogic: 'any' }).OR).toHaveLength(2);
	});

	it('treats names inside one concept as alternatives, not separate requirements', () => {
		const mi = ['Myocardial Infarction', 'History of myocardial infarction (situation)'];
		const where = buildWhere({ ...none, conditions: [mi, ['Diabetes']] });
		expect(where.AND).toHaveLength(2);
		expect(where.AND).toContainEqual({ conditions: { some: { display: { in: mi } } } });
	});

	it('maps alive to deathDate and ages to a birthDate range', () => {
		expect(buildWhere({ ...none, alive: true }).deathDate).toBeNull();
		expect(buildWhere({ ...none, alive: false }).deathDate).toEqual({ not: null });
		const b = buildWhere({ ...none, minAge: 40, maxAge: 60 }).birthDate as { lte: Date; gt: Date };
		expect(b.lte.getTime()).toBeGreaterThan(b.gt.getTime());
	});

	it('excludes patients who have any of the excluded conditions', () => {
		expect(buildWhere({ ...none, excludeConditions: ['Hypertension'] }).NOT).toEqual({
			conditions: { some: { display: { in: ['Hypertension'] } } },
		});
	});
});

describe('resolveFilters', () => {
	const known = ['Hypertension', 'Diabetes'];

	it('keeps known names and reports invented ones', () => {
		const { filters, unknown } = resolveFilters(
			{ ...none, conditions: [['Hypertension', 'Chest pain']], excludeConditions: ['Asthma'] },
			known,
		);
		expect(filters.conditions).toEqual([['Hypertension']]);
		expect(filters.excludeConditions).toEqual([]);
		expect(unknown).toEqual(['Chest pain', 'Asthma']);
	});

	it('leaves buildWhere empty when every requested name was invented', () => {
		const { filters } = resolveFilters({ ...none, conditions: [['Chest pain']] }, known);
		expect(buildWhere(filters)).toEqual({});
	});
});
