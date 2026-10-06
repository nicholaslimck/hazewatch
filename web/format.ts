import type { Region } from '../shared/types.ts';

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
export const regionName = (r: Region) => r[0].toUpperCase() + r.slice(1);
