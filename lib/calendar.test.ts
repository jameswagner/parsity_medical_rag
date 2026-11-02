import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleAppointment } from './calendar';

const fetchMock = vi.fn();

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	vi.stubEnv('CAL_API_KEY', 'cal_test');
	vi.stubEnv('CAL_EVENT_TYPE_ID', '42');
	vi.stubEnv('CAL_ATTENDEE_EMAIL', 'demo@example.com');
});

afterEach(() => {
	fetchMock.mockReset();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

const ok = (data: object) =>
	new Response(JSON.stringify({ status: 'success', data }), { status: 201 });

describe('scheduleAppointment', () => {
	it('posts a v2 booking with auth, version header and UTC start', async () => {
		fetchMock.mockResolvedValue(ok({ uid: 'abc123' }));

		const result = await scheduleAppointment({
			patientName: 'Abe Frami',
			dateTime: '2026-11-02T09:00:00Z',
			notes: 'Follow-up',
		});

		expect(result).toEqual({
			success: true,
			bookingId: 'abc123',
			bookingUrl: 'https://cal.com/booking/abc123',
		});
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://api.cal.com/v2/bookings');
		expect(init.headers.Authorization).toBe('Bearer cal_test');
		expect(init.headers['cal-api-version']).toBeTruthy();
		const body = JSON.parse(init.body);
		expect(body).toMatchObject({
			start: '2026-11-02T09:00:00.000Z',
			eventTypeId: 42,
			attendee: { name: 'Abe Frami', email: 'demo@example.com' },
		});
	});

	it('books the default 30min event type by slug when no event type id is set', async () => {
		vi.stubEnv('CAL_EVENT_TYPE_ID', '');
		fetchMock
			.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'success', data: { username: 'jane' } })))
			.mockResolvedValueOnce(ok({ uid: 'u1' }));

		const result = await scheduleAppointment({ patientName: 'A', dateTime: '2026-11-02T09:00:00Z' });

		expect(result.success).toBe(true);
		expect(fetchMock.mock.calls[0][0]).toBe('https://api.cal.com/v2/me');
		const body = JSON.parse(fetchMock.mock.calls[1][1].body);
		expect(body).toMatchObject({ eventTypeSlug: '30min', username: 'jane' });
		expect(body.eventTypeId).toBeUndefined();
	});

	it('surfaces the Cal.com error message', async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ status: 'error', error: { message: 'slot taken' } }), { status: 400 }),
		);
		const result = await scheduleAppointment({ patientName: 'A', dateTime: '2026-11-02T09:00:00Z' });
		expect(result).toEqual({ success: false, error: 'slot taken' });
	});

	it('fails without calling Cal.com when there is no attendee email', async () => {
		vi.stubEnv('CAL_ATTENDEE_EMAIL', '');
		const result = await scheduleAppointment({ patientName: 'A', dateTime: '2026-11-02T09:00:00Z' });
		expect(result.success).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('rejects an unparseable dateTime', async () => {
		const result = await scheduleAppointment({ patientName: 'A', dateTime: 'monday-ish' });
		expect(result.success).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
