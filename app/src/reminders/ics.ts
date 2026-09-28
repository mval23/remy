import type { Reminder } from './reminders';

/**
 * A calendar file (.ics) with one short event and alarm per reminder.
 * Works with every calendar app, needs no sign-in, and fires even when Remy is closed.
 */

const pad = (n: number) => String(n).padStart(2, '0');
/** UTC timestamp in iCalendar form, e.g. 20260927T190000Z. */
const stamp = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
};
/** Escape text per RFC 5545. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function toIcs(reminders: Reminder[], appUrl: string, now = Date.now()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Remy//Reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const r of reminders) {
    lines.push(
      'BEGIN:VEVENT',
      // Same kind and day → same id, so importing an updated file can replace the old event.
      `UID:${r.tag}@remy`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(r.at)}`,
      `DTEND:${stamp(r.at + 15 * 60 * 1000)}`,
      `SUMMARY:${esc(`Remy: ${r.title}`)}`,
      `DESCRIPTION:${esc(r.body)}`,
      `URL:${esc(appUrl + '?open=' + r.url)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(r.title)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
