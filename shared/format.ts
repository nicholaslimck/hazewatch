import type { Region } from './types.ts';

const TZ = 'Asia/Singapore';
const timeFmt = new Intl.DateTimeFormat('en-SG', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-SG', { timeZone: TZ, hour: 'numeric' });
// 90d points are bare YYYY-MM-DD dates; Date.parse reads them as UTC midnight, so format in UTC.
const dayFmt = new Intl.DateTimeFormat('en-SG', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const monthFmt = new Intl.DateTimeFormat('en-SG', { timeZone: 'UTC', month: 'short' });
const sgtDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }); // en-CA formats as YYYY-MM-DD

export const fmtTime = (ts: string) => timeFmt.format(Date.parse(ts)); // "6:00 pm"
export const fmtHour = (ts: string) => hourFmt.format(Date.parse(ts)).replace(/\s/g, ''); // "3pm"
export const fmtDay = (date: string) => dayFmt.format(Date.parse(date)).replace(',', ''); // "Mon 6 Oct"
export const fmtMonth = (date: string) => monthFmt.format(Date.parse(date)); // "Oct"
export const todaySgt = () => sgtDateFmt.format(Date.now()); // "2026-10-06"
const weekdayFmt = new Intl.DateTimeFormat('en-SG', { timeZone: TZ, weekday: 'short' });
const dateFmt = new Intl.DateTimeFormat('en-SG', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
export const fmtDate = (ts: string) => dateFmt.format(Date.parse(ts)).replace(',', ''); // "Tue 13 Oct" (SGT)
const DAY = 24 * 60 * 60 * 1000;
// "6:00 pm" today (SGT), "Sun 6:00 pm" within the week, "Tue 13 Oct, 11:00 am" beyond it: a bare
// weekday would let a reading from two Tuesdays ago pass for this morning's.
export const fmtWhen = (ts: string, now = Date.now()) => {
  const t = Date.parse(ts);
  if (sgtDateFmt.format(t) === sgtDateFmt.format(now)) return fmtTime(ts);
  return now - t < 6 * DAY ? `${weekdayFmt.format(t)} ${fmtTime(ts)}` : `${fmtDate(ts)}, ${fmtTime(ts)}`;
};
// How old a reading is, in the unit a person would say: "3 hours", "14 days".
export const fmtAge = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  if (h < 48) return h === 1 ? '1 hour' : `${h} hours`;
  return `${Math.floor(h / 24)} days`;
};
export const regionName = (r: Region) => r[0].toUpperCase() + r.slice(1);
