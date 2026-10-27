/**
 * Cal.com Integration
 *
 * Week 3 · YOUR TASK. Prove a booking works with STATIC test data before you
 * wire the agent to it — cohort 3 lost an hour to a v1-vs-v2 API mismatch that
 * had nothing to do with the LLM.
 *
 * Provides appointment scheduling via Cal.com API.
 * This is the "action" part of the human-in-the-loop pattern.
 *
 * Setup:
 * 1. Create account at https://cal.com
 * 2. Create an event type (e.g., "Patient Appointment")
 * 3. Get API key from Settings -> Developer -> API Keys
 * 4. Get event type ID from the URL when editing the event type
 * 5. Add to .env: CAL_API_KEY and CAL_EVENT_TYPE_ID
 */

// v1 was shut down on 2026-04-08; bookings go through v2. The version header is
// pinned because Cal.com changes endpoint behavior per version.
const CAL_API_BASE = 'https://api.cal.com/v2';
const CAL_API_VERSION = '2026-02-25';

export interface ScheduleRequest {
  patientName: string;
  dateTime: string; // ISO 8601 format
  patientEmail?: string;
  notes?: string | null;
}

export interface ScheduleResult {
  success: boolean;
  bookingId?: string;
  bookingUrl?: string;
  error?: string;
}

/**
 * Check if Cal.com is configured
 */
export function isCalConfigured(): boolean {
  return Boolean(process.env.CAL_API_KEY && process.env.CAL_EVENT_TYPE_ID);
}

/**
 * Schedule an appointment via the Cal.com v2 bookings API.
 *
 * `dateTime` may carry an offset/Z; a bare local time ("2026-11-02T09:00:00",
 * what the chat UI sends) is read in this server's time zone.
 * The attendee email is the patient's if given, else CAL_ATTENDEE_EMAIL —
 * the patients are synthetic, so the confirmation goes to the demo owner.
 */
export async function scheduleAppointment(
  request: ScheduleRequest
): Promise<ScheduleResult> {
  if (!isCalConfigured()) {
    return {
      success: false,
      error: 'Cal.com is not configured. Set CAL_API_KEY and CAL_EVENT_TYPE_ID.',
    };
  }

  const email = request.patientEmail || process.env.CAL_ATTENDEE_EMAIL;
  if (!email) {
    return {
      success: false,
      error: 'No attendee email. Set CAL_ATTENDEE_EMAIL (the patients are synthetic).',
    };
  }

  const start = new Date(request.dateTime);
  if (Number.isNaN(start.getTime())) {
    return { success: false, error: `Invalid dateTime: ${request.dateTime}` };
  }

  const response = await fetch(`${CAL_API_BASE}/bookings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CAL_API_KEY}`,
      'cal-api-version': CAL_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      start: start.toISOString(),
      eventTypeId: parseInt(process.env.CAL_EVENT_TYPE_ID!, 10),
      attendee: {
        name: request.patientName,
        email,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      metadata: { patientName: request.patientName, notes: request.notes ?? '' },
    }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || json?.status !== 'success') {
    return {
      success: false,
      error: json?.error?.message ?? json?.message ?? `Cal.com returned ${response.status}`,
    };
  }

  const uid: string = json.data.uid;
  return { success: true, bookingId: uid, bookingUrl: `https://cal.com/booking/${uid}` };
}

/**
 * Cancel an appointment
 *
 * TODO (Extension): Implement appointment cancellation
 */
export async function cancelAppointment(bookingId: string): Promise<ScheduleResult> {
  // TODO: Implement cancellation via Cal.com API
  return {
    success: false,
    error: 'Not implemented',
  };
}

/**
 * Reschedule an appointment
 *
 * TODO (Extension): Implement appointment rescheduling
 */
export async function rescheduleAppointment(
  bookingId: string,
  newDateTime: string
): Promise<ScheduleResult> {
  // TODO: Implement rescheduling via Cal.com API
  return {
    success: false,
    error: 'Not implemented',
  };
}
