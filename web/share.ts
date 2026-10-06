import type { Region } from '../shared/types.ts';
import type { ScaleSpec } from '../shared/scale.ts';
import { fmtDay, fmtTime, regionName } from './format.ts';

type CardOpts = { spec: ScaleSpec; region: Region; value: number; ts: string };

export const shareText = (spec: ScaleSpec, region: Region, value: number) =>
  `${regionName(region)} ${spec.name} ${value}, ${spec.band(value).label.toLowerCase()}. ${spec.verdict(value)[1]}`;

// ts is +08:00, so its first 10 chars are the SGT date.
export const shareFilename = (region: Region, ts: string) => `hazecheck-${region}-${ts.slice(0, 10)}.png`;

export const shareMode = (nav: { canShare?: (d: ShareData) => boolean }, file: File): 'files' | 'download' =>
  nav.canShare?.({ files: [file] }) ? 'files' : 'download';

export const isCancel = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

export async function drawCard({ spec, region, value, ts }: CardOpts): Promise<Blob> {
  await document.fonts.ready;
  const band = spec.band(value);
  const [line1, line2] = spec.verdict(value);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1080;
  const g = canvas.getContext('2d')!;
  g.fillStyle = band.color;
  g.fillRect(0, 0, 1080, 1080);
  g.fillStyle = band.onColor;
  g.textBaseline = 'alphabetic';
  const font = (px: number, w: number) => { g.font = `${w} ${px}px system-ui, sans-serif`; };
  const text = (s: string, y: number) => g.fillText(s, 88, y);
  font(56, 600); text(regionName(region), 160);
  font(200, 600); text(`${spec.name} ${value}`, 400);
  font(72, 400); text(line1, 560); text(line2, 650);
  font(40, 400); text(`${band.label} · ${fmtTime(ts)}, ${fmtDay(ts.slice(0, 10))}`, 780);
  font(36, 600); text('HazeCheck', 1080 - 88);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

export async function shareNow(o: CardOpts & { publicUrl: string | null }): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([await drawCard(o)], shareFilename(o.region, o.ts), { type: 'image/png' });
  if (shareMode(navigator, file) === 'files') {
    try {
      await navigator.share({ files: [file], text: shareText(o.spec, o.region, o.value), ...(o.publicUrl ? { url: o.publicUrl } : {}) });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
