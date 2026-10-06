const LABELS: Record<string, string> = {
  psi_twenty_four_hourly: '24h PSI',
  pm25_one_hourly: '1h PM2.5 (µg/m³)',
  pm25_twenty_four_hourly: '24h PM2.5 (µg/m³)',
  pm10_twenty_four_hourly: '24h PM10 (µg/m³)',
  o3_eight_hour_max: '8h max O₃ (µg/m³)',
  no2_one_hour_max: '1h max NO₂ (µg/m³)',
  so2_twenty_four_hourly: '24h SO₂ (µg/m³)',
  co_eight_hour_max: '8h max CO (mg/m³)',
};
const ORDER = Object.keys(LABELS);

function label(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const s = key.replaceAll('_', ' ');
  return s[0].toUpperCase() + s.slice(1);
}

// Known concentrations first (in LABELS order), then everything else (sub-indices) alphabetically.
function rank(key: string): number {
  const i = ORDER.indexOf(key);
  return i === -1 ? ORDER.length : i;
}

export function Details({ metrics }: { metrics: Record<string, number> | undefined }) {
  if (!metrics) return null;
  const entries = Object.entries(metrics).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  return (
    <details className="card details">
      <summary>Details</summary>
      <dl>
        {entries.map(([k, v]) => (
          <div key={k} className="row">
            <dt>{label(k)}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
