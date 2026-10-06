import type { Region } from '../shared/types.ts';

const TZ = 'Asia/Singapore';
const timeFmt = new Intl.DateTimeFormat('en-SG', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-SG', { timeZone: TZ, hour: 'numeric' });
// 90d points are bare YYYY-MM-DD dates; Date.parse reads them as UTC midnight, so format in UTC.
const dateFmt = new Intl.DateTimeFormat('en-SG', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });

export const fmtTime = (ts: string) => timeFmt.format(Date.parse(ts)); // "6:00 pm"
export const fmtHour = (ts: string) => hourFmt.format(Date.parse(ts)).replace(/\s/g, ''); // "3pm"
export const fmtDate = (date: string) => dateFmt.format(Date.parse(date)); // "6 Oct 2026"
export const regionName = (r: Region) => r[0].toUpperCase() + r.slice(1);
