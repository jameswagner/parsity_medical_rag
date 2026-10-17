import { Pool } from 'pg';

// One pool per server instance. Kept small: Vercel spins up many instances and
// each holds its own connections, so a big max multiplies against Neon's limit.
const globalForPool = globalThis as unknown as { pool?: Pool };

// Without this, pg silently falls back to localhost:5432 and the error says ECONNREFUSED
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set for this Vercel environment');

export const pool =
	globalForPool.pool ??
	new Pool({
		connectionString: process.env.DATABASE_URL,
		max: 3,
		// Neon requires TLS; a local Postgres usually doesn't speak it
		ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? '') ? false : { rejectUnauthorized: false },
	});

if (process.env.NODE_ENV !== 'production') globalForPool.pool = pool;

/**
 * Parameterized queries only — this site is public, so there is deliberately no
 * way to send it free-form SQL. Every statement lives in this repo.
 */
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
	const { rows } = await pool.query(sql, params);
	return rows as T[];
}

export function fmtDate(d: Date | string | null | undefined): string {
	if (!d) return '—';
	return new Date(d).toISOString().slice(0, 10);
}

export function ageOf(birth: Date | string | null, death: Date | string | null): string {
	if (!birth) return '—';
	const end = death ? new Date(death) : new Date();
	const years = Math.floor((end.getTime() - new Date(birth).getTime()) / (365.25 * 24 * 3600 * 1000));
	return death ? `${years} (deceased)` : String(years);
}
