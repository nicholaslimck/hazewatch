import { fmtTime } from '../../shared/format.ts';

export function StaleBanner({ ts }: { ts: string }) {
  return <p className="banner" role="status">Data may be out of date (last update {fmtTime(ts)})</p>;
}
