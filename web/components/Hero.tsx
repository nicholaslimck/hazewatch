import { psiBand } from '../../shared/bands.ts';

const SENSITIVE = 'Elderly, children, pregnant women and people with heart or lung conditions should take extra care.';

export function Hero({ value }: { value: number | undefined }) {
  if (value === undefined) {
    return <section className="card hero"><p className="muted">No PSI reading for this region yet</p></section>;
  }
  const band = psiBand(value);
  return (
    <section className="card hero" aria-label="24-hour PSI">
      <p className="label">24h PSI</p>
      <p className="hero-num">{Math.round(value)}</p>
      <span className="chip" style={{ background: band.color, color: band.onColor }}>{band.label}</span>
      <p className="advice">{band.advice}</p>
      {band.sensitiveNote && <p className="note">{SENSITIVE}</p>}
    </section>
  );
}
